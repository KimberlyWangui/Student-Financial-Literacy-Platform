<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    /**
     * Display a listing of users.
     * Accessible by: Admin only
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can retrieve all users
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only admins can view all users.'
            ], 403);
        }

        // Get all users with pagination
        $users = User::paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Users retrieved successfully',
            'data' => $users
        ], 200);
    }

    /**
     * Store a newly created user.
     * Accessible by: Admin only
     */
    public function store(Request $request)
    {
        // Check if user is admin
        if (Auth::user()->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only admins can create users.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'role' => ['required', Rule::in(['admin', 'student'])],
        ]);

        // Create user
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'data' => $user
        ], 201);
    }

    /**
     * Display the specified user.
     * Accessible by: Admin (any user) and Student (only themselves)
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find the target user
        $targetUser = User::find($id);

        if (!$targetUser) {
            return response()->json([
                'message' => 'User not found'
            ], 404);
        }

        // Students can only view their own record
        if ($currentUser->role === 'student' && $currentUser->id != $id) {
            return response()->json([
                'message' => 'Unauthorized. Students can only view their own profile.'
            ], 403);
        }

        // Admins can view any user
        return response()->json([
            'message' => 'User retrieved successfully',
            'data' => $targetUser
        ], 200);
    }

    /**
     * Update the specified user.
     * Accessible by: Admin (all users) and Student (only themselves)
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Check permissions
        if ($currentUser->role === 'student' && $currentUser->id != $id) {
            return response()->json([
                'message' => 'Unauthorized. Students can only update their own profile.'
            ], 403);
        }

        if (!in_array($currentUser->role, ['admin', 'student'])) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 403);
        }

        // Find user
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'message' => 'User not found'
            ], 404);
        }

        // Validate request
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($id)],
            'password' => 'sometimes|string|min:8|confirmed',
            'role' => ['sometimes', Rule::in(['admin', 'student'])],
            'two_factor_enabled' => 'sometimes|boolean'
        ]);

        // Students cannot change their role
        if ($currentUser->role === 'student' && isset($validated['role'])) {
            return response()->json([
                'message' => 'Students cannot change their role'
            ], 403);
        }

        // Update user
        if (isset($validated['name'])) {
            $user->name = $validated['name'];
        }

        if (isset($validated['email'])) {
            $user->email = $validated['email'];
        }

        if (isset($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        if (isset($validated['role']) && $currentUser->role === 'admin') {
            $user->role = $validated['role'];
        }

        if (isset($validated['two_factor_enabled'])) {
            $user->two_factor_enabled = $validated['two_factor_enabled'];
        }

        $user->save();

        return response()->json([
            'message' => 'User updated successfully',
            'data' => $user
        ], 200);
    }

    /**
     * Remove the specified user.
     * Accessible by: Admin only
     */
    public function destroy($id)
    {
        // Check if user is admin
        if (Auth::user()->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only admins can delete users.'
            ], 403);
        }

        // Find user
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'message' => 'User not found'
            ], 404);
        }

        // Prevent deleting yourself
        if (Auth::user()->id === $user->id) {
            return response()->json([
                'message' => 'You cannot delete your own account'
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully'
        ], 200);
    }
}