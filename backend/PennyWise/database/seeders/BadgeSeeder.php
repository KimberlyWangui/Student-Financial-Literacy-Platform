<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Badge;
use Illuminate\Support\Facades\DB;

class BadgeSeeder extends Seeder
{
    /**
     * Badges are earned by uploading M-Pesa statements and saving simulations.
     *
     * Running this wipes all earned badges and resets every student's XP to 0,
     * because the old badges (expenses, budgets, goals) no longer exist.
     */
    public function run(): void
    {
        DB::table('student_badges')->delete();
        DB::table('badges')->delete();
        DB::table('student_profiles')->update(['xp_total' => 0]);

        $badges = [
            [
                'badge_name' => 'First Statement',
                'description' => 'Uploaded your first M-Pesa statement. This is where PennyWise starts to learn how your money moves.',
                'criteria_type' => 'statement_count',
                'criteria_value' => 1,
                'xp_reward' => 20,
                'image_url' => '/images/financial-statement.png',
            ],
            [
                'badge_name' => 'Statement Regular',
                'description' => 'Uploaded 3 statements. Regular uploads keep your advice up to date.',
                'criteria_type' => 'statement_count',
                'criteria_value' => 3,
                'xp_reward' => 50,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Simulation Starter',
                'description' => 'Saved your first simulation. Now you can see how an amount could grow over time.',
                'criteria_type' => 'simulation_count',
                'criteria_value' => 1,
                'xp_reward' => 15,
                'image_url' => '/images/target.png',
            ],
            [
                'badge_name' => 'Curious Learner',
                'description' => 'Saved 5 simulations. Trying different amounts and time periods is how you learn.',
                'criteria_type' => 'simulation_count',
                'criteria_value' => 5,
                'xp_reward' => 40,
                'image_url' => '/images/reward.png',
            ],
            [
                'badge_name' => 'Simulation Pro',
                'description' => 'Saved 10 simulations. You know your way around the simulator.',
                'criteria_type' => 'simulation_count',
                'criteria_value' => 10,
                'xp_reward' => 75,
                'image_url' => '/images/badge.png',
            ],
            [
                'badge_name' => 'Option Explorer',
                'description' => 'Tried 2 different investment types in the simulator.',
                'criteria_type' => 'simulation_types',
                'criteria_value' => 2,
                'xp_reward' => 30,
                'image_url' => '/images/target.png',
            ],
            [
                'badge_name' => 'Tried Them All',
                'description' => 'Tried all 4 investment types in the simulator. Comparing them side by side is the best way to see the trade-offs.',
                'criteria_type' => 'simulation_types',
                'criteria_value' => 4,
                'xp_reward' => 100,
                'image_url' => '/images/reward.png',
            ],
        ];

        foreach ($badges as $badge) {
            Badge::create($badge);
        }

        $this->command?->info('Created ' . count($badges) . ' badges and reset student XP');
    }
}
