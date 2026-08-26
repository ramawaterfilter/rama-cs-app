<?php

namespace App\Http\Controllers;

use App\Models\QueryFilter;
use Illuminate\Http\Request;

class QueryFilterController extends Controller
{
    public function index()
    {
        return response()->json(QueryFilter::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:query_filters',
            'is_active' => 'boolean'
        ]);

        $filter = QueryFilter::create($validated);
        return response()->json($filter, 201);
    }

    public function show(QueryFilter $queryFilter)
    {
        return response()->json($queryFilter);
    }

    public function update(Request $request, QueryFilter $queryFilter)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|unique:query_filters,name,' . $queryFilter->id,
            'is_active' => 'boolean'
        ]);

        $queryFilter->update($validated);
        return response()->json($queryFilter);
    }

    public function destroy(QueryFilter $queryFilter)
    {
        $queryFilter->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
