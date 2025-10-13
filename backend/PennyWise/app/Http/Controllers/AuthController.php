<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    protected $otpService;

    public function __construct(OtpService $otpService)
    {
        $this->otpService = $otpService;
    }

    public function register(Request $request)
    {
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

    public function login(Request $request)
    {
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

        // Check if 2FA is enabled
        if ($user->two_factor_enabled) {
            // Generate and send OTP
            $this->otpService->generateOtp($user);

            return response([
                'message' => 'OTP sent to your email. Please verify to continue.',
                'two_factor_required' => true,
                'user_id' => $user->id
            ], 200);
        }

        // If 2FA is not enabled, login normally
        $token = $user->createToken($user->name)->plainTextToken;

        return response([
            'user' => $user,
            'role' => $user->role,
            'token' => $token,
            'two_factor_required' => false
        ], 200);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'otp' => 'required|string|size:6'
        ]);

        $user = User::findOrFail($request->user_id);

        // Verify OTP
        $verification = $this->otpService->verifyOtp($user, $request->otp);

        if (!$verification['valid']) {
            return response([
                'message' => $verification['message']
            ], 401);
        }

        // Generate token after successful OTP verification
        $token = $user->createToken($user->name)->plainTextToken;

        return response([
            'message' => 'Login successful.',
            'user' => $user,
            'role' => $user->role,
            'token' => $token
        ], 200);
    }

    public function resendOtp(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $user = User::findOrFail($request->user_id);

        if (!$user->two_factor_enabled) {
            return response([
                'message' => '2FA is not enabled for this account.'
            ], 400);
        }

        // Generate and send new OTP
        $this->otpService->generateOtp($user);

        return response([
            'message' => 'New OTP sent to your email.'
        ], 200);
    }

    public function enable2FA(Request $request)
    {
        $user = $request->user();

        $user->update(['two_factor_enabled' => true]);

        return response([
            'message' => '2FA has been enabled successfully.',
            'two_factor_enabled' => true
        ], 200);
    }

    public function disable2FA(Request $request)
    {
        $user = $request->user();

        $user->update(['two_factor_enabled' => false]);

        return response([
            'message' => '2FA has been disabled successfully.',
            'two_factor_enabled' => false
        ], 200);
    }

    public function logout(Request $request)
    {
        $request->user()->tokens()->delete();

        return response([
            'message' => 'Logged out successfully.'
        ], 200);
    }
}