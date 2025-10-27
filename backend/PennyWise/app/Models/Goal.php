<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Goal extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'goals';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'goal_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'goal_name',
        'target_amount',
        'current_amount',
        'deadline',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'target_amount' => 'decimal:2',
        'current_amount' => 'decimal:2',
        'deadline' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the student that owns the goal.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Calculate the progress percentage.
     *
     * @return float
     */
    public function getProgressPercentageAttribute(): float
    {
        if ($this->target_amount <= 0) {
            return 0;
        }

        $percentage = ($this->current_amount / $this->target_amount) * 100;
        return round(min($percentage, 100), 2);
    }

    /**
     * Calculate the remaining amount.
     *
     * @return float
     */
    public function getRemainingAmountAttribute(): float
    {
        $remaining = $this->target_amount - $this->current_amount;
        return max($remaining, 0);
    }

    /**
     * Check if the goal is completed.
     *
     * @return bool
     */
    public function getIsCompletedAttribute(): bool
    {
        return $this->current_amount >= $this->target_amount;
    }

    /**
     * Check if the deadline has passed.
     *
     * @return bool
     */
    public function getIsOverdueAttribute(): bool
    {
        return !$this->is_completed && \Carbon\Carbon::parse($this->deadline)->isPast();
    }

    /**
     * Scope a query to only include goals for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to only include active goals (not completed).
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('current_amount < target_amount');
    }

    /**
     * Scope a query to only include completed goals.
     */
    public function scopeCompleted($query)
    {
        return $query->whereRaw('current_amount >= target_amount');
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'progress_percentage',
        'remaining_amount',
        'is_completed',
        'is_overdue'
    ];
}