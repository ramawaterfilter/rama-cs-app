<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CustomerTicket;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function getSummary(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user->role === 'admin';
        $isCse = $user->role === 'cse';
        $isLe = $user->role === 'le';

        // 1. General notifications (Latest 5 tickets assigned to or created by/for the user's role)
        $recentTicketsQuery = CustomerTicket::with(['executive', 'status']);
        if ($isCse) {
            $recentTicketsQuery->where('executive_id', $user->id);
        }
        $recentTickets = $recentTicketsQuery->orderBy('updated_at', 'desc')->take(5)->get();

        // 2. Edit requests notifications
        $requestsQuery = CustomerTicket::with(['executive', 'status']);
        if ($isAdmin) {
            $requestsQuery->where(function($q) {
                $q->where(function($q2) {
                    $q2->where('edit_requested', true)->where('edit_approved', false);
                })->orWhere(function($q2) {
                    $q2->where('profile_edit_requested', true)->where('profile_edit_approved', false);
                });
            });
        } elseif ($isCse) {
            $requestsQuery->where('executive_id', $user->id)->where(function($q) {
                $q->where('edit_approved', true)->orWhere('profile_edit_approved', true);
            });
        } else {
            // LE doesn't deal with edit requests
            $requestsQuery->where('id', '<', 0); // Empty result
        }
        
        $requests = $requestsQuery->orderBy('updated_at', 'desc')->get();

        // 3. Logistics Notifications
        $logistics = [];
        if ($isLe) {
            $logistics = CustomerTicket::with(['replacement.le', 'ticketReturn.le'])
                ->whereHas('replacement', function ($query) {
                    $query->whereIn('status', ['Pending', 'In Progress', 'Approval Pending']);
                })
                ->orWhereHas('ticketReturn', function ($query) {
                    $query->whereIn('status', ['Pending', 'In Progress', 'Approval Pending']);
                })
                ->orderBy('updated_at', 'desc')
                ->get();
        }

        return response()->json([
            'recent_tickets' => $recentTickets,
            'requests' => $requests,
            'logistics' => $logistics
        ]);
    }
}
