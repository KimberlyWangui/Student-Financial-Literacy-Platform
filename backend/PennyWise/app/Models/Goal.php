<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

/**
 * @property int $goal_id
 * @property int $student_id
 * @property string $goal_name
 * @property numeric $target_amount
 * @property string $goal_type
 * @property string $status
 * @property numeric $current_amount
 * @property \Illuminate\Support\Carbon $deadline
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read bool $is_completed
 * @property-read bool $is_overdue
 * @property-read float $progress_percentage
 * @property-read float $remaining_amount
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal byStatus($status)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal byType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal completed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal forStudent($studentId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal missed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereCurrentAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereDeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereGoalId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereGoalName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereGoalType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereTargetAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Goal whereUpdatedAt($value)
 * @mixin \Eloquent
 */
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
        'progress_percentage',
        'remaining_amount',
        'is_completed',
        'is_overdue'
    ];
}