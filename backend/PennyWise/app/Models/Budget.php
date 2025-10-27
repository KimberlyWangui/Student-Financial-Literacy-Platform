<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Budget extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'budgets';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'budget_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'category',
        'amount',
        'start_date',
        'end_date',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'amount' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the student that owns the budget.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get financial data (expenses) related to this budget.
     */
    public function expenses()
    {
        return $this->hasMany(FinancialData::class, 'student_id', 'student_id')
            ->where('entry_type', 'expense')
            ->where('category', $this->category)
            ->whereBetween('entry_date', [$this->start_date, $this->end_date]);
    }

    /**
     * Calculate total spent in this budget period.
     *
     * @return float
     */
    public function getTotalSpentAttribute(): float
    {
        $spent = FinancialData::where('student_id', $this->student_id)
            ->where('entry_type', 'expense')
            ->where('category', $this->category)
            ->whereBetween('entry_date', [$this->start_date, $this->end_date])
            ->sum('amount');

        return (float) $spent;
    }

    /**
     * Calculate remaining budget.
     *
     * @return float
     */
    public function getRemainingBudgetAttribute(): float
    {
        $remaining = $this->amount - $this->total_spent;
        return max($remaining, 0);
    }

    /**
     * Calculate budget usage percentage.
     *
     * @return float
     */
    public function getUsagePercentageAttribute(): float
    {
        if ($this->amount <= 0) {
            return 0;
        }

        $percentage = ($this->total_spent / $this->amount) * 100;
        return round($percentage, 2);
    }

    /**
     * Check if budget is exceeded.
     *
     * @return bool
     */
    public function getIsExceededAttribute(): bool
    {
        return $this->total_spent > $this->amount;
    }

    /**
     * Check if budget is active (current date within period).
     *
     * @return bool
     */
    public function getIsActiveAttribute(): bool
    {
        $now = Carbon::now();
        return $now->between($this->start_date, $this->end_date);
    }

    /**
     * Check if budget has expired.
     *
     * @return bool
     */
    public function getIsExpiredAttribute(): bool
    {
        return Carbon::now()->isAfter($this->end_date);
    }

    /**
     * Get the number of days remaining in the budget period.
     *
     * @return int
     */
    public function getDaysRemainingAttribute(): int
    {
        if ($this->is_expired) {
            return 0;
        }

        return max(0, Carbon::now()->diffInDays($this->end_date, false));
    }

    /**
     * Scope a query to only include budgets for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to only include active budgets.
     */
    public function scopeActive($query)
    {
        $now = Carbon::now();
        return $query->where('start_date', '<=', $now)
                    ->where('end_date', '>=', $now);
    }

    /**
     * Scope a query to only include expired budgets.
     */
    public function scopeExpired($query)
    {
        return $query->where('end_date', '<', Carbon::now());
    }

    /**
     * Scope a query to only include upcoming budgets.
     */
    public function scopeUpcoming($query)
    {
        return $query->where('start_date', '>', Carbon::now());
    }

    /**
     * Get the available budget categories.
     *
     * @return array
     */
    public static function getCategories(): array
    {
        return [
            'food',
            'transport',
            'accommodation',
            'books & supplies',
            'entertainment',
            'utilities',
            'clothing',
            'healthcare',
            'other expense'
        ];
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'total_spent',
        'remaining_budget',
        'usage_percentage',
        'is_exceeded',
        'is_active',
        'is_expired',
        'days_remaining'
    ];
}