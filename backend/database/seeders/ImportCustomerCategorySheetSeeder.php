<?php

namespace Database\Seeders;

use App\Models\QueryCategory;
use App\Models\QueryType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportCustomerCategorySheetSeeder extends Seeder
{
    public function run(): void
    {
        $filename = 'RAMA Customer Category Sheet - Sheet1.csv';
        $defaultPath = file_exists(base_path($filename))
            ? base_path($filename)
            : base_path('../' . $filename);
        $path = env('CATEGORY_CSV_PATH', $defaultPath);
        $file = fopen($path, 'r');

        if ($file === false) {
            throw new RuntimeException("Cannot read category CSV: {$path}");
        }

        $headers = fgetcsv($file);
        if ($headers) {
            $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);
        }

        $expectedHeaders = ['Type of Query', 'Query Category', 'Sub Category', 'Child Category'];
        if ($headers !== $expectedHeaders) {
            fclose($file);
            throw new RuntimeException('CSV headers do not match the expected four columns.');
        }

        $rows = [];
        $line = 1;
        while (($values = fgetcsv($file)) !== false) {
            $line++;
            if (count($values) !== 4) {
                fclose($file);
                throw new RuntimeException("CSV row {$line} must contain four columns.");
            }

            $row = array_combine($expectedHeaders, array_map('trim', $values));
            if (in_array('', $row, true)) {
                fclose($file);
                throw new RuntimeException("CSV row {$line} contains an empty category value.");
            }
            $rows[] = $row;
        }
        fclose($file);

        $nodes = [];
        $parents = [];
        $nodeKey = static fn (string $queryType, string $level, string $name): string => json_encode([$queryType, $level, $name], JSON_UNESCAPED_UNICODE);

        foreach ($rows as $row) {
            $queryType = $row['Type of Query'];
            $category = $nodeKey($queryType, 'category', $row['Query Category']);
            $subcategory = $nodeKey($queryType, 'subcategory', $row['Sub Category']);
            $child = $nodeKey($queryType, 'child', $row['Child Category']);

            $nodes[$category] = [$queryType, 'category', $row['Query Category']];
            $nodes[$subcategory] = [$queryType, 'subcategory', $row['Sub Category']];
            $nodes[$child] = [$queryType, 'child', $row['Child Category']];
            $parents[$subcategory][$category] = true;
            $parents[$child][$subcategory] = true;
        }

        DB::transaction(function () use ($nodes, $parents): void {
            $queryTypeIds = [];
            $categoryIds = [];

            foreach ($nodes as $key => [$queryTypeName, $level, $name]) {
                if (!isset($queryTypeIds[$queryTypeName])) {
                    $queryTypeIds[$queryTypeName] = QueryType::firstOrCreate(
                        ['name' => $queryTypeName],
                        ['is_active' => true]
                    )->id;
                }

                $categoryIds[$key] = QueryCategory::firstOrCreate([
                    'query_type_id' => $queryTypeIds[$queryTypeName],
                    'type' => $level,
                    'name' => $name,
                ])->id;
            }

            foreach ($parents as $childKey => $parentKeys) {
                foreach (array_keys($parentKeys) as $parentKey) {
                    $pair = [
                        'parent_id' => $categoryIds[$parentKey],
                        'child_id' => $categoryIds[$childKey],
                    ];
                    DB::table('category_relationships')->updateOrInsert($pair, [
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });

        $this->command?->info('Imported ' . count($rows) . ' CSV rows as ' . count($nodes) . ' category records.');
    }
}
