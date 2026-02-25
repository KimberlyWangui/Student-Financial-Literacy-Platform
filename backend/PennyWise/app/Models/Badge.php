<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $badge_id
 * @property string $badge_name
 * @property string $description
 * @property string $criteria_type
 * @property int $criteria_value The threshold value to earn this badge
 * @property int $xp_reward XP points awarded when badge is earned
 * @property string|null $image_url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $criteria_description
 * @property-read int $earned_count
 * @property-read string|null $image_url_full
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $students
 * @property-read int|null $students_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereBadgeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereBadgeName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereCriteriaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereCriteriaValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereImageUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereXpReward($value)
 * @mixin \Eloquent
 */
class Badge extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'badges';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'badge_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'badge_name',
        'description',
        'criteria_type',
        'criteria_value',
        'xp_reward',
        'image_url',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'criteria_value' => 'integer',
        'xp_reward' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the students that have earned this badge.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function students()
    {
        return $this->belongsToMany(
            User::class,
            'student_badges',
            'badge_id',
            'student_id',
            'badge_id', // Badge uses badge_id as primary key
            'id'        // User uses id as primary key
        )
        ->withPivot('earned_at', 'xp_earned');
    }

    /**
     * Get the full URL for the badge image.
     *
     * @return string|null
     */
    public function getImageUrlFullAttribute(): ?string
    {
        if (!$this->image_url) {
            return null;
        }

        // If it's already a full URL, return it
        if (filter_var($this->image_url, FILTER_VALIDATE_URL)) {
            return $this->image_url;
        }

        // Otherwise, prepend the app URL
        return url($this->image_url);
    }

    /**
     * Get the count of students who earned this badge.
     *
     * @return int
     */
    public function getEarnedCountAttribute(): int
    {
        return $this->students()->count();
    }

    /**
     * Get formatted criteria description.
     *
     * @return string
     */
    public function getCriteriaDescriptionAttribute(): string
    {
        return match ($this->criteria_type) {
            'transaction_count' => "Add {$this->criteria_value} " . ($this->criteria_value == 1 ? 'transaction' : 'transactions'),
            'expense_streak' => "Track expenses for {$this->criteria_value} consecutive days",
            'created_budget' => "Create {$this->criteria_value} " . ($this->criteria_value == 1 ? 'budget' : 'budgets'),
            'stayed_under_budget' => "Stay under budget for {$this->criteria_value} " . ($this->criteria_value == 1 ? 'month' : 'months'),
            'goal_count' => "Create {$this->criteria_value} " . ($this->criteria_value == 1 ? 'goal' : 'goals'),
            'completed_goal_count' => "Complete {$this->criteria_value} " . ($this->criteria_value == 1 ? 'goal' : 'goals'),
            default => 'Unknown criteria'
        };
    }

    /**
     * Get available criteria types.
     *
     * @return array
     */
    public static function getCriteriaTypes(): array
    {
        return [
            'transaction_count',
            'expense_streak',
            'created_budget',
            'stayed_under_budget',
            'goal_count',
            'completed_goal_count'
        ];
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'image_url_full',
        'earned_count',
        'criteria_description'
    ];
}