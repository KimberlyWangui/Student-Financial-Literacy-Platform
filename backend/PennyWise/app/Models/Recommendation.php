<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Recommendation extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'recommendations';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'recommendation_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'title',
        'recomm_text',
        'category',
        'confidence_score',
        'reasoning',
        'impact_estimate',
        'source_type',
        'model_version',
        'status',
        'feedback',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'confidence_score' => 'decimal:2',
        'impact_estimate' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the student that owns the recommendation.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Scope a query to only include recommendations for a specific student.
     */
    public function scopeForStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    /**
     * Scope a query to filter by status.
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope a query to filter by category.
     */
    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Scope a query to filter by source type.
     */
    public function scopeBySourceType($query, $sourceType)
    {
        return $query->where('source_type', $sourceType);
    }

    /**
     * Get available recommendation categories.
     *
     * @return array
     */
    public static function getCategories(): array
    {
        return [
            'Budget',
            'Goal',
            'Saving',
            'Spending',
            'Income',
            'General'
        ];
    }

    /**
     * Get available statuses.
     *
     * @return array
     */
    public static function getStatuses(): array
    {
        return [
            'pending',
            'viewed',
            'accepted',
            'rejected',
            'ignored'
        ];
    }

    /**
     * Get available source types.
     *
     * @return array
     */
    public static function getSourceTypes(): array
    {
        return [
            'AI_Model',
            'Admin',
            'System_Rule'
        ];
    }
}