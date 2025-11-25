<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvestmentSimulation extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'investment_simulations';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'simulation_id';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'student_id',
        'investment_type',
        'amount_invested',
        'duration_value',
        'duration_unit',
        'duration_months',
        'monthly_topup',
        'reinvestment_frequency',
        'target_amount',
        'projected_final_value',
        'total_invested',
        'total_growth',
        'percentage_return',
        'annualized_return',
        'risk_level',
        'volatility',
        'best_case_scenario',
        'worst_case_scenario',
        'median_scenario',
        'confidence_95_lower',
        'confidence_95_upper',
        'model_parameters',
        'timeline',
        'goal_analysis',
        'simulation_reference',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'amount_invested' => 'decimal:2',
        'duration_value' => 'integer',
        'duration_months' => 'integer',
        'monthly_topup' => 'decimal:2',
        'target_amount' => 'decimal:2',
        'projected_final_value' => 'decimal:2',
        'total_invested' => 'decimal:2',
        'total_growth' => 'decimal:2',
        'percentage_return' => 'decimal:2',
        'annualized_return' => 'decimal:2',
        'volatility' => 'decimal:2',
        'best_case_scenario' => 'decimal:2',
        'worst_case_scenario' => 'decimal:2',
        'median_scenario' => 'decimal:2',
        'confidence_95_lower' => 'decimal:2',
        'confidence_95_upper' => 'decimal:2',
        'model_parameters' => 'array',
        'timeline' => 'array',
        'goal_analysis' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the student that owns the simulation.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Scope a query to only include simulations for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to order by most recent.
     */
    public function scopeRecent($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Scope to filter by investment type.
     */
    public function scopeByType($query, $type)
    {
        return $query->where('investment_type', $type);
    }

    /**
     * Get the investment type display name.
     */
    public function getInvestmentTypeNameAttribute(): string
    {
        $names = [
            'mmf' => 'Money Market Fund',
            'tbill' => 'Treasury Bill',
            'stock' => 'Stock Market',
            'bond' => 'Government Bond',
        ];

        return $names[$this->investment_type] ?? $this->investment_type;
    }

    /**
     * Get formatted duration.
     */
    public function getFormattedDurationAttribute(): string
    {
        return "{$this->duration_value} {$this->duration_unit}";
    }

    /**
     * Get ROI as percentage string.
     */
    public function getRoiPercentageAttribute(): float
    {
        if ($this->total_invested <= 0) {
            return 0;
        }

        return round(($this->total_growth / $this->total_invested) * 100, 2);
    }

    /**
     * Check if target goal was set.
     */
    public function hasTargetGoal(): bool
    {
        return !is_null($this->target_amount) && $this->target_amount > 0;
    }

    /**
     * Check if target goal is achievable.
     */
    public function isGoalAchievable(): bool
    {
        if (!$this->hasTargetGoal() || !$this->goal_analysis) {
            return false;
        }

        return $this->goal_analysis['achievable'] ?? false;
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'investment_type_name',
        'formatted_duration',
        'roi_percentage',
    ];
}