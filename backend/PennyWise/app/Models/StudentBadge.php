<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property int $student_id
 * @property int $badge_id
 * @property \Illuminate\Support\Carbon $earned_at
 * @property int $xp_earned XP points earned when this badge was awarded
 * @property-read \App\Models\Badge $badge
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge whereBadgeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge whereEarnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentBadge whereXpEarned($value)
 * @mixin \Eloquent
 */
class StudentBadge extends Pivot
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'student_badges';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;  // CHANGED to true

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'badge_id',
        'earned_at',
        'xp_earned'
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'earned_at' => 'datetime',
        'xp_earned' => 'integer',
    ];

    /**
     * Get the student that earned the badge.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get the badge that was earned.
     */
    public function badge()
    {
        return $this->belongsTo(Badge::class, 'badge_id', 'badge_id');
    }
}