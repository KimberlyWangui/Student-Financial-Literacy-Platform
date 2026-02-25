<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

/**
 * @property int $profile_id
 * @property int $student_id
 * @property string|null $year_of_study
 * @property string|null $living_situation
 * @property string|null $monthly_allowance_range
 * @property string|null $course
 * @property \Illuminate\Support\Carbon|null $birth_date
 * @property string|null $gender
 * @property int $xp_total Total XP points earned by the student
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read int|null $age
 * @property-read string|null $formatted_birth_date
 * @property-read bool|null $is_adult
 * @property-read int $xp_level
 * @property-read int $xp_needed
 * @property-read int $xp_progress
 * @property-read \App\Models\User $student
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereBirthDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereCourse($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereGender($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereLivingSituation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereMonthlyAllowanceRange($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereStudentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereXpTotal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|StudentProfile whereYearOfStudy($value)
 * @mixin \Eloquent
 */
class StudentProfile extends Model
{
    use HasFactory;

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'profile_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'student_id',
        'year_of_study',
        'living_situation',
        'monthly_allowance_range',
        'course',
        'birth_date',
        'gender',
        'xp_total',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'birth_date' => 'date',
        'xp_total' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user (student) that owns the profile.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Calculate age from birth_date.
     *
     * @return int|null
     */
    public function getAgeAttribute(): ?int
    {
        if (!$this->birth_date) {
            return null;
        }

        return Carbon::parse($this->birth_date)->age;
    }

    /**
     * Get formatted birth date.
     *
     * @return string|null
     */
    public function getFormattedBirthDateAttribute(): ?string
    {
        if (!$this->birth_date) {
            return null;
        }

        return Carbon::parse($this->birth_date)->format('F j, Y');
    }

    /**
     * Check if the student is an adult (18+).
     *
     * @return bool|null
     */
    public function getIsAdultAttribute(): ?bool
    {
        if (!$this->age) {
            return null;
        }

        return $this->age >= 18;
    }

    /**
     * Get the XP level based on total XP.
     *
     * @return int
     */
    public function getXpLevelAttribute(): int
    {
        // Level calculation: Every 100 XP = 1 level
        return (int) floor($this->xp_total / 100) + 1;
    }

    /**
     * Get XP progress to next level.
     *
     * @return int
     */
    public function getXpProgressAttribute(): int
    {
        return $this->xp_total % 100;
    }

    /**
     * Get XP needed for next level.
     *
     * @return int
     */
    public function getXpNeededAttribute(): int
    {
        return 100 - $this->xp_progress;
    }

    /**
     * Add XP to the student profile.
     *
     * @param int $xp
     * @return void
     */
    public function addXp(int $xp): void
    {
        $this->xp_total += $xp;
        $this->save();
    }

    /**
     * Get the available monthly allowance ranges.
     *
     * @return array
     */
    public static function getAllowanceRanges(): array
    {
        return [
            '0 – 5,000',
            '5,001 – 10,000',
            '10,001 – 20,000',
            '20,001 – 35,000',
            '35,001 – 50,000+'
        ];   
    }

    /**
     * Get the available gender options.
     *
     * @return array
     */
    public static function getGenderOptions(): array
    {
        return [
            'male',
            'female',
            'other',
            'prefer_not_to_say'
        ];
    }

    /**
     * Get the available years of study.
     *
     * @return array
     */
    public static function getYearsOfStudy(): array
    {
        return [
            'one',
            'two',
            'three',
            'four',
            'five',
            'six'
        ];
    }

    /**
     * Get the available living situations.
     *
     * @return array
     */
    public static function getLivingSituations(): array
    {
        return [
            'Home',
            'Hostel',
            'Shared Apartment',
            'Solo Apartment',
            'Other'
        ];
    }

    /**
     * Append custom attributes to JSON responses.
     */
    protected $appends = [
        'age',
        'formatted_birth_date',
        'is_adult',
        'xp_level',
        'xp_progress',
        'xp_needed'
    ];
}