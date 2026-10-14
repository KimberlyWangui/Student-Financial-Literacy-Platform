<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleAuthController extends Controller
{
    /**
     * Redirect the user to Google's OAuth authorization page.
     */
    public function redirectToGoogle()
    {
        $clientId = config('services.google.client_id');
        $redirectUri = config('services.google.redirect');
        
        $params = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'offline',
            'prompt' => 'consent',
        ]);

        $url = "https://accounts.google.com/o/oauth2/v2/auth?{$params}";

        return response()->json([
            'message' => 'Redirect user to Google for authentication.',
            'redirect_url' => $url
        ]);
    }

    /**
     * Handle Google callback
     */
    public function handleGoogleCallback(Request $request)
    {
        try {
            $code = $request->get('code');
            
            if (!$code) {
                throw new \Exception('No authorization code provided');
            }

            // Exchange code for access token
            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'code' => $code,
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'redirect_uri' => config('services.google.redirect'),
                'grant_type' => 'authorization_code',
            ]);

            $tokenData = $response->json();
            
            if (!isset($tokenData['access_token'])) {
                throw new \Exception('Failed to get access token');
            }

            // Get user info from Google
            $userResponse = Http::withToken($tokenData['access_token'])
                ->get('https://www.googleapis.com/oauth2/v2/userinfo');
            
            $googleUser = $userResponse->json();

            // Create or update user
            $user = User::updateOrCreate(
                ['email' => $googleUser['email']],
                [
                    'name' => $googleUser['name'],
                    'google_id' => $googleUser['id'],
                    'password' => bcrypt(Str::random(16)),
                ]
            );

            $token = $user->createToken($user->name)->plainTextToken;

            // Encode user data
            $authData = base64_encode(json_encode([
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'student'
                ],
                'role' => $user->role ?? 'student'
            ]));

            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            return redirect($frontendUrl . '/auth/google/success?data=' . $authData);

        } catch (\Exception $e) {
            Log::error('Google OAuth error: ' . $e->getMessage());
            
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            $error = urlencode('Google authentication failed');
            return redirect($frontendUrl . '/signin?error=' . $error);
        }
    }
}