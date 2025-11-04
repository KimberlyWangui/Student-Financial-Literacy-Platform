<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Simulation extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'simulations';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'simulation_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'principal',
        'interest_rate',
        'time_period',
        'result',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'principal' => 'decimal:2',
        'interest_rate' => 'decimal:2',
        'time_period' => 'integer',
        'result' => 'decimal:2',
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
     * Calculate compound interest result.
     * Formula: A = P(1 + r/n)^(nt)
     * Where:
     * A = Final amount
     * P = Principal amount
     * r = Annual interest rate (decimal)
     * n = Number of times interest is compounded per year
     * t = Time period in years
     *
     * @param float $principal
     * @param float $interestRate (as percentage, e.g., 5.5)
     * @param int $timePeriod (in months)
     * @param int $compoundingFrequency (times per year, default 12 for monthly)
     * @return float
     */
    public static function calculateCompoundInterest(
        float $principal,
        float $interestRate,
        int $timePeriod,
        int $compoundingFrequency = 12
    ): float {
        $rate = $interestRate / 100; // Convert percentage to decimal
        $years = $timePeriod / 12; // Convert months to years
        
        $result = $principal * pow(
            (1 + ($rate / $compoundingFrequency)),
            ($compoundingFrequency * $years)
        );
        
        return round($result, 2);
    }

    /**
     * Calculate simple interest result.
     * Formula: A = P(1 + rt)
     * Where:
     * A = Final amount
     * P = Principal amount
     * r = Interest rate (decimal)
     * t = Time period in years
     *
     * @param float $principal
     * @param float $interestRate (as percentage, e.g., 5.5)
     * @param int $timePeriod (in months)
     * @return float
     */
    public static function calculateSimpleInterest(
        float $principal,
        float $interestRate,
        int $timePeriod
    ): float {
        $rate = $interestRate / 100; // Convert percentage to decimal
        $years = $timePeriod / 12; // Convert months to years
        
        $result = $principal * (1 + ($rate * $years));
        
        return round($result, 2);
    }

    /**
     * Get the interest earned.
     *
     * @return float
     */
    public function getInterestEarnedAttribute(): float
    {
        return round($this->result - $this->principal, 2);
    }

    /**
     * Get the return on investment percentage.
     *
     * @return float
     */
    public function getRoiPercentageAttribute(): float
    {
        if ($this->principal <= 0) {
            return 0;
        }

        $roi = (($this->result - $this->principal) / $this->principal) * 100;
        return round($roi, 2);
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
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'interest_earned',
        'roi_percentage'
    ];
}