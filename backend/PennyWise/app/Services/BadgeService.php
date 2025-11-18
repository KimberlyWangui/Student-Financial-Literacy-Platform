<?php

namespace App\Services;

use App\Models\User;
use App\Models\Badge;
use App\Models\FinancialData;
use App\Models\Budget;
use App\Models\Goal;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;

class BadgeService
{
    /**
     * Check and award all eligible badges for a student.
     *
     * @param User $student
     * @return Collection Collection of newly earned badges
     */
    public function checkAndAwardBadges(User $student): Collection
    {
        if ($student->role !== 'student') {
            return collect([]);
        }

        $newlyEarnedBadges = collect([]);
        $allBadges = Badge::all();

        foreach ($allBadges as $badge) {
            // Skip if student already has this badge
            if ($student->hasBadge($badge->badge_id)) {
                continue;
            }

            // Check if student meets criteria
            if ($this->meetsCriteria($student, $badge)) {
                // Award the badge
                $student->awardBadge($badge->badge_id, $badge->xp_reward);
                $newlyEarnedBadges->push($badge);

                Log::info("Badge awarded", [
                    'student_id' => $student->id,
                    'badge_id' => $badge->badge_id,
                    'badge_name' => $badge->badge_name,
                    'xp_earned' => $badge->xp_reward
                ]);
            }
        }

        return $newlyEarnedBadges;
    }

    /**
     * Check if student meets criteria for a specific badge.
     *
     * @param User $student
     * @param Badge $badge
     * @return bool
     */
    protected function meetsCriteria(User $student, Badge $badge): bool
    {
        return match ($badge->criteria_type) {
            'transaction_count' => $this->checkTransactionCount($student, $badge->criteria_value),
            'expense_streak' => $this->checkExpenseStreak($student, $badge->criteria_value),
            'created_budget' => $this->checkCreatedBudget($student, $badge->criteria_value),
            'stayed_under_budget' => $this->checkStayedUnderBudget($student, $badge->criteria_value),
            'goal_count' => $this->checkGoalCount($student, $badge->criteria_value),
            'completed_goal_count' => $this->checkCompletedGoalCount($student, $badge->criteria_value),
            default => false
        };
    }

    /**
     * Check transaction count.
     */
    protected function checkTransactionCount(User $student, int $requiredCount): bool
    {
        $count = FinancialData::where('student_id', $student->id)->count();
        return $count >= $requiredCount;
    }

    /**
     * Check expense tracking streak.
     */
    protected function checkExpenseStreak(User $student, int $requiredDays): bool
    {
        $expenses = FinancialData::where('student_id', $student->id)
            ->where('entry_type', 'expense')
            ->orderBy('entry_date', 'desc')
            ->pluck('entry_date')
            ->map(fn($date) => Carbon::parse($date)->format('Y-m-d'))
            ->unique()
            ->values();

        if ($expenses->count() < $requiredDays) {
            return false;
        }

        // Check for consecutive days
        $streak = 1;
        $maxStreak = 1;

        for ($i = 0; $i < $expenses->count() - 1; $i++) {
            $currentDate = Carbon::parse($expenses[$i]);
            $previousDate = Carbon::parse($expenses[$i + 1]);

            $daysDiff = $currentDate->diffInDays($previousDate);

            if ($daysDiff == 1) {
                $streak++;
                $maxStreak = max($maxStreak, $streak);
            } else {
                $streak = 1;
            }
        }

        return $maxStreak >= $requiredDays;
    }

    /**
     * Check if student created required number of budgets.
     */
    protected function checkCreatedBudget(User $student, int $requiredCount): bool
    {
        $count = Budget::where('student_id', $student->id)->count();
        return $count >= $requiredCount;
    }

