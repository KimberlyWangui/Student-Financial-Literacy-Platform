<?php

namespace Tests\Feature;

use App\Models\Badge;
use App\Models\InvestmentSimulation;
use App\Models\Statement;
use App\Models\User;
use App\Services\BadgeService;
use Database\Seeders\BadgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Badges are earned from statements uploaded and simulations saved.
 *
 * If InvestmentSimulation::create fails with "column cannot be null", add that column to sim() below.
 * If inserting into student_profiles fails, add the required column to student().
 */
class BadgesFromActivityTest extends TestCase
{
    use RefreshDatabase;

    private function student(): User
    {
        $u = User::factory()->create(['role' => 'student']);
        DB::table('student_profiles')->insert(['student_id' => $u->id]);
        return $u;
    }

    private function statement(User $u): void
    {
        Statement::create([
            'user_id' => $u->id, 'period_start' => '2026-01-01 10:00:00', 'period_end' => '2026-02-01 10:00:00',
            'rows_parsed' => 1, 'rows_new' => 1, 'balance_breaks' => 0, 'parser_version' => '1.0.0', 'warnings' => [],
        ]);
    }

    private function sim(User $u, string $type = 'money_market_fund'): void
    {
        InvestmentSimulation::create([
            'student_id' => $u->id, 'investment_type' => $type,
            'amount_invested' => 1000, 'duration_value' => 12, 'duration_unit' => 'months', 'duration_months' => 12,
            'monthly_topup' => 0, 'reinvestment_frequency' => 'monthly',
            'projected_final_value' => 1100, 'total_invested' => 1000, 'total_growth' => 100,
            'percentage_return' => 10, 'annualized_return' => 10, 'risk_level' => 'low', 'volatility' => 1,
            'best_case_scenario' => 1200, 'worst_case_scenario' => 1000, 'median_scenario' => 1100,
            'confidence_95_lower' => 1000, 'confidence_95_upper' => 1200,
            'model_parameters' => [], 'timeline' => [], 'simulation_reference' => 'SIM-' . uniqid(),
        ]);
    }

    private function names($badges): array
    {
        return collect($badges)->pluck('badge_name')->sort()->values()->all();
    }

    public function test_seeder_creates_only_statement_and_simulation_badges_and_resets_xp(): void
    {
        $u = $this->student();
        DB::table('student_profiles')->where('student_id', $u->id)->update(['xp_total' => 500]);

        $this->seed(BadgeSeeder::class);

        $this->assertSame(7, Badge::count());
        $this->assertEqualsCanonicalizing(
            ['statement_count', 'simulation_count', 'simulation_types'],
            Badge::distinct()->pluck('criteria_type')->all()
        );
        $this->assertSame(0, (int) DB::table('student_profiles')->where('student_id', $u->id)->value('xp_total'));
    }

    public function test_nothing_earned_with_no_activity(): void
    {
        $this->seed(BadgeSeeder::class);
        $this->assertCount(0, app(BadgeService::class)->checkAndAwardBadges($this->student()));
    }

    public function test_first_statement_badge_and_xp(): void
    {
        $this->seed(BadgeSeeder::class);
        $u = $this->student();
        $this->statement($u);

        $earned = app(BadgeService::class)->checkAndAwardBadges($u);

        $this->assertSame(['First Statement'], $this->names($earned));
        $this->assertSame(20, (int) DB::table('student_profiles')->where('student_id', $u->id)->value('xp_total'));
    }

    public function test_three_statements_earn_statement_regular(): void
    {
        $this->seed(BadgeSeeder::class);
        $u = $this->student();
        foreach (range(1, 3) as $_) { $this->statement($u); }

        $this->assertSame(['First Statement', 'Statement Regular'], $this->names(app(BadgeService::class)->checkAndAwardBadges($u)));
    }

    public function test_simulation_count_and_types_are_counted_separately(): void
    {
        $this->seed(BadgeSeeder::class);
        $u = $this->student();
        // Five simulations of ONE type: count badges yes, type badges no.
        foreach (range(1, 5) as $_) { $this->sim($u, 'stock'); }

        $names = $this->names(app(BadgeService::class)->checkAndAwardBadges($u));

        $this->assertSame(['Curious Learner', 'Simulation Starter'], $names);
    }

    public function test_distinct_types_earn_option_explorer_then_tried_them_all(): void
    {
        $this->seed(BadgeSeeder::class);
        $u = $this->student();
        $this->sim($u, 'stock');
        $this->sim($u, 'bond');

        $this->assertContains('Option Explorer', $this->names(app(BadgeService::class)->checkAndAwardBadges($u)));

        $this->sim($u, 'money_market_fund');
        $this->sim($u, 'savings');
        $later = $this->names(app(BadgeService::class)->checkAndAwardBadges($u));

        $this->assertContains('Tried Them All', $later);
        $this->assertNotContains('Option Explorer', $later); // not awarded twice
    }

    public function test_other_students_activity_does_not_count(): void
    {
        $this->seed(BadgeSeeder::class);
        $a = $this->student();
        $b = $this->student();
        $this->statement($a);
        $this->sim($a);

        $this->assertCount(0, app(BadgeService::class)->checkAndAwardBadges($b));
    }

    public function test_progress_shape_and_values(): void
    {
        $this->seed(BadgeSeeder::class);
        $u = $this->student();
        foreach (range(1, 2) as $_) { $this->statement($u); }

        $row = app(BadgeService::class)->getBadgeProgress($u)->firstWhere('badge_name', 'Statement Regular');

        $this->assertSame(2, $row['current_value']);
        $this->assertSame(3, $row['criteria_value']);
        $this->assertEqualsWithDelta(66.67, $row['progress_percentage'], 0.01);
        $this->assertFalse($row['has_earned']);
        $this->assertSame('Upload 3 M-Pesa statements', $row['criteria_description']);
    }

    public function test_legacy_badge_type_is_never_earned(): void
    {
        $u = $this->student();
        $this->statement($u);
        Badge::create(['badge_name' => 'Old', 'description' => 'x', 'criteria_type' => 'statement_count', 'criteria_value' => 1, 'xp_reward' => 1, 'image_url' => '/x.png']);
        DB::table('badges')->update(['criteria_type' => 'transaction_count']);

        $this->assertCount(0, app(BadgeService::class)->checkAndAwardBadges($u));
    }
}
