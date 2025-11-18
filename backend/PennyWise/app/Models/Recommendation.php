<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $recommendation_id
 * @property int $student_id
 * @property string $title
 * @property string $recomm_text
 * @property string $category
 * @property numeric|null $confidence_score
 * @property string|null $reasoning
 * @property numeric|null $impact_estimate
 * @property string $source_type
 * @property string|null $model_version
 * @property string $status
 * @property string|null $feedback
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation byCategory($category)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation bySourceType($sourceType)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation byStatus($status)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation forStudent($studentId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereConfidenceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereFeedback($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereImpactEstimate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereModelVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereReasoning($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereRecommText($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereRecommendationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereSourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Recommendation whereUpdatedAt($value)
 * @mixin \Eloquent
 */
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