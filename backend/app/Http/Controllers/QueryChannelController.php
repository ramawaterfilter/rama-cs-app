<?php

namespace App\Http\Controllers;

use App\Models\QueryChannel;
use Illuminate\Http\Request;

class QueryChannelController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(QueryChannel::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:query_channels',
            'is_active' => 'boolean'
        ]);

        $channel = QueryChannel::create($validated);
        return response()->json($channel, 201);
    }

    public function show(QueryChannel $queryChannel)
    {
        return response()->json($queryChannel);
    }

    public function update(Request $request, QueryChannel $queryChannel)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|unique:query_channels,name,' . $queryChannel->id,
            'is_active' => 'boolean'
        ]);

        $queryChannel->update($validated);
        return response()->json($queryChannel);
    }

    public function destroy(QueryChannel $queryChannel)
    {
        $queryChannel->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
