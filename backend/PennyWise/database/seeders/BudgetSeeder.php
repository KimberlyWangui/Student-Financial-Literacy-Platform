<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Budget;
use Carbon\Carbon;

class BudgetSeeder extends Seeder
{
    public function run(): void
    {
        $students = User::where('role', 'student')->get();
        $totalBudgets = 0;

        $categories = [
            'Food & Groceries', 'Transport', 'Entertainment', 'Books & Stationery',
            'Accommodation', 'Utilities', 'Personal Care', 'Savings'
        ];

        foreach ($students as $student) {
            $profile = $student->studentProfile;
            if (!$profile) continue;

            $allowanceAmount = $this->getAllowanceAmount($profile->monthly_allowance_range);
            $livingSituation = $profile->living_situation;

            // Each student will now have budgets for 3 months instead of 2
            $months = [
                [
                    'start' => Carbon::now()->subMonth()->startOfMonth(),
                    'end' => Carbon::now()->subMonth()->endOfMonth(),
                ],
                [
                    'start' => Carbon::now()->startOfMonth(),
                    'end' => Carbon::now()->endOfMonth(),
                ],
                [
                    'start' => Carbon::now()->addMonth()->startOfMonth(),
                    'end' => Carbon::now()->addMonth()->endOfMonth(),
                ],
            ];

            $numberOfBudgets = rand(5, 7);

            $selectedCategories = ['Savings'];
            $categoriesPool = array_diff($categories, ['Savings']);

            if ($livingSituation === 'Home') {
                $categoriesPool = array_diff($categoriesPool, ['Accommodation']);
            }

            shuffle($categoriesPool);
            for ($i = 0; $i < $numberOfBudgets - 1; $i++) {
                if (isset($categoriesPool[$i])) {
                    $selectedCategories[] = $categoriesPool[$i];
                }
            }

            foreach ($months as $month) {
                foreach ($selectedCategories as $category) {
                    $budgetAmount = $this->getBudgetAmount($category, $allowanceAmount, $livingSituation);

                    // Simulate realistic spending: 80–120% of budgeted amount
                    $variance = rand(80, 120) / 100;
                    $actualSpent = round($budgetAmount * $variance, 2);

                    // Determine budget status
                    if ($actualSpent > $budgetAmount * 1.05) {
                        $status = 'over';
                    } elseif ($actualSpent < $budgetAmount * 0.9) {
                        $status = 'under';
                    } elseif ($month['end']->isPast()) {
                        $status = 'completed';
                    } else {
                        $status = 'active';
                    }

                    Budget::create([
                        'student_id' => $student->id,
                        'category' => $category,
                        'amount' => $budgetAmount,
                        'actual_spent' => $actualSpent,
                        'status' => $status,
                        'start_date' => $month['start'],
                        'end_date' => $month['end'],
                    ]);
                    $totalBudgets++;
                }
            }
        }

        $this->command->info("✓ Created {$totalBudgets} budgets with realistic spending and statuses");
        $this->command->info('  - Average: ' . round($totalBudgets / max(1, $students->count()), 1) . ' budgets per student');
    }

    private function getAllowanceAmount($range)
    {
        $mapping = [
            '0 – 5,000' => rand(2000, 5000),
            '5,001 – 10,000' => rand(5001, 10000),
            '10,001 – 20,000' => rand(10001, 20000),
            '20,001 – 35,000' => rand(20001, 35000),
            '35,001 – 50,000+' => rand(35001, 60000),
        ];

        return $mapping[$range] ?? 15000;
    }

    private function getBudgetAmount($category, $allowance, $livingSituation)
    {
        $percentages = [
            'Food & Groceries' => 0.25,
            'Transport' => 0.10,
            'Entertainment' => 0.10,
            'Books & Stationery' => 0.08,
            'Accommodation' => 0.30,
            'Utilities' => 0.05,
            'Personal Care' => 0.05,
            'Savings' => 0.15,
        ];

        $baseAmount = $allowance * ($percentages[$category] ?? 0.10);

        if ($category === 'Accommodation') {
            if ($livingSituation === 'Home') {
                return 0;
            } elseif ($livingSituation === 'Solo Apartment') {
                $baseAmount *= 1.5;
            } elseif ($livingSituation === 'Shared Apartment') {
                $baseAmount *= 0.8;
            }
        }

        $variance = rand(-15, 15) / 100;
        $baseAmount *= (1 + $variance);

        return round($baseAmount, -2);
    }
}
