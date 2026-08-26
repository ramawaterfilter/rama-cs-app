<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated.'],
            ]);
        }

        $user->last_seen_at = now();
        $user->is_logged_in = true;
        $user->save();

        UserActivity::create([
            'user_id' => $user->id,
            'action' => 'Logged In',
            'description' => 'User logged into the system.',
            'ip_address' => $request->ip()
        ]);

        $tokenStr = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $tokenStr,
        ]);
    }

    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'sometimes|string',
            'password' => 'sometimes|string|min:6',
        ]);

        if ($request->has('name')) {
            $user->name = $request->name;
        }

        if ($request->has('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json(['message' => 'Profile updated successfully', 'user' => $user]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            // Mark as logged out but keep the real last activity time
            $user->is_logged_in = false;
            $user->last_seen_at = now(); 
            $user->save();

            UserActivity::create([
                'user_id' => $user->id,
                'action' => 'Logged Out',
                'description' => 'User logged out of the system.',
                'ip_address' => $request->ip()
            ]);
            
            // Revoke all tokens
            $user->tokens()->delete();
        }
        return response()->json(['message' => 'Logged out successfully']);
    }
}
