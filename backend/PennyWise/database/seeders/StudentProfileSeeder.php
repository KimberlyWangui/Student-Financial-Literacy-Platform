<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\StudentProfile;
use Carbon\Carbon;

class StudentProfileSeeder extends Seeder
{
    public function run(): void
    {
        $students = User::where('role', 'student')->get();

        if ($students->isEmpty()) {
            $this->command->warn('⚠ No students found. Please run UsersTableSeeder first.');
            return;
        }

        $allowanceRanges = [
            '0 – 5,000',
            '5,001 – 10,000',
            '10,001 – 20,000',
            '20,001 – 35,000',
            '35,001 – 50,000+',
        ];

        $genders = ['male', 'female', 'other', 'prefer_not_to_say'];
        $livingSituations = ['Home', 'Hostel', 'Shared Apartment', 'Solo Apartment'];
        $yearsOfStudy = ['one', 'two', 'three', 'four'];

        $courses = [
            'Computer Science', 'Business Administration', 'Engineering', 
            'Medicine', 'Law', 'Economics', 'Education', 'Agriculture',
            'Architecture', 'Nursing', 'Pharmacy', 'Psychology',
            'Information Technology', 'Accounting', 'Marketing'
        ];

        // Distribute allowance ranges among all students proportionally
        $students->each(function ($student, $index) use (
            $allowanceRanges, $genders, $livingSituations, $yearsOfStudy, $courses
        ) {
            // Distribute allowance based on index position to simulate diversity
            $rangeIndex = match (true) {
                $index % 10 < 2 => 0, // 20% low (0 – 5,000)
                $index % 10 < 4 => 1, // 20% slightly low (5,001 – 10,000)
                $index % 10 < 7 => 2, // 30% medium (10,001 – 20,000)
                $index % 10 < 9 => 3, // 20% upper-medium (20,001 – 35,000)
                default => 4,          // 10% high (35,001 – 50,000+)
            };

            // Generate realistic age for university students (18-26 years old)
            $age = rand(18, 26);
            
            // Create birth date from age (subtract years and add random days for variation)
            $birthDate = Carbon::now()
                ->subYears($age)
                ->subDays(rand(1, 365))
                ->format('Y-m-d');

            StudentProfile::create([
                'student_id' => $student->id,
                'year_of_study' => $yearsOfStudy[array_rand($yearsOfStudy)],
                'living_situation' => $livingSituations[array_rand($livingSituations)],
                'monthly_allowance_range' => $allowanceRanges[$rangeIndex],
                'course' => $courses[array_rand($courses)],
                'birth_date' => $birthDate,
                'gender' => $genders[array_rand($genders)],
            ]);
        });

        $this->command->info('✅ Student profiles successfully created for ' . $students->count() . ' users.');
        
        // Show age distribution
        $profiles = StudentProfile::all();
        $averageAge = $profiles->avg(function ($profile) {
            return Carbon::parse($profile->birth_date)->age;
        });
        
        $this->command->info('📊 Average student age: ' . round($averageAge, 1) . ' years');
    }
}