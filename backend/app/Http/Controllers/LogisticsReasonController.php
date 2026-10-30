<?php

namespace App\Http\Controllers;

use App\Models\LogisticsReason;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LogisticsReasonController extends Controller
{
    public function index(Request $request)
    {
        $query = LogisticsReason::orderBy('reason');
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }
        return response()->json($query->get());
    }

    private function adminOnly(Request $request)
    {
        return $request->user()->role !== 'admin'
            ? response()->json(['message' => 'Unauthorized'], 403) : null;
    }

    public function store(Request $request)
    {
        if ($r = $this->adminOnly($request)) return $r;
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255',
                Rule::unique('logistics_reasons')->where('type', $request->input('type'))->whereNull('deleted_at')],
            'type' => 'required|in:return,replacement',
            'is_active' => 'boolean',
        ]);
        return response()->json(LogisticsReason::create($validated), 201);
    }

    public function update(Request $request, LogisticsReason $logisticsReason)
    {
        if ($r = $this->adminOnly($request)) return $r;
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255',
                Rule::unique('logistics_reasons')->where('type', $request->input('type'))
                    ->whereNull('deleted_at')->ignore($logisticsReason->id)],
            'type' => 'required|in:return,replacement',
            'is_active' => 'boolean',
        ]);
        $logisticsReason->update($validated);
        return response()->json($logisticsReason);
    }

    public function destroy(Request $request, LogisticsReason $logisticsReason)
    {
        if ($r = $this->adminOnly($request)) return $r;
        $logisticsReason->delete();
        return response()->json(null, 204);
    }
}
