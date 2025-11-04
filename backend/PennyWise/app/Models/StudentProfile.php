<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
     * Get the user (student) that owns the profile.
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
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
}