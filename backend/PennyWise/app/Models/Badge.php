<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
        'criteria',
        'image_url',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the students that have earned this badge.
     */
    public function students()
    {
        return $this->belongsToMany(
            User::class,
            'student_badges',
            'badge_id',
            'student_id'
        )->withPivot('earned_at');
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
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'image_url_full',
        'earned_count'
    ];
}