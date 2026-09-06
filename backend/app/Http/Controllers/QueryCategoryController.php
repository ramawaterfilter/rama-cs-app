<?php

namespace App\Http\Controllers;

use App\Models\QueryCategory;
use App\Models\UserActivity;
use Illuminate\Http\Request;

class QueryCategoryController extends Controller
{
    public function index()
    {
        return response()->json(QueryCategory::with('children', 'parents')->get());
    }

    public function indexPublic()
    {
        return response()->json(QueryCategory::with('parents')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'type' => 'nullable|string',
            'query_type_id' => 'required|exists:query_types,id',
            'parent_ids' => 'nullable|array',
            'parent_ids.*' => 'exists:query_categories,id'
        ]);

        $newName = strtolower(trim($validated['name']));
        $existingCategories = QueryCategory::where('query_type_id', $validated['query_type_id'])
            ->where('type', $validated['type'] ?? null)
            ->get();

        foreach ($existingCategories as $existing) {
            $existingName = strtolower(trim($existing->name));
            if ($existingName === $newName) {
                return response()->json(['message' => 'Duplicate category name is not allowed.'], 422);
            }
            similar_text($newName, $existingName, $percent);
            if ($percent > 85) {
                return response()->json(['message' => "Similar name '{$existing->name}' already exists."], 422);
            }
        }

        $category = QueryCategory::create([
            'name' => $validated['name'],
            'type' => $validated['type'] ?? null,
            'query_type_id' => $validated['query_type_id'],
        ]);

        if (!empty($validated['parent_ids'])) {
            $category->parents()->attach($validated['parent_ids']);
        }

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Created Category',
            'description' => 'Created category: ' . $category->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($category->load('parents'), 201);
    }

    public function update(Request $request, QueryCategory $category)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string',
            'type' => 'nullable|string',
            'query_type_id' => 'sometimes|required|exists:query_types,id',
            'parent_ids' => 'nullable|array',
            'parent_ids.*' => 'exists:query_categories,id'
        ]);

        if (isset($validated['name'])) {
            $newName = strtolower(trim($validated['name']));
            
            $queryTypeId = $validated['query_type_id'] ?? $category->query_type_id;
            $type = $validated['type'] ?? $category->type;
            
            $existingCategories = QueryCategory::where('query_type_id', $queryTypeId)
                ->where('type', $type)
                ->where('id', '!=', $category->id)
                ->get();

            foreach ($existingCategories as $existing) {
                $existingName = strtolower(trim($existing->name));
                if ($existingName === $newName) {
                    return response()->json(['message' => 'Duplicate category name is not allowed.'], 422);
                }
                similar_text($newName, $existingName, $percent);
                if ($percent > 85) {
                    return response()->json(['message' => "Similar name '{$existing->name}' already exists."], 422);
                }
            }
            $category->name = $validated['name'];
        }
        if (isset($validated['type'])) {
            $category->type = $validated['type'];
        }
        if (isset($validated['query_type_id'])) {
            $category->query_type_id = $validated['query_type_id'];
        }
        $category->save();

        if (array_key_exists('parent_ids', $validated)) {
            $category->parents()->sync($validated['parent_ids'] ?? []);
        }

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Updated Category',
            'description' => 'Updated category: ' . $category->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($category->load('parents'));
    }

    public function destroy(Request $request, QueryCategory $category)
    {
        $name = $category->name;
        $category->delete();

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Deleted Category',
            'description' => 'Deleted category: ' . $name,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}
