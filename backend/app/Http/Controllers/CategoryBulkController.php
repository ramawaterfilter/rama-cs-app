<?php

namespace App\Http\Controllers;

use App\Models\QueryCategory;
use App\Models\QueryType;
use App\Models\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class CategoryBulkController extends Controller
{
    private const HEADERS = ['id', 'name', 'type', 'query_type_id', 'parent_ids'];
    private const SHEET_HEADERS = ['Type of Query', 'Query Category', 'Sub Category', 'Child Category'];

    public function template(Request $request)
    {
        if ($request->query('format') !== 'legacy') {
            return response()->streamDownload(function () {
                $stream = fopen('php://output', 'w');
                fwrite($stream, "\xEF\xBB\xBF");
                fputcsv($stream, self::SHEET_HEADERS, ',', '"', '');
                foreach ([
                    ['Communication', 'Follow Up', 'Adress confirmation', 'Follow up through call'],
                    ['Communication', 'Follow Up', 'Adress confirmation', 'Follow up through email'],
                    ['Inquiry', 'Customer Info', 'Address', 'Address change'],
                ] as $row) {
                    fputcsv($stream, $row, ',', '"', '');
                }
                fclose($stream);
            }, 'category-upload-sample.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }
        return response()->streamDownload(function () {
            $stream = fopen('php://output', 'w');
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, ['id', 'name'], ',', '"', '');
            foreach (QueryCategory::orderBy('id')->get(['id', 'name']) as $category) {
                fputcsv($stream, [$category->id, $category->name], ',', '"', '');
            }
            fclose($stream);
        }, 'categories-template.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function upload(Request $request)
    {
        $request->validate(['file' => 'required|file|max:1024', 'apply' => 'sometimes|boolean']);
        $file = $request->file('file');
        if (strtolower($file->getClientOriginalExtension()) !== 'csv') {
            throw ValidationException::withMessages(['file' => 'Upload a UTF-8 CSV file.']);
        }
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($file->getRealPath()));
        if (!mb_check_encoding($contents, 'UTF-8') || str_contains($contents, "\0")) {
            throw ValidationException::withMessages(['file' => 'The file must contain UTF-8 CSV text.']);
        }
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $contents);
        rewind($stream);
        $rows = [];
        $record = 0;
        $start = 0;
        try {
            while (($fields = fgetcsv($stream, null, ',', '"', '')) !== false) {
                $record++;
                $end = ftell($stream);
                $raw = substr($contents, $start, $end - $start);
                $start = $end;
                // fgetcsv accepts malformed quoting, so check each raw record too.
                if (!preg_match('/\A(?:"(?:[^"]|"")*"|[^",\r\n]*)(?:,(?:"(?:[^"]|"")*"|[^",\r\n]*))*(?:\r\n|\n|\r)?\z/', $raw)) {
                    throw ValidationException::withMessages(["row.$record" => "Row $record: malformed CSV quoting."]);
                }
                if ($record === 1) {
                    $headers = array_map('trim', $fields);
                    $sheet = count($headers) === 4 && !array_diff(self::SHEET_HEADERS, $headers);
                    if (!$sheet && (!in_array('name', $headers, true) || array_diff($headers, self::HEADERS) || count(array_unique($headers)) !== count($headers))) {
                        throw ValidationException::withMessages(['file' => 'Use columns: Type of Query,Query Category,Sub Category,Child Category. Legacy files may use name with optional id,type,query_type_id,parent_ids.']);
                    }
                    continue;
                }
                if ($fields === [null]) {
                    continue;
                }
                if (count($fields) !== count($headers) || count($rows) >= 1000) {
                    throw ValidationException::withMessages(["row.$record" => "Row $record: column count must match headers; maximum 1,000 data rows per upload."]);
                }
                $row = array_combine($headers, array_map('trim', $fields));
                $rows[$record] = $sheet ? $row : array_replace(array_fill_keys(self::HEADERS, ''), $row);
            }
        } finally {
            fclose($stream);
        }
        if (!$rows) {
            throw ValidationException::withMessages(['file' => 'Include at least one category row.']);
        }
        if ($sheet) {
            return $this->uploadSheet($rows, $request);
        }

        return DB::transaction(function () use ($rows, $request) {
            $categories = QueryCategory::with('parents')->lockForUpdate()->get()->keyBy('id');
            $queryTypes = QueryType::pluck('id')->all();
            $final = [];
            foreach ($categories as $category) {
                $final[$category->id] = ['id' => $category->id, 'name' => $category->name,
                    'type' => $category->type ?: 'category', 'query_type_id' => $category->query_type_id,
                    'parent_ids' => $category->parents->pluck('id')->all()];
            }
            $errors = [];
            $prepared = [];
            $seen = [];
            foreach ($rows as $number => $row) {
                $original = $categories->get($row['id']);
                $row['name'] = $row['name'] !== '' ? $row['name'] : ($original?->name ?? '');
                $row['type'] = $row['type'] !== '' ? $row['type'] : ($original?->type ?: 'category');
                $row['query_type_id'] = $row['query_type_id'] !== '' ? $row['query_type_id'] : ($original?->query_type_id ?? null);
                $row['parent_ids'] = $row['parent_ids'] !== '' ? $row['parent_ids'] : ($original ? $original->parents->pluck('id')->implode(';') : '');
                $validator = Validator::make($row, [
                    'id' => ['nullable', 'regex:/^[1-9][0-9]*$/'],
                    'name' => 'required|string|max:255',
                    'type' => 'required|in:category,subcategory,child',
                    'query_type_id' => ['nullable', 'regex:/^[1-9][0-9]*$/'],
                    'parent_ids' => ['nullable', 'regex:/^(?:-|[1-9][0-9]*(;[1-9][0-9]*)*)$/'],
                ]);
                $messages = $validator->errors()->all();
                if ($row['id'] !== '' && !$categories->has($row['id'])) {
                    $messages[] = 'Category ID does not exist; leave ID blank to create.';
                }
                if ($row['id'] !== '' && isset($seen[$row['id']])) {
                    $messages[] = 'Category ID appears more than once.';
                }
                if ($row['query_type_id'] !== null && !in_array((int) $row['query_type_id'], $queryTypes, true)) {
                    $messages[] = 'Query type ID does not exist.';
                }
                if ($messages) {
                    $errors["row.$number"] = array_map(fn ($message) => "Row $number: $message", $messages);
                    continue;
                }
                $key = $row['id'] === '' ? "new-$number" : (int) $row['id'];
                $seen[$key] = true;
                $row['id'] = $row['id'] === '' ? null : (int) $row['id'];
                $row['query_type_id'] = $row['query_type_id'] === null ? null : (int) $row['query_type_id'];
                $row['parent_ids'] = in_array($row['parent_ids'], ['', '-'], true) ? [] : array_map('intval', explode(';', $row['parent_ids']));
                sort($row['parent_ids']);
                if ($original) {
                    $old = $final[$key];
                    sort($old['parent_ids']);
                    if ($old == $row) {
                        continue;
                    }
                }
                $prepared[$number] = $key;
                $final[$key] = $row;
            }
            foreach ($prepared as $number => $key) {
                $row = $final[$key];
                $messages = [];
                $original = $row['id'] ? $categories[$row['id']] : null;
                $nameChanged = !$original || $original->name !== $row['name'] ||
                    ($original->type ?: 'category') !== $row['type'] || $original->query_type_id != $row['query_type_id'];
                if ($nameChanged) {
                    foreach ($final as $otherKey => $other) {
                        if ($key === $otherKey || $other['type'] !== $row['type'] || $other['query_type_id'] != $row['query_type_id']) {
                            continue;
                        }
                        similar_text(mb_strtolower($row['name']), mb_strtolower(trim($other['name'])), $percent);
                        if ($percent > 85) {
                            $messages[] = "Duplicate or similar category name '{$other['name']}' already exists in this query type and level.";
                            break;
                        }
                    }
                }
                if (count($row['parent_ids']) !== count(array_unique($row['parent_ids']))) {
                    $messages[] = 'Parent IDs must not repeat.';
                }
                $oldParents = $original ? $original->parents->pluck('id')->sort()->values()->all() : [];
                $linksChanged = !$original || ($original->type ?: 'category') !== $row['type'] ||
                    $original->query_type_id != $row['query_type_id'] || $oldParents !== $row['parent_ids'];
                if ($linksChanged && $row['type'] === 'category' && $row['parent_ids']) {
                    $messages[] = 'Top-level categories cannot have parents.';
                }
                foreach ($linksChanged ? $row['parent_ids'] : [] as $parentId) {
                    $parent = $final[$parentId] ?? null;
                    if (!$parent || $parentId === $row['id'] || $parent['query_type_id'] != $row['query_type_id'] ||
                        $parent['type'] !== ($row['type'] === 'child' ? 'subcategory' : 'category')) {
                        $messages[] = "Parent $parentId must be an existing category at the preceding level with the same query type.";
                    }
                }
                // Changing a parent must also preserve links from categories outside the upload.
                foreach ($final as $child) {
                    if ($linksChanged && $row['id'] && in_array($row['id'], $child['parent_ids'], true) &&
                        ($child['query_type_id'] != $row['query_type_id'] ||
                         !in_array($child['type'], ['subcategory', 'child'], true) ||
                         $row['type'] !== ($child['type'] === 'child' ? 'subcategory' : 'category'))) {
                        $messages[] = 'This change would invalidate an existing child category link.';
                        break;
                    }
                }
                if ($messages) {
                    $errors["row.$number"] = array_map(fn ($message) => "Row $number: $message", $messages);
                }
            }
            if ($errors) {
                throw ValidationException::withMessages($errors);
            }
            $preview = [];
            foreach ($prepared as $number => $key) {
                $row = $final[$key];
                $preview[] = ['row' => $number, 'action' => $row['id'] ? 'Update' : 'Create', ...$row];
            }
            if (!$request->boolean('apply')) {
                return response()->json(['format' => 'legacy', 'rows' => $preview, 'message' => $preview ? '' : 'No changes found in the file.']);
            }
            foreach ($preview as $row) {
                $category = $row['id'] ? $categories[$row['id']] : new QueryCategory;
                $category->fill(array_intersect_key($row, array_flip(['name', 'type', 'query_type_id'])))->save();
                $category->parents()->sync($row['parent_ids']);
                UserActivity::create(['user_id' => $request->user()->id, 'action' => $row['action'].' Category (Bulk)',
                    'description' => 'Category: '.$category->name, 'ip_address' => $request->ip()]);
            }
            return response()->json(['message' => count($preview).' categories saved successfully.']);
        });
    }

    private function uploadSheet(array $rows, Request $request)
    {
        $errors = [];
        foreach ($rows as $number => $row) {
            foreach (self::SHEET_HEADERS as $header) {
                if ($row[$header] === '' || mb_strlen($row[$header]) > 255) {
                    $errors["row.$number"][] = "Row $number: $header is required and must be at most 255 characters.";
                }
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return DB::transaction(function () use ($rows, $request) {
            $apply = $request->boolean('apply');
            $types = QueryType::lockForUpdate()->get()->keyBy('name');
            $nodes = [];
            foreach (QueryCategory::with('parents')->lockForUpdate()->get() as $node) {
                $nodes[json_encode([$node->query_type_id, $node->type, $node->name])] = $node;
            }
            $preview = [];
            foreach ($rows as $number => $row) {
                $typeName = $row['Type of Query'];
                $type = $types->get($typeName);
                $changed = !$type;
                if (!$type && $apply) {
                    $type = QueryType::create(['name' => $typeName, 'is_active' => true]);
                    $types->put($typeName, $type);
                }
                $parent = null;
                foreach (['category' => 'Query Category', 'subcategory' => 'Sub Category', 'child' => 'Child Category'] as $level => $header) {
                    $key = json_encode([$type?->id, $level, $row[$header]]);
                    $node = $type ? ($nodes[$key] ?? null) : null;
                    if (!$node) {
                        $changed = true;
                        if ($apply) {
                            $node = QueryCategory::create(['name' => $row[$header], 'type' => $level, 'query_type_id' => $type->id]);
                            $node->setRelation('parents', collect());
                            $nodes[$key] = $node;
                        }
                    }
                    if ($parent && $node && !$node->parents->contains('id', $parent->id)) {
                        $changed = true;
                        if ($apply) {
                            $node->parents()->syncWithoutDetaching([$parent->id]);
                            $node->parents->push($parent);
                        }
                    }
                    $parent = $node;
                }
                $preview[] = ['row' => $number, 'action' => $changed ? 'Create / Link' : 'Unchanged', ...$row];
                if ($apply && $changed) {
                    UserActivity::create(['user_id' => $request->user()->id, 'action' => 'Import Category Hierarchy (Bulk)',
                        'description' => implode(' > ', $row), 'ip_address' => $request->ip()]);
                }
            }
            return response()->json($apply
                ? ['message' => count($rows).' category rows imported successfully. Existing categories and links were preserved.']
                : ['format' => 'hierarchy', 'rows' => $preview, 'message' => '']);
        });
    }
}
