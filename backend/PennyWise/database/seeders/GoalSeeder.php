<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Goal;
use Carbon\Carbon;

class GoalSeeder extends Seeder
{
    public function run(): void
    {
        $students = User::where('role', 'student')->get();
        $totalGoals = 0;

        if ($students->isEmpty()) {
            $this->command->warn('⚠ No students found. Please seed Users first.');
            return;
        }

        // Goal templates with varied durations
        $goalTemplates = [
            ['goal_name' => 'Emergency Fund', 'target_amount' => [10000, 30000], 'duration_months' => 6],
            ['goal_name' => 'Buy Laptop', 'target_amount' => [40000, 80000], 'duration_months' => 8],
            ['goal_name' => 'Holiday Trip', 'target_amount' => [20000, 50000], 'duration_months' => 10],
            ['goal_name' => 'Project Funding', 'target_amount' => [5000, 15000], 'duration_months' => 4],
            ['goal_name' => 'Phone Upgrade', 'target_amount' => [25000, 60000], 'duration_months' => 6],
            ['goal_name' => 'Certification Course', 'target_amount' => [10000, 25000], 'duration_months' => 5],
            ['goal_name' => 'Birthday Celebration', 'target_amount' => [8000, 20000], 'duration_months' => 3],
            ['goal_name' => 'Savings Goal', 'target_amount' => [15000, 40000], 'duration_months' => 12],
            ['goal_name' => 'Buy Textbooks', 'target_amount' => [5000, 12000], 'duration_months' => 3],
            ['goal_name' => 'Internship Fund', 'target_amount' => [15000, 35000], 'duration_months' => 7],
            ['goal_name' => 'Club Membership', 'target_amount' => [3000, 10000], 'duration_months' => 2],
            ['goal_name' => 'Charity Donation', 'target_amount' => [2000, 15000], 'duration_months' => 4],
            ['goal_name' => 'Gadget Purchase', 'target_amount' => [10000, 40000], 'duration_months' => 5],
            ['goal_name' => 'Side Hustle Investment', 'target_amount' => [10000, 30000], 'duration_months' => 8],
            ['goal_name' => 'Fitness Equipment', 'target_amount' => [5000, 15000], 'duration_months' => 6],
        ];

        foreach ($students as $student) {
            $profile = $student->studentProfile;
            if (!$profile) continue;

            // Increased goal count: 3–5 per student
            $numberOfGoals = rand(3, 5);

            shuffle($goalTemplates);
            $selectedTemplates = array_slice($goalTemplates, 0, $numberOfGoals);

            foreach ($selectedTemplates as $template) {
                $targetAmount = rand($template['target_amount'][0], $template['target_amount'][1]);

                // Assign goal type based on duration and amount
                $goalType = $template['duration_months'] > 6 || $targetAmount > 30000
                    ? 'long-term'
                    : 'short-term';

                // Random progress (0% – 100%)
                $progressPercentage = rand(0, 100);
                $currentAmount = round(($targetAmount * $progressPercentage) / 100, 2);

                // Calculate status based on progress and time
                $deadline = Carbon::now()->addMonths($template['duration_months']);
                $status = $this->determineStatus($progressPercentage);

                Goal::create([
                    'student_id' => $student->id,
                    'goal_name' => $template['goal_name'],
                    'target_amount' => $targetAmount,
                    'goal_type' => $goalType,
                    'status' => $status,
                    'current_amount' => $currentAmount,
                    'deadline' => $deadline,
                ]);

                $totalGoals++;
            }
        }

        // Summary output
        $this->command->info("✅ Created {$totalGoals} goals");
        $this->command->info('   Average: ' . round($totalGoals / max(1, $students->count()), 1) . ' goals per student');

        $goalsNearCompletion = Goal::whereRaw('current_amount >= target_amount * 0.8')->count();
        $goalsCompleted = Goal::where('status', 'completed')->count();
        $goalsMissed = Goal::where('status', 'missed')->count();

        $this->command->info("   - Near completion (80%+): {$goalsNearCompletion}");
        $this->command->info("   - Completed: {$goalsCompleted}");
        $this->command->info("   - Missed: {$goalsMissed}");
    }

    private function determineStatus(int $progress): string
    {
        // Add randomness and realism to status
        if ($progress >= 100) {
            return 'completed';
        } elseif ($progress < 20 && rand(1, 10) <= 2) {
            return 'missed';
        } elseif ($progress >= 80 && rand(1, 10) <= 3) {
            return 'completed';
        }
        return 'in-progress';
    }
}
