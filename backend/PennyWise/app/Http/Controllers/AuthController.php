<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request){
        $fields = $request->validate([
            'name' => 'required|string',
            'email' => 'required|string|unique:users,email',
            'password' => 'required|string|confirmed'
        ]);

        $user = User::create($fields);

        $token = $user->createToken($request->name)->plainTextToken;

        return response([
            'user' => $user,
            'role' => $user->role,
            'token' => $token
        ], 201);
    }

    public function login(Request $request){
        $request->validate([
            'email' => 'required|string|exists:users,email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response([
                'message' => 'Incorrect password.'
            ], 401);
        }

        $token = $user->createToken($user->name)->plainTextToken;
        return response([
            'user' => $user,
            'role' => $user->role,
            'token' => $token
        ], 200);
    }

    public function logout(Request $request){
        $request->user()->tokens()->delete();
        return response([
            'message' => 'Logged out successfully.'
        ], 200);
    }
}
