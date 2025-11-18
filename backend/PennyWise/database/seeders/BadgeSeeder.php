<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Badge;
use Illuminate\Support\Facades\DB;

class BadgeSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Clear existing badges
        DB::table('student_badges')->delete();
        DB::table('badges')->delete();

        $badges = [
            // ============================================
            // TRANSACTION BADGES (Behavioral)
            // ============================================
            [
                'badge_name' => 'First Expense Added',
                'description' => 'Added your first expense to the system. Welcome to financial tracking!',
                'criteria_type' => 'transaction_count',
                'criteria_value' => 1,
                'xp_reward' => 10,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Transaction Novice',
                'description' => 'Logged 10 transactions. You\'re getting the hang of this!',
                'criteria_type' => 'transaction_count',
                'criteria_value' => 10,
                'xp_reward' => 25,
                'image_url' => '/images/reward.png',
            ],
            [
                'badge_name' => 'Transaction Pro',
                'description' => 'Reached 50 transactions. You\'re a tracking professional!',
                'criteria_type' => 'transaction_count',
                'criteria_value' => 50,
                'xp_reward' => 50,
                'image_url' => '/images/target.png',
            ],
            [
                'badge_name' => 'Transaction Master',
                'description' => 'Logged 100 transactions. Financial tracking is second nature to you!',
                'criteria_type' => 'transaction_count',
                'criteria_value' => 100,
                'xp_reward' => 100,
                'image_url' => '/images/financial-statement.png',
            ],

            // ============================================
            // STREAK BADGES (Consistency)
            // ============================================
            [
                'badge_name' => 'Consistent Tracker (7 days)',
                'description' => 'Tracked expenses for 7 consecutive days. Building good habits!',
                'criteria_type' => 'expense_streak',
                'criteria_value' => 7,
                'xp_reward' => 50,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => '30-Day Tracker',
                'description' => 'Tracked expenses for 30 consecutive days. Consistency is key!',
                'criteria_type' => 'expense_streak',
                'criteria_value' => 30,
                'xp_reward' => 150,
                'image_url' => '/images/reward.png',
            ],
            [
                'badge_name' => '3-Month Tracker',
                'description' => 'Tracked expenses for 90 consecutive days. You\'re a tracking legend!',
                'criteria_type' => 'expense_streak',
                'criteria_value' => 90,
                'xp_reward' => 300,
                'image_url' => '/images/target.png',
            ],

            // ============================================
            // BUDGETING BADGES
            // ============================================
            [
                'badge_name' => 'First Budget Created',
                'description' => 'Created your first budget. Taking control of your finances!',
                'criteria_type' => 'created_budget',
                'criteria_value' => 1,
                'xp_reward' => 15,
                'image_url' => '/images/financial-statement.png',
            ],
            [
                'badge_name' => 'Budget Planner',
                'description' => 'Created 5 budgets. You\'re planning ahead!',
                'criteria_type' => 'created_budget',
                'criteria_value' => 5,
                'xp_reward' => 40,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Budget Keeper',
                'description' => 'Stayed under budget for 1 month. Financial discipline achieved!',
                'criteria_type' => 'stayed_under_budget',
                'criteria_value' => 1,
                'xp_reward' => 75,
                'image_url' => '/images/reward.png',
            ],
            [
                'badge_name' => 'Budget Expert',
                'description' => 'Stayed under budget for 3 months. You\'re a budgeting expert!',
                'criteria_type' => 'stayed_under_budget',
                'criteria_value' => 3,
                'xp_reward' => 200,
                'image_url' => '/images/target.png',
            ],
            [
                'badge_name' => 'Budget Master',
                'description' => 'Stayed under budget for 6 months. Financial mastery achieved!',
                'criteria_type' => 'stayed_under_budget',
                'criteria_value' => 6,
                'xp_reward' => 400,
                'image_url' => '/images/financial-statement.png',
            ],

            // ============================================
            // GOALS BADGES
            // ============================================
            [
                'badge_name' => 'First Goal Created',
                'description' => 'Set your first financial goal. Dream big!',
                'criteria_type' => 'goal_count',
                'criteria_value' => 1,
                'xp_reward' => 15,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Goal Setter',
                'description' => 'Created 5 financial goals. You\'re thinking ahead!',
                'criteria_type' => 'goal_count',
                'criteria_value' => 5,
                'xp_reward' => 40,
                'image_url' => '/images/reward.png',
            ],
            [
                'badge_name' => 'First Goal Completed',
                'description' => 'Completed your first financial goal. Success tastes sweet!',
                'criteria_type' => 'completed_goal_count',
                'criteria_value' => 1,
                'xp_reward' => 100,
                'image_url' => '/images/target.png',
            ],
            [
                'badge_name' => 'Goal Achiever',
                'description' => 'Completed 3 financial goals. You make things happen!',
                'criteria_type' => 'completed_goal_count',
                'criteria_value' => 3,
                'xp_reward' => 250,
                'image_url' => '/images/financial-statement.png',
            ],
            [
                'badge_name' => 'Goal Master',
                'description' => 'Completed 5 financial goals. Nothing can stop you!',
                'criteria_type' => 'completed_goal_count',
                'criteria_value' => 5,
                'xp_reward' => 500,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Goal Legend',
                'description' => 'Completed 10 financial goals. You\'re an inspiration!',
                'criteria_type' => 'completed_goal_count',
                'criteria_value' => 10,
                'xp_reward' => 1000,
                'image_url' => '/images/reward.png',
            ],
        ];

        foreach ($badges as $badge) {
            Badge::create($badge);
        }

        $this->command->info(' Created ' . count($badges) . ' badges successfully!');
        
        // Display summary
        $this->command->info('');
        $this->command->info(' Badge Summary:');
        $this->command->info('   - Transaction Badges: 4');
        $this->command->info('   - Streak Badges: 3');
        $this->command->info('   - Budgeting Badges: 5');
        $this->command->info('   - Goal Badges: 6');
        $this->command->info('   - Total Badges: 18');
        $this->command->info('   - Total XP Available: ' . collect($badges)->sum('xp_reward'));
    }
}