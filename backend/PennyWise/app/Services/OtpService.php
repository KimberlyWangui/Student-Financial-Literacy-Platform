<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserOtp;
use App\Notifications\SendOtpNotification;
use Carbon\Carbon;

class OtpService
{
    /**
     * Generate and send OTP to user
     */
    public function generateOtp(User $user)
    {
        // Delete old OTPs for this user
        UserOtp::where('user_id', $user->id)
            ->where('is_used', false)
            ->delete();

        // Generate 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store OTP in database
        UserOtp::create([
            'user_id' => $user->id,
            'otp' => $otp,
            'expires_at' => Carbon::now()->addMinutes(10),
            'is_used' => false
        ]);

        // Send OTP via email
        $user->notify(new SendOtpNotification($otp));

        return true;
    }

    /**
     * Verify OTP
     */
    public function verifyOtp(User $user, string $otp)
    {
        $userOtp = UserOtp::where('user_id', $user->id)
            ->where('otp', $otp)
            ->where('is_used', false)
            ->latest()
            ->first();

        if (!$userOtp) {
            return [
                'valid' => false,
                'message' => 'Invalid OTP code.'
            ];
        }

        if ($userOtp->isExpired()) {
            return [
                'valid' => false,
                'message' => 'OTP code has expired.'
            ];
        }

        // Mark OTP as used
        $userOtp->update(['is_used' => true]);

        return [
            'valid' => true,
            'message' => 'OTP verified successfully.'
        ];
    }
}