<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Illuminate\Support\Facades\Auth;

class GoogleAuthController extends Controller
{
    /**
     * Redirect the user to Google's OAuth authorization page.
     */
    public function redirectToGoogle()
    {
        $redirectUrl = Socialite::with('google')
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return response()->json([
            'message' => 'Redirect user to Google for authentication.',
            'redirect_url' => $redirectUrl
        ]);
    }

    /**
     * Handle Google callback and authenticate or register the user.
     */
    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::with('google')
                ->stateless()
                ->user();
            $user = User::updateOrCreate(
                ['email' => $googleUser->getEmail()],
                [
                    'name' => $googleUser->getName(),
                    'google_id' => $googleUser->getId(),
                    'password' => bcrypt(Str::random(16)),
                ]
            );

            $token = $user->createToken($user->name)->plainTextToken;

            return response()->json([
                'message' => 'User logged in with Google successfully.',
                'user' => $user,
                'role' => $user->role,
                'token' => $token,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Authentication with Google failed.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}