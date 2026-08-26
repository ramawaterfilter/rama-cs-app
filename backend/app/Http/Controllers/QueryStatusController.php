<?php

namespace App\Http\Controllers;

use App\Models\QueryStatus;
use App\Models\UserActivity;
use Illuminate\Http\Request;

class QueryStatusController extends Controller
{
    public function index(Request $request)
    {
        $query = QueryStatus::query();
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'color' => 'nullable|string',
            'is_default' => 'boolean',
            'type' => 'nullable|string|in:general,logistics'
        ]);

        if ($request->is_default) {
            QueryStatus::where('is_default', true)->update(['is_default' => false]);
        }

        $status = QueryStatus::create($validated);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Created Status',
            'description' => 'Created status: ' . $status->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($status, 201);
    }

    public function update(Request $request, QueryStatus $status)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string',
            'color' => 'nullable|string',
            'is_default' => 'boolean',
            'type' => 'nullable|string|in:general,logistics'
        ]);

        if (isset($validated['is_default']) && $validated['is_default']) {
            QueryStatus::where('is_default', true)->update(['is_default' => false]);
        }

        $status->update($validated);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Updated Status',
            'description' => 'Updated status: ' . $status->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($status);
    }

    public function destroy(Request $request, QueryStatus $status)
    {
        $name = $status->name;
        $status->delete();

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Deleted Status',
            'description' => 'Deleted status: ' . $name,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}
