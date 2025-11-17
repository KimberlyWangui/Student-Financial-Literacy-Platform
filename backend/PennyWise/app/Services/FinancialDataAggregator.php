<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class FinancialDataAggregator
{
    /**
     * Aggregate financial data for a student (USES CURRENT CALENDAR MONTH)
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

        // CRITICAL FIX: Use CURRENT CALENDAR MONTH (matches your dashboard)
        $startOfMonth = Carbon::now()->startOfMonth(); // 2025-11-01 00:00:00
        $endOfMonth = Carbon::now()->endOfMonth();     // 2025-11-30 23:59:59
        
        Log::info("=== Student {$studentId} Data Aggregation ===");
        Log::info("Date range: {$startOfMonth->toDateString()} to {$endOfMonth->toDateString()}");

        // Get ACTUAL monthly income from financial_data (current month)
        $monthly_income = $this->getActualMonthlyIncome($studentId, $startOfMonth, $endOfMonth);
        
        // Fallback to allowance range if no income entries found
        if ($monthly_income == 0) {
            $monthly_income = $this->getAllowanceMidpoint($student->monthly_allowance_range);
            Log::info("No income entries found, using allowance estimate: {$monthly_income} KES");
        }

        // Aggregate expenses by category (current month)
        $expenses = $this->getExpensesByCategory($studentId, $startOfMonth, $endOfMonth);

        // Calculate total expenses
        $total_expenses = array_sum($expenses);
        
        // Calculate expense-to-income ratio
        $expense_ratio = $monthly_income > 0 ? ($total_expenses / $monthly_income) : 0;

        Log::info("Income: {$monthly_income} KES");
        Log::info("Expenses: {$total_expenses} KES");
        Log::info("Ratio: " . round($expense_ratio * 100, 2) . "%");
        Log::info("Savings: " . ($monthly_income - $total_expenses) . " KES");

        // Calculate spending shares
        $shares = [];
        foreach ($expenses as $category => $amount) {
            $shares[$category . '_share'] = $total_expenses > 0 
                ? round($amount / $total_expenses, 4) 
                : 0.0;
        }

        // Get top spending category
        $topCategory = $this->getTopSpendingCategory($studentId, $startOfMonth, $endOfMonth);

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

        Log::info("=== End Student {$studentId} Aggregation ===\n");

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
     * Get actual monthly income from financial_data (DATE RANGE)
     */
    private function getActualMonthlyIncome($studentId, $startDate, $endDate)
    {
        $totalIncome = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_type', 'income')
            ->whereBetween('entry_date', [$startDate, $endDate])
            ->sum('amount');

        return (float)$totalIncome;
    }

    /**
     * Get expenses by category (DATE RANGE)
     */
    private function getExpensesByCategory($studentId, $startDate, $endDate)
    {
        $expenses = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_type', 'expense')
            ->whereBetween('entry_date', [$startDate, $endDate])
            ->select('category', DB::raw('SUM(amount) as total'))
            ->groupBy('category')
            ->get();

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

        foreach ($expenses as $expense) {
            if (array_key_exists($expense->category, $categories)) {
                $categories[$expense->category] = (float)$expense->total;
                Log::info("  {$expense->category}: {$expense->total} KES");
            } else {
                $categories['miscellaneous'] += (float)$expense->total;
                Log::warning("  Unknown '{$expense->category}': {$expense->total} KES → miscellaneous");
            }
        }

        return $categories;
    }

    /**
     * Get top spending category (DATE RANGE)
     */
    private function getTopSpendingCategory($studentId, $startDate, $endDate)
    {
        $topCategory = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_type', 'expense')
            ->whereBetween('entry_date', [$startDate, $endDate])
            ->select('category', DB::raw('SUM(amount) as total_amount'))
            ->groupBy('category')
            ->orderBy('total_amount', 'DESC')
            ->first();

        if (!$topCategory) {
            return ['category' => 'miscellaneous', 'amount' => 0.0];
        }

        return [
            'category' => $topCategory->category,
            'amount' => (float)$topCategory->total_amount,
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

        if (!$method || !$method->payment_method) {
            return 'Cash';
        }

        $normalized = strtolower(trim($method->payment_method));
        
        $paymentMap = [
            'cash' => 'Cash',
            'card' => 'Card',
            'm-pesa' => 'M-Pesa',
            'mpesa' => 'M-Pesa',
        ];

        return $paymentMap[$normalized] ?? 'Cash';
    }

    /**
     * Get allowance midpoint (FALLBACK)
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
                Log::warning("Failed for student {$studentId}: {$e->getMessage()}");
            }
        }

        return $allData;
    }
}