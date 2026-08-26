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
            'parent_ids' => 'nullable|array',
            'parent_ids.*' => 'exists:query_categories,id'
        ]);

        $category = QueryCategory::create([
            'name' => $validated['name'],
            'type' => $validated['type'] ?? null,
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
            'parent_ids' => 'nullable|array',
            'parent_ids.*' => 'exists:query_categories,id'
        ]);

        if (isset($validated['name'])) {
            $category->name = $validated['name'];
        }
        if (isset($validated['type'])) {
            $category->type = $validated['type'];
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
