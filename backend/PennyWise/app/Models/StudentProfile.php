<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

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
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'birth_date' => 'date',
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
        'is_adult'
    ];
}