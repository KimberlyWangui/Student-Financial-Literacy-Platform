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
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $role
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 * @property string $password
 * @property bool $two_factor_enabled
 * @property string|null $remember_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read int|null $badges_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Budget> $budgets
 * @property-read int|null $budgets_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\FinancialData> $financialData
 * @property-read int|null $financial_data_count
 * @property-read int $badge_count
 * @property-read int $level
 * @property-read int $total_xp
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Goal> $goals
 * @property-read int|null $goals_count
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection<int, \Illuminate\Notifications\DatabaseNotification> $notifications
 * @property-read int|null $notifications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\UserOtp> $otps
 * @property-read int|null $otps_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Recommendation> $recommendations
 * @property-read int|null $recommendations_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Simulation> $simulations
 * @property-read int|null $simulations_count
 * @property-read \App\Models\StudentProfile|null $studentProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property-read int|null $tokens_count
 * @method static \Database\Factories\UserFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmailVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRememberToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereTwoFactorEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUpdatedAt($value)
 * @mixin \Eloquent
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
     * 
     * IMPORTANT: Make sure to use withPivot() to include pivot table columns
     */
    public function badges()
    {
        return $this->belongsToMany(
            Badge::class,
            'student_badges',
            'student_id',
            'badge_id',
            'id',
            'badge_id'
        )->withPivot('earned_at', 'xp_earned');
    }

    /**
     * Check if user has earned a specific badge.
     */
    public function hasBadge($badgeId): bool
    {
        return $this->badges()
            ->where('badges.badge_id', $badgeId)
            ->exists();
    }

    /**
     * Award a badge to the user with XP reward.
     * 
     * @param int $badgeId The ID of the badge to award
     * @param int $xpEarned The XP points to award (default: 0)
     * @return bool True if badge was awarded, false if already has badge
     */
    public function awardBadge(int $badgeId, int $xpEarned = 0): bool
    {
        // Check if already has badge
        if ($this->hasBadge($badgeId)) {
            return false;
        }

        // Attach badge with XP
        $this->badges()->attach($badgeId, [
            'earned_at' => now(),
            'xp_earned' => $xpEarned
        ]);

        // Add XP to student profile if student and XP > 0
        if ($xpEarned > 0 && $this->role === 'student') {
            $profile = $this->studentProfile;
            if ($profile) {
                $profile->addXp($xpEarned);
            }
        }

        return true;
    }

    /**
     * Remove a badge from the user.
     * Also removes the XP that was earned from this badge.
     * 
     * @param int $badgeId The ID of the badge to remove
     * @return bool True if badge was removed
     */
    public function removeBadge(int $badgeId): bool
    {
        // Get the badge's XP before removing
        $badge = $this->badges()->where('badge_id', $badgeId)->first();
        
        if (!$badge) {
            return false;
        }

        $xpToRemove = $badge->pivot->xp_earned ?? 0;

        // Detach the badge
        $this->badges()->detach($badgeId);

        // Remove XP from student profile if student and XP > 0
        if ($xpToRemove > 0 && $this->role === 'student') {
            $profile = $this->studentProfile;
            if ($profile) {
                // Ensure XP doesn't go below 0
                $newXp = max(0, $profile->xp_total - $xpToRemove);
                $profile->xp_total = $newXp;
                $profile->save();
            }
        }

        return true;
    }

    /**
     * Get total XP earned by the user.
     * 
     * @return int Total XP points
     */
    public function getTotalXpAttribute(): int
    {
        if ($this->role !== 'student') {
            return 0;
        }

        $profile = $this->studentProfile;
        return $profile ? $profile->xp_total : 0;
    }

    /**
     * Get the user's current level based on XP.
     * 
     * @return int Current level
     */
    public function getLevelAttribute(): int
    {
        if ($this->role !== 'student') {
            return 0;
        }

        $profile = $this->studentProfile;
        return $profile ? $profile->xp_level : 0;
    }

    /**
     * Get the count of badges earned by the user.
     * 
     * @return int Number of badges earned
     */
    public function getBadgeCountAttribute(): int
    {
        return $this->badges()->count();
    }
}