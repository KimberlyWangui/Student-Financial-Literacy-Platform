<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $entry_id
 * @property int $student_id
 * @property string $entry_type
 * @property string $category
 * @property string|null $payment_method e.g. cash, card, mobile_money
 * @property string|null $description optional free-text description
 * @property numeric $amount
 * @property \Illuminate\Support\Carbon $entry_date
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read mixed $id
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData byPaymentMethod($paymentMethod)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData dateRange($startDate, $endDate)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData forStudent($studentId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData ofType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereEntryDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereEntryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereEntryType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData wherePaymentMethod($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinancialData whereUpdatedAt($value)
 * @mixin \Eloquent
 */
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
        'payment_method',
        'description',
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
           'tuition_monthly',
           'housing',
           'food',
           'transportation',
           'books_supplies',
           'entertainment',
           'personal_care',
           'technology',
           'health_wellness',
           'miscellaneous',
        ];
    }

    /**
     * Get the available payment methods.
     *
     * @return array
     */
    public static function getPaymentMethods(): array
    {
        return [
            'cash',
            'card',
            'M-Pesa',
            'bank_transfer',
            'E-Wallet',
            'other'
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

    /**
     * Scope a query to filter by payment method.
     */
    public function scopeByPaymentMethod($query, $paymentMethod)
    {
        return $query->where('payment_method', $paymentMethod);
    }

    /**
     * Get the ID attribute.
     *
     * @return mixed
     */
    public function getIdAttribute()
    {
        return $this->entry_id;
    }
}