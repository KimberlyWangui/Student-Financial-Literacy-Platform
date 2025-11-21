<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

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
        'goal_type',
        'status',
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
     * Get the route key for the model.
     * This allows using 'id' in routes while the actual column is 'goal_id'
     */
    public function getRouteKeyName()
    {
        return 'goal_id';
    }

    /**
     * Override the id attribute to return goal_id
     */
    public function getIdAttribute()
    {
        return $this->goal_id;
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
        return $this->status === 'completed' || $this->current_amount >= $this->target_amount;
    }

    /**
     * Check if the deadline has passed.
     *
     * @return bool
     */
    public function getIsOverdueAttribute(): bool
    {
        return $this->status === 'in-progress' && Carbon::parse($this->deadline)->isPast();
    }

    /**
     * Automatically update status based on current_amount and deadline.
     */
    public function updateStatus(): void
    {
        $now = Carbon::now();

        // Check if goal is completed
        if ($this->current_amount >= $this->target_amount) {
            $this->status = 'completed';
        }
        // Check if deadline has passed and goal not completed
        elseif ($now->isAfter($this->deadline)) {
            $this->status = 'missed';
        }
        // Otherwise, goal is in progress
        else {
            $this->status = 'in-progress';
        }

        $this->save();
    }

    /**
     * Scope a query to only include goals for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to only include active goals (in-progress status).
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'in-progress');
    }

    /**
     * Scope a query to only include completed goals.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope a query to only include missed goals.
     */
    public function scopeMissed($query)
    {
        return $query->where('status', 'missed');
    }

    /**
     * Scope a query to filter by goal type.
     */
    public function scopeByType($query, $type)
    {
        return $query->where('goal_type', $type);
    }

    /**
     * Scope a query to filter by status.
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Get the available goal types.
     *
     * @return array
     */
    public static function getGoalTypes(): array
    {
        return [
            'short-term',
            'long-term'
        ];
    }

    /**
     * Get the available goal statuses.
     *
     * @return array
     */
    public static function getStatuses(): array
    {
        return [
            'in-progress',
            'completed',
            'missed'
        ];
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'id', // Add id to appends
        'progress_percentage',
        'remaining_amount',
        'is_completed',
        'is_overdue'
    ];
}