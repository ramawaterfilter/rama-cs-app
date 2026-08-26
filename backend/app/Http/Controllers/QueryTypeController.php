<?php

namespace App\Http\Controllers;

use App\Models\QueryType;
use Illuminate\Http\Request;

class QueryTypeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(QueryType::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:query_types',
            'is_active' => 'boolean'
        ]);

        $type = QueryType::create($validated);
        
        \App\Models\QueryCategory::create([
            'name' => $type->name,
            'type' => 'category'
        ]);

        return response()->json($type, 201);
    }

    public function show(QueryType $queryType)
    {
        return response()->json($queryType);
    }

    public function update(Request $request, QueryType $queryType)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|unique:query_types,name,' . $queryType->id,
            'is_active' => 'boolean'
        ]);

        $oldName = $queryType->name;
        $queryType->update($validated);

        if (isset($validated['name']) && $validated['name'] !== $oldName) {
            $cat = \App\Models\QueryCategory::where('name', $oldName)->whereDoesntHave('parents')->first();
            if ($cat) {
                $cat->update(['name' => $validated['name']]);
            }
        }

        return response()->json($queryType);
    }

    public function destroy(QueryType $queryType)
    {
        $cat = \App\Models\QueryCategory::where('name', $queryType->name)->whereDoesntHave('parents')->first();
        if ($cat) {
            $cat->delete();
        }
        $queryType->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
