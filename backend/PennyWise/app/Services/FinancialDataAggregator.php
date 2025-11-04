<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class FinancialDataAggregator
{
    /**
     * Aggregate financial data for a student (mimics Colab preprocessing)
     */
    public function aggregateStudentData($studentId)
    {
        $now = Carbon::now();

        // Get student profile data
        $student = DB::table('users')
            ->join('student_profiles', 'users.id', '=', 'student_profiles.student_id')
            ->where('users.id', $studentId)
            ->where('users.role', 'student')
            ->select(
                'users.id as student_id',
                'users.name',
                'users.email',
                'student_profiles.monthly_allowance_range',
                'student_profiles.living_situation'
            )
            ->first();

        if (!$student) {
            throw new \Exception("Student not found or not a student role");
        }

        // Aggregate financial data for last 30 days
        $financial30 = $this->aggregateFinancials($studentId, 30);
        
        // Aggregate financial data for last 90 days
        $financial90 = $this->aggregateFinancials($studentId, 90);
        
        // Get top spending category (last 90 days)
        $topCategory = $this->getTopSpendingCategory($studentId, 90);
        
        // Get current budgets summary
        $budgetsSummary = $this->getBudgetsSummary($studentId, $now);
        
        // Get goals summary
        $goalsSummary = $this->getGoalsSummary($studentId);

        // Combine all data
        return [
            'student_id' => $student->student_id,
            'name' => $student->name,
            'email' => $student->email,
            'monthly_allowance_range' => $student->monthly_allowance_range ?? '0 – 5,000',
            'living_situation' => $student->living_situation ?? 'Hostel',
            
            // 30-day metrics
            'total_amount_30' => $financial30['total_amount'] ?? 0,
            'txn_count_30' => $financial30['txn_count'] ?? 0,
            'avg_amount_30' => $financial30['avg_amount'] ?? 0,
            
            // 90-day metrics
            'total_amount_90' => $financial90['total_amount'] ?? 0,
            'txn_count_90' => $financial90['txn_count'] ?? 0,
            'avg_amount_90' => $financial90['avg_amount'] ?? 0,
            
            // Top spending category
            'top_spending_category' => $topCategory['category'] ?? 'Unknown',
            'top_category_amount' => $topCategory['amount'] ?? 0,
            
            // Budgets
            'budgets_count' => $budgetsSummary['budgets_count'] ?? 0,
            'budget_total' => $budgetsSummary['budget_total'] ?? 0,
            'actual_spent_total' => $budgetsSummary['actual_spent_total'] ?? 0,
            
            // Goals
            'goals_count' => $goalsSummary['goals_count'] ?? 0,
            'total_target' => $goalsSummary['total_target'] ?? 0,
            'total_current' => $goalsSummary['total_current'] ?? 0,
            'avg_goal_progress' => $goalsSummary['avg_goal_progress'] ?? 0,
        ];
    }

    /**
     * Aggregate financial transactions for a given time window
     */
    private function aggregateFinancials($studentId, $windowDays)
    {
        $cutoffDate = Carbon::now()->subDays($windowDays);

        $result = DB::table('financial_data')
            ->where('student_id', $studentId)
            ->where('entry_date', '>=', $cutoffDate)
            ->select(
                DB::raw('SUM(amount) as total_amount'),
                DB::raw('COUNT(*) as txn_count'),
                DB::raw('AVG(amount) as avg_amount')
            )
            ->first();

        return [
            'total_amount' => $result->total_amount ?? 0,
            'txn_count' => $result->txn_count ?? 0,
            'avg_amount' => $result->avg_amount ?? 0,
        ];
    }

    /**
     * Get top spending category for last N days
     */
    private function getTopSpendingCategory($studentId, $days = 90)
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
            'category' => $topCategory->category ?? 'Unknown',
            'amount' => $topCategory->total_amount ?? 0,
        ];
    }

    /**
     * Get budgets summary for current active budgets
     */
    private function getBudgetsSummary($studentId, $now)
    {
        $result = DB::table('budgets')
            ->where('student_id', $studentId)
            ->where('start_date', '<=', $now)
            ->where('end_date', '>=', $now)
            ->select(
                DB::raw('COUNT(*) as budgets_count'),
                DB::raw('SUM(amount) as budget_total'),
                DB::raw('SUM(actual_spent) as actual_spent_total')
            )
            ->first();

        return [
            'budgets_count' => $result->budgets_count ?? 0,
            'budget_total' => $result->budget_total ?? 0,
            'actual_spent_total' => $result->actual_spent_total ?? 0,
        ];
    }

    /**
     * Get goals summary
     */
    private function getGoalsSummary($studentId)
    {
        $result = DB::table('goals')
            ->where('student_id', $studentId)
            ->select(
                DB::raw('COUNT(*) as goals_count'),
                DB::raw('SUM(target_amount) as total_target'),
                DB::raw('SUM(current_amount) as total_current')
            )
            ->first();

        $totalTarget = $result->total_target ?? 0;
        $totalCurrent = $result->total_current ?? 0;
        
        $avgProgress = $totalTarget > 0 
            ? round($totalCurrent / $totalTarget, 4) 
            : 0;

        return [
            'goals_count' => $result->goals_count ?? 0,
            'total_target' => $totalTarget,
            'total_current' => $totalCurrent,
            'avg_goal_progress' => $avgProgress,
        ];
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
                Log::warning("Failed to aggregate data for student {$studentId}: {$e->getMessage()}");
            }
        }

        return $allData;
    }
}