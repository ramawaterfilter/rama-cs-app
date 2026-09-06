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

        $newName = strtolower(trim($validated['name']));
        $existingTypes = QueryType::all();
        foreach ($existingTypes as $existing) {
            $existingName = strtolower(trim($existing->name));
            if ($existingName === $newName) {
                return response()->json(['message' => 'Duplicate query type name is not allowed.'], 422);
            }
            similar_text($newName, $existingName, $percent);
            if ($percent > 85) {
                return response()->json(['message' => "Similar name '{$existing->name}' already exists."], 422);
            }
        }

        $type = QueryType::create($validated);

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

        if (isset($validated['name'])) {
            $newName = strtolower(trim($validated['name']));
            $existingTypes = QueryType::where('id', '!=', $queryType->id)->get();
            foreach ($existingTypes as $existing) {
                $existingName = strtolower(trim($existing->name));
                if ($existingName === $newName) {
                    return response()->json(['message' => 'Duplicate query type name is not allowed.'], 422);
                }
                similar_text($newName, $existingName, $percent);
                if ($percent > 85) {
                    return response()->json(['message' => "Similar name '{$existing->name}' already exists."], 422);
                }
            }
        }

        $oldName = $queryType->name;
        $queryType->update($validated);

        return response()->json($queryType);
    }

    public function destroy(QueryType $queryType)
    {
        $queryType->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
