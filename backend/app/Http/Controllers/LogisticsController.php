<?php

namespace App\Http\Controllers;

use App\Models\CustomerTicket;
use App\Models\TicketReplacement;
use App\Models\TicketReturn;
use App\Models\TicketActivityLog;
use App\Models\UserActivity;
use Illuminate\Http\Request;

class LogisticsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'le' && $user->role !== 'admin' && $user->role !== 'cse') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Fetch tickets that have a replacement or return (LEs only see their own)
        $query = CustomerTicket::with(['category', 'status', 'executive', 'replacement', 'ticketReturn'])
            ->where(function($q) use ($user) {
                $q->whereHas('replacement', function ($sub) use ($user) {
                    if ($user->role === 'le') $sub->where('le_id', $user->id);
                })
                ->orWhereHas('ticketReturn', function ($sub) use ($user) {
                    if ($user->role === 'le') $sub->where('le_id', $user->id);
                });
            });

        if ($user->role === 'le') {
            $query->where('is_logistic_approved', true);
        }

        $query->orderBy('created_at', 'desc');

        return response()->json($query->get());
    }

    public function updateReplacement(Request $request, $id)
    {
        $replacement = TicketReplacement::findOrFail($id);
        
        $oldStatus = $replacement->status;
        $replacement->status = $request->status ?? $replacement->status;
        $replacement->remarks = $request->remarks ?? $replacement->remarks;
        $replacement->save();

        if ($oldStatus !== $replacement->status) {
            TicketActivityLog::create([
                'ticket_id' => $replacement->ticket_id,
                'user_id' => $request->user()->id,
                'action' => 'REPLACEMENT_STATUS_UPDATE',
                'old_status' => $oldStatus,
                'new_status' => $replacement->status,
                'remarks' => $replacement->remarks
            ]);

            $desc = 'Updated replacement status for ticket #' . $replacement->ticket_id . ' to ' . $replacement->status;
            if ($replacement->remarks) {
                $desc .= ' | Remarks: ' . $replacement->remarks;
            }

            UserActivity::create([
                'user_id' => $request->user()->id,
                'action' => 'Updated Logistics',
                'description' => $desc,
                'ip_address' => $request->ip()
            ]);
        }

        return response()->json(['message' => 'Replacement updated successfully']);
    }

    public function updateReturn(Request $request, $id)
    {
        $ticketReturn = TicketReturn::findOrFail($id);
        
        $oldStatus = $ticketReturn->status;
        $ticketReturn->status = $request->status ?? $ticketReturn->status;
        $ticketReturn->remarks = $request->remarks ?? $ticketReturn->remarks;
        $ticketReturn->save();

        if ($oldStatus !== $ticketReturn->status) {
            TicketActivityLog::create([
                'ticket_id' => $ticketReturn->ticket_id,
                'user_id' => $request->user()->id,
                'action' => 'RETURN_STATUS_UPDATE',
                'old_status' => $oldStatus,
                'new_status' => $ticketReturn->status,
                'remarks' => $ticketReturn->remarks
            ]);

            $desc = 'Updated return status for ticket #' . $ticketReturn->ticket_id . ' to ' . $ticketReturn->status;
            if ($ticketReturn->remarks) {
                $desc .= ' | Remarks: ' . $ticketReturn->remarks;
            }

            UserActivity::create([
                'user_id' => $request->user()->id,
                'action' => 'Updated Logistics',
                'description' => $desc,
                'ip_address' => $request->ip()
            ]);
        }

        return response()->json(['message' => 'Return updated successfully']);
    }
}
