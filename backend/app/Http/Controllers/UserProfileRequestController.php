<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserProfileRequest;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserProfileRequestController extends Controller
{
    public function index()
    {
        return response()->json(UserProfileRequest::with('user')->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        
        $user = User::where('email', $request->email)->first();
        
        $profileRequest = UserProfileRequest::create([
            'email' => $request->email,
            'user_id' => $user ? $user->id : null,
            'status' => 'Pending'
        ]);

        if ($user) {
            UserActivity::create([
                'user_id' => $user->id,
                'action' => 'Password Reset Requested',
                'description' => 'User requested a password reset.',
                'ip_address' => $request->ip()
            ]);
        }

        return response()->json(['message' => 'Password reset request submitted successfully.'], 201);
    }

    public function update(Request $request, $id)
    {
        $profileRequest = UserProfileRequest::findOrFail($id);
        
        $request->validate([
            'status' => 'required|in:Accepted,Rejected',
            'new_password' => 'required_if:status,Accepted'
        ]);

        $profileRequest->status = $request->status;
        $profileRequest->save();

        if ($request->status === 'Accepted' && $profileRequest->user_id) {
            $user = User::find($profileRequest->user_id);
            if ($user) {
                $user->password = Hash::make($request->new_password);
                $user->save();

                UserActivity::create([
                    'user_id' => $user->id,
                    'action' => 'Password Reset Accepted',
                    'description' => 'Admin reset the password for this user.',
                    'ip_address' => $request->ip()
                ]);
            }
        } elseif ($request->status === 'Rejected' && $profileRequest->user_id) {
             UserActivity::create([
                'user_id' => $profileRequest->user_id,
                'action' => 'Password Reset Rejected',
                'description' => 'Admin rejected the password reset request.',
                'ip_address' => $request->ip()
            ]);
        }

        return response()->json(['message' => 'Request updated successfully.']);
    }
}
