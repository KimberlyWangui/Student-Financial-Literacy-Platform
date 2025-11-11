<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class FinancialDataAggregator
{
    /**
     * Aggregate financial data for a student
     */
    public function aggregateStudentData($studentId)
    {
        // Get student profile
        $student = DB::table('users')
            ->join('student_profiles', 'users.id', '=', 'student_profiles.student_id')
            ->where('users.id', $studentId)
            ->where('users.role', 'student')
            ->select(
                'users.id as student_id',
                'users.name',
                'users.email',
                'student_profiles.monthly_allowance_range',
                'student_profiles.gender',
                'student_profiles.year_of_study',
                'student_profiles.course',
                'student_profiles.birth_date'
            )
            ->first();

        if (!$student) {
            throw new \Exception("Student not found");
        }

        // Calculate age
        $age = $student->birth_date 
            ? Carbon::parse($student->birth_date)->age 
            : 20;

        // Get ACTUAL monthly income from allowance range
        $monthly_income = $this->getAllowanceMidpoint($student->monthly_allowance_range);

        // Aggregate expenses by category (last 30 days to match model training)
        $expenses = $this->getExpensesByCategory($studentId, 30);

        // Calculate total expenses
        $total_expenses = array_sum($expenses);

        // Calculate spending shares
        $shares = [];
        foreach ($expenses as $category => $amount) {
            $shares[$category . '_share'] = $total_expenses > 0 
                ? round($amount / $total_expenses, 4) 
                : 0.0;
        }

        // Get top spending category
        $topCategory = $this->getTopSpendingCategory($studentId, 30);

        // Calculate burden metrics
        $housing_burden = $monthly_income > 0 
            ? round(($expenses['housing'] ?? 0) / $monthly_income, 4)
            : 0.0;

        $education_burden = $monthly_income > 0 
            ? round(($expenses['tuition_monthly'] ?? 0) / $monthly_income, 4)
            : 0.0;

        // Essential spending ratio
        $essential = ($expenses['housing'] ?? 0) + 
                    ($expenses['food'] ?? 0) + 
                    ($expenses['transportation'] ?? 0);
        $essential_ratio = $total_expenses > 0 
            ? round($essential / $total_expenses, 4) 
            : 0.0;

        // Spending concentration
        $spending_concentration = $total_expenses > 0 
            ? round($topCategory['amount'] / $total_expenses, 4) 
            : 0.0;

        // Discretionary spending ratio
        $discretionary = ($expenses['entertainment'] ?? 0) + 
                        ($expenses['personal_care'] ?? 0) + 
                        ($expenses['technology'] ?? 0);
        $discretionary_ratio = $total_expenses > 0 
            ? round($discretionary / $total_expenses, 4) 
            : 0.0;

        return [
            'student_id' => (int)$student->student_id,
            'name' => (string)$student->name,
            'email' => (string)$student->email,
            'age' => (int)$age,
            'monthly_income' => (float)$monthly_income,
            
            // Burden metrics
            'housing_burden' => (float)$housing_burden,
            'education_burden' => (float)$education_burden,
            'essential_ratio' => (float)$essential_ratio,
            'spending_concentration' => (float)$spending_concentration,
            
            // Spending shares
            'tuition_monthly_share' => (float)($shares['tuition_monthly_share'] ?? 0),
            'housing_share' => (float)($shares['housing_share'] ?? 0),
            'food_share' => (float)($shares['food_share'] ?? 0),
            'transportation_share' => (float)($shares['transportation_share'] ?? 0),
            'books_supplies_share' => (float)($shares['books_supplies_share'] ?? 0),
            'entertainment_share' => (float)($shares['entertainment_share'] ?? 0),
            'personal_care_share' => (float)($shares['personal_care_share'] ?? 0),
            'technology_share' => (float)($shares['technology_share'] ?? 0),
            'health_wellness_share' => (float)($shares['health_wellness_share'] ?? 0),
            'miscellaneous_share' => (float)($shares['miscellaneous_share'] ?? 0),
            
            // Behavioral
            'discretionary_ratio' => (float)$discretionary_ratio,
            
            // Categorical features
            'gender' => (string)($student->gender ?? 'other'),
            'year_in_school' => (string)$this->normalizeYear($student->year_of_study),
            'preferred_payment_method' => (string)$this->getPreferredPayment($studentId),
            'major' => (string)($student->course ?? 'Undeclared'),
            'top_spending_category' => (string)$topCategory['category'],
            
            // For recommendations
            'total_expenses' => (float)$total_expenses,
            'top_category_amount' => (float)$topCategory['amount'],
        ];
    }

    /**
     * Get expenses by category - NO MAPPING NEEDED (categories match model)
     */
    private function getExpensesByCategory($studentId, $days)
    {
        $cutoffDate = Carbon::now()->subDays($days);

        $expenses = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_type', 'expense')
            ->where('entry_date', '>=', $cutoffDate)
            ->select('category', DB::raw('SUM(amount) as total'))
            ->groupBy('category')
            ->pluck('total', 'category')
            ->toArray();

        // Model's expected categories
        $categories = [
            'tuition_monthly' => 0.0,
            'housing' => 0.0,
            'food' => 0.0,
            'transportation' => 0.0,
            'books_supplies' => 0.0,
            'entertainment' => 0.0,
            'personal_care' => 0.0,
            'technology' => 0.0,
            'health_wellness' => 0.0,
            'miscellaneous' => 0.0,
        ];

        // Direct assignment (no mapping needed!)
        foreach ($expenses as $category => $amount) {
            if (array_key_exists($category, $categories)) {
                $categories[$category] = (float)$amount;
            } else {
                // Unknown categories go to miscellaneous
                $categories['miscellaneous'] += (float)$amount;
                Log::warning("Unknown category '{$category}' mapped to miscellaneous");
            }
        }

        return $categories;
    }

    /**
     * Get top spending category
     */
    private function getTopSpendingCategory($studentId, $days)
    {
        $cutoffDate = Carbon::now()->subDays($days);

        $topCategory = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_type', 'expense')
            ->where('entry_date', '>=', $cutoffDate)
            ->select('category', DB::raw('SUM(amount) as total_amount'))
            ->groupBy('category')
            ->orderBy('total_amount', 'DESC')
            ->first();

        return [
            'category' => $topCategory ? $topCategory->category : 'miscellaneous',
            'amount' => $topCategory ? (float)$topCategory->total_amount : 0.0,
        ];
    }

    /**
     * Get preferred payment method
     */
    private function getPreferredPayment($studentId)
    {
        $method = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->select('payment_method', DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->orderBy('count', 'DESC')
            ->first();

        if (!$method) {
            return 'Cash';
        }

        // Simple normalization
        $normalized = ucfirst(strtolower(trim($method->payment_method)));
        
        $paymentMap = [
            'Cash' => 'Cash',
            'Card' => 'Card',
            'M-pesa' => 'M-Pesa',
            'Mpesa' => 'M-Pesa',
            'Mobile money' => 'M-Pesa',
        ];

        return $paymentMap[$normalized] ?? 'Cash';
    }

    /**
     * Get allowance midpoint
     */
    private function getAllowanceMidpoint($range)
    {
        $midpoints = [
            '0 – 5,000' => 2500.0,
            '5,001 – 10,000' => 7500.0,
            '10,001 – 20,000' => 15000.0,
            '20,001 – 35,000' => 27500.0,
            '35,001 – 50,000+' => 42500.0,
        ];

        return $midpoints[$range] ?? 10000.0;
    }

    /**
     * Normalize year of study
     */
    private function normalizeYear($year)
    {
        if (!$year) return 'one';

        $map = [
            '1' => 'one', 'first' => 'one', 'year 1' => 'one',
            '2' => 'two', 'second' => 'two', 'year 2' => 'two',
            '3' => 'three', 'third' => 'three', 'year 3' => 'three',
            '4' => 'four', 'fourth' => 'four', 'year 4' => 'four',
        ];

        return $map[strtolower(trim($year))] ?? 'one';
    }

    /**
     * Aggregate data for ALL students
     */
    public function aggregateAllStudents()
    {
        $students = DB::table('users')
            ->where('role', 'student')
            ->pluck('id');

        $allData = [];
        foreach ($students as $studentId) {
            try {
                $allData[] = $this->aggregateStudentData($studentId);
            } catch (\Exception $e) {
                Log::warning("Failed to aggregate for student {$studentId}: {$e->getMessage()}");
            }
        }

        return $allData;
    }
}