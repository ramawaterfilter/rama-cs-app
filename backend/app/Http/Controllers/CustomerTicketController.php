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
        $user = $request->user();
        $query = CustomerTicket::with(['category', 'subCategory', 'childCategory', 'status', 'executive', 'queryChannel', 'queryType', 'queryFilter', 'outreach', 'countryDynamic', 'replacement.le', 'ticketReturn.le']);
        
        if ($user->role === 'cse') {
            // CSEs can only see tickets allocated to them
            $query->where('executive_id', $user->id);
        }

        // Add filter support
        if ($request->country_id) $query->where('country_id', $request->country_id);
        if ($request->executive_id) $query->where('executive_id', $request->executive_id);
        if ($request->category_id) $query->where('category_id', $request->category_id);
        if ($request->order_id) $query->where('order_id', 'like', '%' . $request->order_id . '%');
        
        $sortOrder = $request->sort_date === 'asc' ? 'asc' : 'desc';
        
        return response()->json($query->orderBy('received_at', $sortOrder)->get());
    }

    public function storePublic(Request $request)
    {
        $data = $request->all();
        
        // If user is logged in, auto-set executive_id (Assigned To)
        $user = $request->user();
        if ($user) {
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
        
        $norm = fn ($v) => strtolower(trim((string) $v));
        $name = $norm($data['customer_name'] ?? '');
        $email = $norm($data['customer_email'] ?? '');
        $phone = $norm($data['customer_phone'] ?? '');

        $dup = CustomerTicket::whereNull('resolved_at')
    ->where(function ($q) use ($name, $email, $phone) {
        if ($name  !== '') $q->orWhereRaw('LOWER(TRIM(customer_name))  = ?', [$name]);
        if ($email !== '') $q->orWhereRaw('LOWER(TRIM(customer_email)) = ?', [$email]);
        if ($phone !== '') $q->orWhereRaw('LOWER(TRIM(customer_phone)) = ?', [$phone]);
    })
    ->first();

if ($dup) {
    return response()->json([
        'message'             => "An open ticket (#{$dup->id}) already exists for this customer.",
        'existing_ticket_id'  => $dup->id,
        'existing_ticket'     => $dup,
    ], 409);
}


        // Block new tickets while the customer already has an open one (email or phone match)
        $norm = fn ($v) => strtolower(trim((string) $v));
        $email = $norm($data['customer_email'] ?? '');
        $phone = $norm($data['customer_phone'] ?? '');

        $dup = CustomerTicket::whereNull('resolved_at')
            ->where(function ($q) use ($email, $phone) {
                if ($email !== '') $q->orWhereRaw('LOWER(TRIM(customer_email)) = ?', [$email]);
                if ($phone !== '') $q->orWhereRaw('LOWER(TRIM(customer_phone)) = ?', [$phone]);
            })
            ->first();

        if ($dup) {
            return response()->json([
                'message'            => "An open ticket (#{$dup->id}) already exists for this customer.",
                'existing_ticket_id' => $dup->id,
                'existing_ticket'    => $dup,
            ], 409);
        }

        $ticket = CustomerTicket::create($data);

        return response()->json(['message' => 'Query submitted successfully', 'ticket' => $ticket], 201);
    }

    public function show(CustomerTicket $ticket)
    {
        return response()->json($ticket->load(['category', 'subCategory', 'childCategory', 'status', 'executive', 'queryChannel', 'queryType', 'queryFilter', 'outreach', 'countryDynamic', 'replacement', 'ticketReturn']));
    }

    public function update(Request $request, CustomerTicket $ticket)
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $ticket->executive_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // CSE updating core fields requires approval
        $data = $request->all();
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

        return response()->json($ticket);
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
        if ($ticket->executive_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update(['edit_requested' => true]);

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
        if ($ticket->executive_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ticket->update(['profile_edit_requested' => true]);

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