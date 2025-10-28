<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Auth\Passwords\CanResetPassword;
use App\Notifications\ResetPasswordNotification;

/**
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Badge> $badges
 * @method \Illuminate\Database\Eloquent\Relations\BelongsToMany badges()
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, CanResetPassword;

    protected $fillable = [
        'name',
        'email',
        'role',
        'password',
        'two_factor_enabled'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_enabled' => 'boolean'
        ];
    }

    public function sendPasswordResetNotification($token)
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function otps()
    {
        return $this->hasMany(UserOtp::class);
    }

    public function studentProfile()
    {
        return $this->hasOne(StudentProfile::class, 'student_id');
    }

    public function financialData()
    {
        return $this->hasMany(FinancialData::class, 'student_id');
    }

    public function goals()
    {
        return $this->hasMany(Goal::class, 'student_id');
    }

    public function budgets()
    {
        return $this->hasMany(Budget::class, 'student_id');
    }

    public function recommendations()
    {
        return $this->hasMany(Recommendation::class, 'student_id');
    }

    public function simulations()
    {
        return $this->hasMany(Simulation::class, 'student_id');
    }

    /**
     * Get the badges earned by the user.
     */
    public function badges()
    {
        return $this->belongsToMany(
            Badge::class,
            'student_badges',
            'student_id',
            'badge_id'
        )->withPivot('earned_at');
    }

    /**
     * Check if user has earned a specific badge.
     */
    public function hasBadge($badgeId): bool
    {
        return $this->badges()->wherePivot('badge_id', $badgeId)->exists();
    }

    /**
     * Award a badge to the user.
     */
    public function awardBadge($badgeId)
    {
        if (!$this->hasBadge($badgeId)) {
            $this->badges()->attach($badgeId, ['earned_at' => now()]);
            return true;
        }
        return false;
    }

    /**
     * Remove a badge from the user.
     */
    public function removeBadge($badgeId)
    {
        return $this->badges()->detach($badgeId);
    }
}