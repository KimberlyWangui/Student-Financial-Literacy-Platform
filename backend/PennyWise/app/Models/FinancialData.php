<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinancialData extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'financial_data';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'entry_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'entry_type',
        'category',
        'amount',
        'entry_date',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'amount' => 'decimal:2',
        'entry_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the student that owns the financial entry.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get the available entry types.
     *
     * @return array
     */
    public static function getEntryTypes(): array
    {
        return [
            'income',
            'expense'
        ];
    }

    /**
     * Get the available categories.
     *
     * @return array
     */
    public static function getCategories(): array
    {
        return [
            // Income categories
            'allowance',
            'scholarship',
            'part-time job',
            'gift',
            'other income',
            
            // Expense categories
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
     * Scope a query to only include entries for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to only include entries of a specific type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('entry_type', $type);
    }

    /**
     * Scope a query to filter by date range.
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('entry_date', [$startDate, $endDate]);
    }
}