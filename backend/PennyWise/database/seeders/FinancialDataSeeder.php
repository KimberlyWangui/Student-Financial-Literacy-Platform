<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\FinancialData;
use Carbon\Carbon;

class FinancialDataSeeder extends Seeder
{
    public function run(): void
    {
        $students = User::where('role', 'student')->get();
        $totalEntries = 0;

        if ($students->isEmpty()) {
            $this->command->warn('⚠ No students found. Please seed Users first.');
            return;
        }

        // Categories
        $incomeCategories = ['Allowance', 'Scholarship', 'Part-time Job', 'Freelance', 'Gift', 'Bursary'];
        $expenseCategories = [
            'Food & Groceries', 'Transport', 'Entertainment', 'Books & Stationery',
            'Accommodation', 'Utilities', 'Personal Care', 'Health',
            'Airtime & Data', 'Clothing', 'Laundry', 'Subscriptions'
        ];

        $paymentMethods = ['Cash', 'M-Pesa', 'Card', 'Bank Transfer', 'E-Wallet'];

        foreach ($students as $student) {
            $profile = $student->studentProfile;
            if (!$profile) continue;

            $allowanceAmount = $this->getAllowanceAmount($profile->monthly_allowance_range);
            $isHighSpender = in_array($profile->monthly_allowance_range, ['20,001 – 35,000', '35,001 – 50,000+']);
            $isSaver = in_array($profile->monthly_allowance_range, ['0 – 5,000', '5,001 – 10,000']);

            // Increased range: 25–40 total entries per student
            $numberOfEntries = $isSaver ? rand(25, 30) : rand(35, 40);

            $monthsToGenerate = 6; // Now 6 months for richer history

            // INCOME
            for ($month = 0; $month < $monthsToGenerate; $month++) {
                $date = Carbon::now()->subMonths($month)->startOfMonth()->addDays(rand(1, 5));

                // Main allowance (recurring)
                FinancialData::create([
                    'student_id' => $student->id,
                    'entry_type' => 'income',
                    'category' => 'Allowance',
                    'amount' => $allowanceAmount,
                    'entry_date' => $date,
                    'payment_method' => 'M-Pesa',
                    'description' => 'Monthly allowance received',
                ]);
                $totalEntries++;

                // Occasional income (40% chance each month)
                if (rand(1, 10) <= 4) {
                    $extraIncomeCategory = $incomeCategories[array_rand($incomeCategories)];
                    $extraAmount = ($extraIncomeCategory === 'Scholarship')
                        ? rand(5000, 25000)
                        : rand(1000, 12000);

                    FinancialData::create([
                        'student_id' => $student->id,
                        'entry_type' => 'income',
                        'category' => $extraIncomeCategory,
                        'amount' => $extraAmount,
                        'entry_date' => $date->copy()->addDays(rand(5, 15)),
                        'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                        'description' => "Received from {$extraIncomeCategory} source",
                    ]);
                    $totalEntries++;
                }
            }

            // EXPENSES
            $remainingEntries = $numberOfEntries - ($monthsToGenerate + 3);

            for ($i = 0; $i < $remainingEntries; $i++) {
                $category = $expenseCategories[array_rand($expenseCategories)];
                $daysAgo = rand(1, 180); // Last 6 months
                $amount = $this->getExpenseAmount($category, $isHighSpender, $isSaver, $profile->living_situation);

                FinancialData::create([
                    'student_id' => $student->id,
                    'entry_type' => 'expense',
                    'category' => $category,
                    'amount' => $amount,
                    'entry_date' => Carbon::now()->subDays($daysAgo),
                    'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                    'description' => $this->generateExpenseDescription($category),
                ]);
                $totalEntries++;
            }
        }

        $this->command->info("✅ Created {$totalEntries} financial data entries");
        $this->command->info('   Average: ' . round($totalEntries / max(1, $students->count())) . ' per student');
    }

    private function getAllowanceAmount($range)
    {
        return match ($range) {
            '0 – 5,000' => rand(2000, 5000),
            '5,001 – 10,000' => rand(5001, 10000),
            '10,001 – 20,000' => rand(10001, 20000),
            '20,001 – 35,000' => rand(20001, 35000),
            '35,001 – 50,000+' => rand(35001, 60000),
            default => rand(8000, 15000),
        };
    }

    private function getExpenseAmount($category, $isHighSpender, $isSaver, $livingSituation)
    {
        $base = [
            'Food & Groceries' => ['min' => 500, 'max' => 3000],
            'Transport' => ['min' => 100, 'max' => 1000],
            'Entertainment' => ['min' => 200, 'max' => 2000],
            'Books & Stationery' => ['min' => 500, 'max' => 5000],
            'Accommodation' => ['min' => 3000, 'max' => 15000],
            'Utilities' => ['min' => 500, 'max' => 3000],
            'Personal Care' => ['min' => 200, 'max' => 2000],
            'Health' => ['min' => 300, 'max' => 5000],
            'Airtime & Data' => ['min' => 100, 'max' => 1000],
            'Clothing' => ['min' => 500, 'max' => 5000],
            'Laundry' => ['min' => 100, 'max' => 500],
            'Subscriptions' => ['min' => 300, 'max' => 2000],
        ];

        $range = $base[$category] ?? ['min' => 100, 'max' => 1000];

        if ($isHighSpender) {
            $range['min'] *= 1.5;
            $range['max'] *= 2;
        } elseif ($isSaver) {
            $range['max'] *= 0.7;
        }

        if ($category === 'Accommodation' && $livingSituation === 'Home') {
            return 0;
        }

        return rand($range['min'], $range['max']);
    }

    private function generateExpenseDescription($category)
    {
        $descriptions = [
            'Food & Groceries' => 'Groceries and snacks purchased during the week',
            'Transport' => 'Daily commute or rideshare expenses',
            'Entertainment' => 'Movies, social outings, or events',
            'Books & Stationery' => 'Study materials and course notes',
            'Accommodation' => 'Monthly rent payment or hostel fees',
            'Utilities' => 'Electricity, water, or internet bills',
            'Personal Care' => 'Haircut, skincare, or hygiene products',
            'Health' => 'Clinic visit or medication purchase',
            'Airtime & Data' => 'Phone airtime and data bundles',
            'Clothing' => 'Casual or formal wear',
            'Laundry' => 'Laundry and dry-cleaning services',
            'Subscriptions' => 'Netflix, Spotify, or other online subscriptions',
        ];

        return $descriptions[$category] ?? 'General expense';
    }
}
