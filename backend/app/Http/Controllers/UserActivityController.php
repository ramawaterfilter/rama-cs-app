<?php

namespace App\Http\Controllers;

use App\Models\UserActivity;
use App\Models\CustomerTicket;
use Illuminate\Http\Request;
use Carbon\Carbon;

class UserActivityController extends Controller
{
    public function index(Request $request)
    {
        $query = UserActivity::with('user')->latest();
        return response()->json($query->paginate(20));
    }

    public function analytics(Request $request)
    {
        // Long pending tickets list (e.g. pending for > 7 days)
        $longPendingQuery = CustomerTicket::with(['executive', 'status'])->whereHas('status', function($q) {
            $q->where('name', 'not like', '%Closed%')
              ->where('name', 'not like', '%Resolved%');
        })->where('created_at', '<', Carbon::now()->subDays(7));

        $longPendingCount = $longPendingQuery->count();
        $longPendingList = $longPendingQuery->latest()->get();

        $pendingCount = CustomerTicket::whereHas('status', function($q) {
            $q->where('name', 'not like', '%Closed%')
              ->where('name', 'not like', '%Resolved%');
        })->count();

        $closedCount = CustomerTicket::whereHas('status', function($q) {
            $q->where('name', 'like', '%Closed%')
              ->orWhere('name', 'like', '%Resolved%');
        })->count();

        // Calculate average time taken to close tickets (in hours) total
        $avgResolutionTime = CustomerTicket::whereNotNull('resolved_at')
            ->whereHas('status', function($q) {
                $q->where('name', 'like', '%Closed%')
                  ->orWhere('name', 'like', '%Resolved%');
            })
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours')
            ->value('avg_hours');

        // Calculate average resolution time per CSE
        $avgByCse = CustomerTicket::whereNotNull('resolved_at')
            ->whereNotNull('executive_id')
            ->whereHas('status', function($q) {
                $q->where('name', 'like', '%Closed%')
                  ->orWhere('name', 'like', '%Resolved%');
            })
            ->join('users', 'customer_tickets.executive_id', '=', 'users.id')
            ->selectRaw('users.name as cse_name, AVG(TIMESTAMPDIFF(HOUR, customer_tickets.created_at, customer_tickets.resolved_at)) as avg_hours, COUNT(customer_tickets.id) as resolved_count')
            ->groupBy('users.id', 'users.name')
            ->get();

        // Logistics Analytics (Avg resolution by LE)
        $leList = \App\Models\User::where('role', 'le')->get();
        $avgByLe = [];
        
        foreach ($leList as $le) {
            $repQuery = \App\Models\TicketReplacement::where('le_id', $le->id)
                ->where(function($q) {
                    $q->where('status', 'like', '%delivered%')
                      ->orWhere('status', 'like', '%completed%')
                      ->orWhere('status', 'like', '%closed%')
                      ->orWhere('status', 'like', '%resolved%')
                      ->orWhere('status', 'like', '%approved%');
                });
            
            $retQuery = \App\Models\TicketReturn::where('le_id', $le->id)
                ->where(function($q) {
                    $q->where('status', 'like', '%delivered%')
                      ->orWhere('status', 'like', '%completed%')
                      ->orWhere('status', 'like', '%closed%')
                      ->orWhere('status', 'like', '%resolved%')
                      ->orWhere('status', 'like', '%approved%');
                });
                
            $repCount = $repQuery->count();
            $retCount = $retQuery->count();
            $totalResolved = $repCount + $retCount;
            
            if ($totalResolved > 0) {
                $repSum = $repQuery->selectRaw('SUM(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as sum_hours')->value('sum_hours') ?? 0;
                $retSum = $retQuery->selectRaw('SUM(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as sum_hours')->value('sum_hours') ?? 0;
                
                $avgHours = ($repSum + $retSum) / $totalResolved;
                
                $avgByLe[] = [
                    'le_name' => $le->name,
                    'resolved_count' => $totalResolved,
                    'avg_hours' => round($avgHours, 1)
                ];
            }
        }

        // Global avg logistics resolution time
        $globalLogisticsAvg = count($avgByLe) > 0 ? array_sum(array_column($avgByLe, 'avg_hours')) / count($avgByLe) : 0;

        return response()->json([
            'long_pending_tickets' => $longPendingCount,
            'long_pending_list' => $longPendingList,
            'pending_tickets' => $pendingCount,
            'closed_tickets' => $closedCount,
            'avg_resolution_hours' => round($avgResolutionTime, 1),
            'avg_resolution_by_cse' => $avgByCse->map(function($item) {
                $item->avg_hours = round($item->avg_hours, 1);
                return $item;
            }),
            'avg_resolution_by_le' => $avgByLe,
            'global_logistics_avg_hours' => round($globalLogisticsAvg, 1)
        ]);
    }
}
