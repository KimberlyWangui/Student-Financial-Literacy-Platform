<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

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
            if (empty($googleUser['email']) || empty($googleUser['id'])) {
                throw new \Exception('Google did not return an email address');
            }
            if (($googleUser['verified_email'] ?? false) !== true) {
                throw new \Exception('Google email is not verified');
            }

            $user = User::where('email', $googleUser['email'])->first();

            if ($user) {
                // Existing account: link Google to it, and never touch the password.
                if (empty($user->google_id)) {
                    $user->google_id = $googleUser['id'];
                    $user->save();
                } elseif ($user->google_id !== $googleUser['id']) {
                    throw new \Exception('This email is linked to a different Google account');
                }
            } else {
                // First time here: create a student account.
                $user = new User();
                $user->name = $googleUser['name'] ?? $googleUser['email'];
                $user->email = $googleUser['email'];
                $user->google_id = $googleUser['id'];
                $user->password = bcrypt(Str::random(32));
                $user->role = 'student';
                $user->email_verified_at = now();
                $user->save();
            }

            // One-time code, valid for 60 seconds. The real token is created later, only when it is exchanged.
            $code = Str::random(48);
            Cache::put('google_login:' . $code, $user->id, now()->addSeconds(60));

            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            return redirect($frontendUrl . '/auth/google/success?code=' . $code);

        } catch (\Exception $e) {
            Log::error('Google OAuth error: ' . $e->getMessage());
            
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            $error = urlencode('Google authentication failed');
            return redirect($frontendUrl . '/signin?error=' . $error);
        }
    }

    /**
     * Swap a one-time code for a login token. The code works once.
     */
    public function exchange(Request $request)
    {
        $request->validate(['code' => 'required|string|max:100']);

        $userId = Cache::pull('google_login:' . $request->input('code'));
        $user = $userId ? User::find($userId) : null;

        if (! $user) {
            return response()->json(['message' => 'This sign-in has expired. Please try again.'], 422);
        }

        return response()->json([
            'token' => $user->createToken($user->name)->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'student',
            ],
            'role' => $user->role ?? 'student',
        ]);
    }
}