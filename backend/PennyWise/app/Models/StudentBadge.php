<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

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
    public $timestamps = false;

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'earned_at' => 'datetime',
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