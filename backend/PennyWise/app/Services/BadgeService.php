<?php

namespace App\Services;

use App\Models\Badge;
use App\Models\InvestmentSimulation;
use App\Models\Statement;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Badges are earned from what a student does in PennyWise:
 * uploading M-Pesa statements and saving investment simulations.
 */
class BadgeService
{
    /**
     * Check and award all eligible badges for a student.
     *
     * @return Collection Newly earned badges
     */
    public function checkAndAwardBadges(User $student): Collection
    {
        if ($student->role !== 'student') {
            return collect([]);
        }

        $newlyEarnedBadges = collect([]);

        foreach (Badge::all() as $badge) {
            if ($student->hasBadge($badge->badge_id)) {
                continue;
            }

            if ($this->meetsCriteria($student, $badge)) {
                $student->awardBadge($badge->badge_id, $badge->xp_reward);
                $newlyEarnedBadges->push($badge);

                Log::info('Badge awarded', [
                    'student_id' => $student->id,
                    'badge_id' => $badge->badge_id,
                    'badge_name' => $badge->badge_name,
                    'xp_earned' => $badge->xp_reward,
                ]);
            }
        }

        return $newlyEarnedBadges;
    }

    protected function meetsCriteria(User $student, Badge $badge): bool
    {
        // A badge with a criteria type we do not know (for example a leftover
        // old one) has a current value of 0, so it can never be earned.
        return $badge->criteria_value > 0
            && $this->getCurrentValue($student, $badge) >= $badge->criteria_value;
    }

    /**
     * Get the student's progress for all badges.
     */
    public function getBadgeProgress(User $student): Collection
    {
        $progress = collect([]);

        foreach (Badge::all() as $badge) {
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
                'has_earned' => $student->hasBadge($badge->badge_id),
                'image_url' => $badge->image_url_full,
                'criteria_description' => $badge->criteria_description,
            ]);
        }

        return $progress;
    }

    protected function getCurrentValue(User $student, Badge $badge): int
    {
        return match ($badge->criteria_type) {
            'statement_count' => Statement::where('user_id', $student->id)->count(),
            'simulation_count' => InvestmentSimulation::where('student_id', $student->id)->count(),
            'simulation_types' => InvestmentSimulation::where('student_id', $student->id)
                ->distinct('investment_type')
                ->count('investment_type'),
            default => 0,
        };
    }
}
