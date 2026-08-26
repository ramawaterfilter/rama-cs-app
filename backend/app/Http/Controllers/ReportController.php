<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\CustomerTicket;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function adminStats(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $cses = User::where('role', 'cse')->get();
        $stats = [];

        foreach ($cses as $cse) {
            $totalTickets = CustomerTicket::where('executive_id', $cse->id)->count();
            
            $ticketsByStatus = CustomerTicket::where('executive_id', $cse->id)
                                ->selectRaw('status_id, count(*) as count')
                                ->groupBy('status_id')
                                ->with('status')
                                ->get();
                                
            $stats[] = [
                'id' => $cse->id,
                'name' => $cse->name,
                'email' => $cse->email,
                'is_active' => $cse->is_active,
                'last_seen_at' => $cse->last_seen_at,
                'is_online' => $cse->is_logged_in && $cse->last_seen_at && $cse->last_seen_at->isAfter(now()->subMinutes(15)),
                'total_tickets' => $totalTickets,
                'tickets_by_status' => $ticketsByStatus
            ];
        }

        return response()->json($stats);
    }

    public function leStats(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $les = User::where('role', 'le')->get();
        $stats = [];

        foreach ($les as $le) {
            $replacementCount = \App\Models\TicketReplacement::where('le_id', $le->id)->count();
            $returnCount = \App\Models\TicketReturn::where('le_id', $le->id)->count();
            
            $totalTickets = $replacementCount + $returnCount;
            
            // To figure out resolved, we can check if the status is something like 'delivered' or 'completed'
            // For now, let's just count 'shipping approved' or similar as resolved, or just pass raw data.
            // Let's count 'completed', 'delivered', 'resolved', 'closed'
            $resolvedReplacements = \App\Models\TicketReplacement::where('le_id', $le->id)
                ->where(function($q) {
                    $q->where('status', 'like', '%delivered%')
                      ->orWhere('status', 'like', '%completed%')
                      ->orWhere('status', 'like', '%closed%')
                      ->orWhere('status', 'like', '%resolved%')
                      ->orWhere('status', 'like', '%approved%');
                })->count();
                
            $resolvedReturns = \App\Models\TicketReturn::where('le_id', $le->id)
                ->where(function($q) {
                    $q->where('status', 'like', '%delivered%')
                      ->orWhere('status', 'like', '%completed%')
                      ->orWhere('status', 'like', '%closed%')
                      ->orWhere('status', 'like', '%resolved%')
                      ->orWhere('status', 'like', '%approved%');
                })->count();

            $stats[] = [
                'id' => $le->id,
                'name' => $le->name,
                'email' => $le->email,
                'is_active' => $le->is_active,
                'last_seen_at' => $le->last_seen_at,
                'is_online' => $le->is_logged_in && $le->last_seen_at && $le->last_seen_at->isAfter(now()->subMinutes(15)),
                'total_tickets' => $totalTickets,
                'resolved_tickets' => $resolvedReplacements + $resolvedReturns
            ];
        }

        return response()->json($stats);
    }
}
