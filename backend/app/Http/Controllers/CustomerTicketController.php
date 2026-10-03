<?php

namespace App\Http\Controllers;

use App\Models\CustomerTicket;
use App\Models\QueryStatus;
use App\Models\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CustomerTicketController extends Controller
{
    public function index(Request $request)
    {
        // ponytail: no role scoping here — every CSE sees every ticket; executive_id is informational only
        $query = CustomerTicket::with(['category', 'subCategory', 'childCategory', 'status', 'executive', 'queryChannel', 'queryType', 'queryFilter', 'outreach', 'countryDynamic', 'replacement.le', 'ticketReturn.le', 'creator', 'updater']);

        // Add filter support
        if ($request->country_id) $query->where('country_id', $request->country_id);
        if ($request->executive_id) $query->where('executive_id', $request->executive_id);
        if ($request->category_id) $query->where('category_id', $request->category_id);
        if ($request->order_id) $query->where('order_id', 'like', '%' . $request->order_id . '%');
        if ($request->customer_email) $query->where('customer_email', 'like', '%' . $request->customer_email . '%');
        
        $sortOrder = $request->sort_date === 'asc' ? 'asc' : 'desc';
        
        return response()->json($query->orderBy('received_at', $sortOrder)->get());
    }

    public function storePublic(Request $request)
    {
        $data = $request->all();
        unset($data['created_by'], $data['updated_by']);
        
        // If user is logged in, auto-set executive_id (Assigned To)
        $user = $request->user();
        if ($user) {
            $data['created_by'] = $user->id;
            $data['updated_by'] = $user->id;
            if ($user->role === 'admin') {
                if (!empty($data['executive_id'])) {
                    $data['is_allocated'] = true;
                } else {
                    $data['is_allocated'] = false;
                    if (empty($data['status_id'])) {
                        $unallocatedStatus = QueryStatus::firstOrCreate(
                            ['name' => 'Unallocated'],
                            ['color' => '#6c757d', 'type' => 'general']
                        );
                        $data['status_id'] = $unallocatedStatus->id;
                    }
                }
            } else {
                $data['executive_id'] = $user->id;
                $data['is_allocated'] = true;
            }
            
            // Also auto-set agent name/email for the form if authenticated
            if (empty($data['agent_name'])) $data['agent_name'] = $user->name;
            if (empty($data['agent_email'])) $data['agent_email'] = $user->email;
        }

        // Find default status if still not set
        if (empty($data['status_id'])) {
            $defaultStatus = QueryStatus::where('is_default', true)->first();
            if ($defaultStatus) {
                $data['status_id'] = $defaultStatus->id;
            }
        }
        
        $this->applyTimestamps($data);
        $ticket = CustomerTicket::create($data);

        return response()->json(['message' => 'Query submitted successfully', 'ticket' => $ticket], 201);
    }

    public function show(CustomerTicket $ticket)
    {
        return response()->json($ticket->load(['category', 'subCategory', 'childCategory', 'status', 'executive', 'queryChannel', 'queryType', 'queryFilter', 'outreach', 'countryDynamic', 'replacement', 'ticketReturn', 'creator', 'updater']));
    }

    public function update(Request $request, CustomerTicket $ticket)
    {
        $user = $request->user();
        // ponytail: ownership no longer gates edits — admin and any CSE can edit any ticket
        if (!in_array($user->role, ['admin', 'cse'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // CSE updating core fields requires approval
        $data = $request->all();
        unset($data['created_by'], $data['updated_by']);
        $coreFields = [
            'order_id', 'purchase_store', 'query_channel_id', 'query_type_id', 'query_filter_id', 'category_id', 
            'sub_category_id', 'child_category_id', 'description', 'action_taken', 
            'received_at', 'resolved_at', 'customer_outreach_id',
            'status_id', 'remarks'
        ];
        $profileFields = [
            'customer_name', 'customer_email', 'customer_phone', 'country_id', 'address'
        ];
        
        if (isset($data['state_id'])) {
            unset($data['state_id']);
        }

        $updatingCore = false;
        $updatingProfile = false;
        
        foreach ($coreFields as $field) {
            if (array_key_exists($field, $data)) {
                $updatingCore = true;
                break;
            }
        }
        foreach ($profileFields as $field) {
            if (array_key_exists($field, $data)) {
                $updatingProfile = true;
                break;
            }
        }

        if ($user->role === 'cse') {
            if ($updatingCore && $ticket->has_been_updated && !$ticket->edit_approved) {
                return response()->json(['message' => 'Edit approval required for general fields'], 403);
            }
            if ($updatingProfile && !$ticket->profile_edit_approved) {
                return response()->json(['message' => 'Edit approval required for profile fields'], 403);
            }
        }

        $logisticsType = $request->input('logistics_type');
        $replacementData = $request->input('replacement_form');
        $returnData = $request->input('return_form');

        if ($logisticsType === 'replacement' && $replacementData) {
            unset($replacementData['le']);
            $ticket->replacement()->updateOrCreate(['ticket_id' => $ticket->id], $replacementData);
            $ticket->ticketReturn()->delete();
        } elseif ($logisticsType === 'return' && $returnData) {
            unset($returnData['le']);
            $ticket->ticketReturn()->updateOrCreate(['ticket_id' => $ticket->id], $returnData);
            $ticket->replacement()->delete();
        } elseif ($logisticsType === 'nil') {
            $ticket->replacement()->delete();
            $ticket->ticketReturn()->delete();
        }

        unset($data['logistics_type']);
        unset($data['replacement_form']);
        unset($data['return_form']);

        if ($user->role === 'cse' && !$ticket->has_been_updated) {
            $data['has_been_updated'] = true;
        }

        $this->applyTimestamps($data, $ticket);
        $data['updated_by'] = $user->id;
        $ticket->update($data);

        // Reset edit approval after update if it was an approved core edit by CSE
        if ($user->role === 'cse') {
            if ($updatingCore) {
                $ticket->update(['edit_requested' => false, 'edit_approved' => false]);
            }
            if ($updatingProfile) {
                $ticket->update(['profile_edit_requested' => false, 'profile_edit_approved' => false]);
            }
            if ($logisticsType === 'replacement' || $logisticsType === 'return') {
                $ticket->update([
                    'is_logistic_approved' => false,
                    'is_logistic_rejected' => false,
                    'logistic_rejection_reason' => null
                ]);
            }
        }

        $desc = 'Updated details or status for ticket #' . $ticket->id;
        if (isset($data['remarks']) && $data['remarks']) {
            $desc .= ' | Remarks: ' . $data['remarks'];
        }

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Updated Ticket',
            'description' => $desc,
            'ip_address' => $request->ip()
        ]);

        return response()->json($ticket->load(['creator', 'updater']));
    }

    // Auto-captures timestamps: received defaults to submit time, resolved is
    // stamped when status becomes Closed/Resolved/Completed and cleared on reopen.
    private function applyTimestamps(array &$data, ?CustomerTicket $ticket = null): void
    {
        if (empty($data['received_at'])) {
            // ponytail: on update, an empty value means "leave as-is" rather than backdating
            if ($ticket) unset($data['received_at']);
            else $data['received_at'] = now();
        }

        $statusId = $data['status_id'] ?? $ticket?->status_id;
        $name = $statusId ? QueryStatus::find($statusId)?->name : null;
        $closed = $name && preg_match('/close|resolv|complete/i', $name);

        if ($closed) {
            if (!empty($data['resolved_at'])) return;            // manual value wins
            if ($ticket && $ticket->resolved_at) { unset($data['resolved_at']); return; } // keep existing
            $data['resolved_at'] = now();
        } elseif (array_key_exists('status_id', $data) || array_key_exists('resolved_at', $data)) {
            $data['resolved_at'] = null;
        }
    }

    public function destroy(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function requestEdit(Request $request, CustomerTicket $ticket)
    {
        if (!in_array($request->user()->role, ['admin', 'cse'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update(['edit_requested' => true, 'updated_by' => $request->user()->id]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Requested Edit',
            'description' => 'Requested core edit for ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Edit requested successfully', 'ticket' => $ticket]);
    }

    public function approveEdit(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update([
            'updated_by' => $request->user()->id,
            'edit_requested' => false,
            'edit_approved' => true
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Approved Edit',
            'description' => 'Approved core edit for ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Edit approved successfully', 'ticket' => $ticket]);
    }

    public function requestProfileEdit(Request $request, CustomerTicket $ticket)
    {
        if (!in_array($request->user()->role, ['admin', 'cse'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update(['profile_edit_requested' => true, 'updated_by' => $request->user()->id]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Requested Edit',
            'description' => 'Requested profile edit for ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Profile edit requested successfully', 'ticket' => $ticket]);
    }

    public function approveProfileEdit(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update([
            'updated_by' => $request->user()->id,
            'profile_edit_requested' => false,
            'profile_edit_approved' => true
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Approved Edit',
            'description' => 'Approved profile edit for ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Profile edit approved successfully', 'ticket' => $ticket]);
    }

    public function approveLogistics(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update([
            'updated_by' => $request->user()->id,
            'is_logistic_approved' => true,
            'is_logistic_rejected' => false,
            'logistic_rejection_reason' => null
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Approved Logistics',
            'description' => 'Approved logistics request for ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Logistics approved successfully', 'ticket' => $ticket]);
    }

    public function rejectLogistics(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update([
            'updated_by' => $request->user()->id,
            'is_logistic_approved' => false,
            'is_logistic_rejected' => true,
            'logistic_rejection_reason' => $request->input('reason')
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Rejected Logistics',
            'description' => 'Rejected logistics request for ticket #' . $ticket->id . '. Reason: ' . $request->input('reason'),
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Logistics rejected successfully', 'ticket' => $ticket]);
    }

    public function claim(Request $request, CustomerTicket $ticket)
    {
        if ($ticket->is_allocated && $ticket->executive_id) {
            return response()->json(['message' => 'Already allocated'], 400);
        }

        $ticket->update([
            'updated_by' => $request->user()->id,
            'executive_id' => $request->user()->id,
            'is_allocated' => true
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Claimed Ticket',
            'description' => 'Claimed ticket #' . $ticket->id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Claimed successfully', 'ticket' => $ticket]);
    }

    public function allocate(Request $request, CustomerTicket $ticket)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate(['executive_id' => 'required|exists:users,id']);

        $ticket->update([
            'updated_by' => $request->user()->id,
            'executive_id' => $request->executive_id,
            'is_allocated' => true
        ]);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Allocated Ticket',
            'description' => 'Allocated ticket #' . $ticket->id . ' to user ID ' . $request->executive_id,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Allocated successfully', 'ticket' => $ticket]);
    }
}
