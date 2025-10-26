<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    protected $otpService;

    /**
     * Inject the OTP service for handling two-factor authentication.
     */
    public function __construct(OtpService $otpService)
    {
        $this->otpService = $otpService;
    }

    /**
     * Register a new user and issue an authentication token.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @bodyParam name string required The user's full name.
     * @bodyParam email string required The user's email address (must be unique).
     * @bodyParam password string required The user's password.
     * @bodyParam password_confirmation string required Confirmation of the password.
     */
    public function register(Request $request)
    {
        $fields = $request->validate([
            'name' => 'required|string',
            'email' => 'required|string|unique:users,email',
            'password' => 'required|string|confirmed',
        ]);

        $user = User::create($fields);

        $token = $user->createToken($request->name)->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully.',
            'user' => $user,
            'role' => $user->role,
            'token' => $token
        ], 201);
    }

    /**
     * Authenticate an existing user and trigger two-factor authentication.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @bodyParam email string required The registered email of the user.
     * @bodyParam password string required The account password.
     */
    public function login(Request $request)
{
    $request->validate([
        'email' => 'required|string|exists:users,email',
        'password' => 'required'
    ]);

    $user = User::where('email', $request->email)->first();

    // Check password validity
    if (!$user || !Hash::check($request->password, $user->password)) {
        return response()->json(['message' => 'Incorrect email or password.'], 401);
    }

    // OTP is now mandatory for everyone
    $this->otpService->generateOtp($user);

    return response()->json([
        'message' => 'OTP sent to your email. Please verify to continue.',
        'two_factor_required' => true,
        'user_id' => $user->id
    ], 200);
}


    /**
     * Verify the OTP for users and issue a login token.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @bodyParam user_id integer required The ID of the user verifying the OTP.
     * @bodyParam otp string required The 6-digit OTP sent to the user's email.
     */
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
            return response()->json([
                'message' => $verification['message']
            ], 401);
        }

        // Generate token after successful OTP verification
        $token = $user->createToken($user->name)->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'user' => $user,
            'role' => $user->role,
            'token' => $token
        ], 200);
    }

    /**
     * Resend OTP for users with 2FA enabled.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @bodyParam user_id integer required The ID of the user requesting a new OTP.
     */
    public function resendOtp(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $user = User::findOrFail($request->user_id);

        if (!$user->two_factor_enabled) {
            return response()->json([
                'message' => '2FA is not enabled for this account.'
            ], 400);
        }

        // Generate and send new OTP
        $this->otpService->generateOtp($user);

        return response()->json([
            'message' => 'New OTP sent to your email.'
        ], 200);
    }


    /**
     * Log out the authenticated user and revoke their tokens.
     *
     * @authenticated
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        $request->user()->tokens()->delete();

        return response()->json([
            'message' => 'Logged out successfully.'
        ], 200);
    }
}