    /**
     * Check if student stayed under budget for required months.
     */
    protected function checkStayedUnderBudget(User $student, int $requiredMonths): bool
    {
        // Get completed/expired budgets that were not exceeded
        $successfulBudgets = Budget::where('student_id', $student->id)
            ->where(function ($query) {
                $query->where('status', 'completed')
                      ->orWhere('status', 'under');
            })
            ->whereRaw('actual_spent <= amount')
            ->count();

        return $successfulBudgets >= $requiredMonths;
    }

    /**
     * Check if student created required number of goals.
     */
    protected function checkGoalCount(User $student, int $requiredCount): bool
    {
        $count = Goal::where('student_id', $student->id)->count();
        return $count >= $requiredCount;
    }

    /**
     * Check if student completed required number of goals.
     */
    protected function checkCompletedGoalCount(User $student, int $requiredCount): bool
    {
        $count = Goal::where('student_id', $student->id)
            ->where('status', 'completed')
            ->count();
        return $count >= $requiredCount;
    }

    /**
     * Get student's badge progress for all badges.
     *
     * @param User $student
     * @return Collection
     */
    public function getBadgeProgress(User $student): Collection
    {
        $allBadges = Badge::all();
        $progress = collect([]);

        foreach ($allBadges as $badge) {
            $hasEarned = $student->hasBadge($badge->badge_id);
            $currentValue = $this->getCurrentValue($student, $badge);

            $progressPercentage = $badge->criteria_value > 0 
                ? min(100, ($currentValue / $badge->criteria_value) * 100) 
                : 0;

            $progress->push([
                'badge_id' => $badge->badge_id,
                'badge_name' => $badge->badge_name,
                'description' => $badge->description,
                'criteria_type' => $badge->criteria_type,
                'criteria_value' => $badge->criteria_value,
                'current_value' => $currentValue,
                'progress_percentage' => round($progressPercentage, 2),
                'xp_reward' => $badge->xp_reward,
                'has_earned' => $hasEarned,
                'image_url' => $badge->image_url_full,
                'criteria_description' => $badge->criteria_description
            ]);
        }

        return $progress;
    }

    /**
     * Get current value for a specific criteria type.
     */
    protected function getCurrentValue(User $student, Badge $badge): int
    {
        return match ($badge->criteria_type) {
            'transaction_count' => FinancialData::where('student_id', $student->id)->count(),
            'expense_streak' => $this->getCurrentStreak($student),
            'created_budget' => Budget::where('student_id', $student->id)->count(),
            'stayed_under_budget' => $this->getSuccessfulBudgetCount($student),
            'goal_count' => Goal::where('student_id', $student->id)->count(),
            'completed_goal_count' => Goal::where('student_id', $student->id)->where('status', 'completed')->count(),
            default => 0
        };
    }

    /**
     * Get current expense tracking streak.
     */
    protected function getCurrentStreak(User $student): int
    {
        $expenses = FinancialData::where('student_id', $student->id)
            ->where('entry_type', 'expense')
            ->orderBy('entry_date', 'desc')
            ->pluck('entry_date')
            ->map(fn($date) => Carbon::parse($date)->format('Y-m-d'))
            ->unique()
            ->values();

        if ($expenses->isEmpty()) {
            return 0;
        }

        $streak = 1;
        $maxStreak = 1;

        for ($i = 0; $i < $expenses->count() - 1; $i++) {
            $currentDate = Carbon::parse($expenses[$i]);
            $previousDate = Carbon::parse($expenses[$i + 1]);
            $daysDiff = $currentDate->diffInDays($previousDate);

            if ($daysDiff == 1) {
                $streak++;
                $maxStreak = max($maxStreak, $streak);
            } else {
                $streak = 1;
            }
        }

        return $maxStreak;
    }

    /**
     * Get count of successful budgets (not exceeded).
     */
    protected function getSuccessfulBudgetCount(User $student): int
    {
        return Budget::where('student_id', $student->id)
            ->where(function ($query) {
                $query->where('status', 'completed')
                      ->orWhere('status', 'under');
            })
            ->whereRaw('actual_spent <= amount')
            ->count();
    }
}