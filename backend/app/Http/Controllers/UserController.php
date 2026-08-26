<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json(User::orderBy('id', 'desc')->get());
    }

    public function cseList()
    {
        return response()->json(User::where('role', 'cse')->where('is_active', true)->get());
    }

    public function leList()
    {
        return response()->json(User::where('role', 'le')->where('is_active', true)->get());
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in(['admin', 'cse', 'le'])],
            'is_active' => 'boolean'
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['is_active'] = $request->has('is_active') ? $request->is_active : true;

        $user = User::create($validated);

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Created User',
            'description' => 'Created user: ' . $user->name . ' (' . $user->role . ')',
            'ip_address' => $request->ip()
        ]);

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role' => ['sometimes', Rule::in(['admin', 'cse', 'le'])],
            'is_active' => 'boolean'
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->fill($validated);
        $user->save();

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Updated User',
            'description' => 'Updated user: ' . $user->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($user);
    }
}
