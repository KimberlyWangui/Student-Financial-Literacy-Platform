<?php

namespace Tests\Feature;

use App\Models\InvestmentSimulation;
use App\Models\Statement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Active" = uploaded a statement or saved a simulation in the last N days.
 * Same column notes as BadgesFromActivityTest.
 */
class ActiveStudentsTest extends TestCase
{
    use RefreshDatabase;

    private function student(string $name): User
    {
        $u = User::factory()->create(['role' => 'student', 'name' => $name]);
        DB::table('student_profiles')->insert(['student_id' => $u->id]);
        return $u;
    }

    private function statement(User $u, string $when): void
    {
        $s = Statement::create([
            'user_id' => $u->id, 'period_start' => '2026-01-01 10:00:00', 'period_end' => '2026-02-01 10:00:00',
            'rows_parsed' => 1, 'rows_new' => 1, 'balance_breaks' => 0, 'parser_version' => '1.0.0', 'warnings' => [],
        ]);
        DB::table('statements')->where('id', $s->id)->update(['created_at' => $when]);
    }

    private function sim(User $u, string $when): void
    {
        $s = InvestmentSimulation::create([
            'student_id' => $u->id, 'investment_type' => 'stock',
            'amount_invested' => 1000, 'duration_value' => 12, 'duration_unit' => 'months', 'duration_months' => 12,
            'monthly_topup' => 0, 'reinvestment_frequency' => 'monthly',
            'projected_final_value' => 1100, 'total_invested' => 1000, 'total_growth' => 100,
            'percentage_return' => 10, 'annualized_return' => 10, 'risk_level' => 'low', 'volatility' => 1,
            'best_case_scenario' => 1200, 'worst_case_scenario' => 1000, 'median_scenario' => 1100,
            'confidence_95_lower' => 1000, 'confidence_95_upper' => 1200,
            'model_parameters' => [], 'timeline' => [], 'simulation_reference' => 'SIM-' . uniqid(),
        ]);
        DB::table('investment_simulations')->where('simulation_id', $s->simulation_id)->update(['created_at' => $when]);
    }

    private function active(array $query = []): array
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        return $this->getJson('/api/student-profiles/active' . ($query ? '?' . http_build_query($query) : ''))
            ->assertOk()->json('data');
    }

    public function test_statement_or_simulation_in_window_counts_and_old_activity_does_not(): void
    {
        $a = $this->student('Stmt Only');
        $b = $this->student('Sim Only');
        $c = $this->student('Both');
        $old = $this->student('Old');
        $none = $this->student('None');

        $this->statement($a, now()->subDays(2));
        $this->sim($b, now()->subDays(3));
        $this->statement($c, now()->subDays(5));
        $this->sim($c, now()->subDays(1));
        $this->statement($old, now()->subDays(60));

        $data = $this->active();

        $this->assertSame(30, $data['period_days']);
        $this->assertSame(3, $data['total_active_students']);
        $this->assertEqualsCanonicalizing(['Stmt Only', 'Sim Only', 'Both'], collect($data['students'])->pluck('name')->all());
    }

    public function test_counts_and_last_activity(): void
    {
        $c = $this->student('Both');
        $this->statement($c, now()->subDays(5));
        $this->sim($c, now()->subDays(1));
        $this->sim($c, now()->subDays(4));

        $row = $this->active()['students'][0];

        $this->assertSame(1, $row['statement_count']);
        $this->assertSame(2, $row['simulation_count']);
        $this->assertArrayNotHasKey('transaction_count', $row);
        $this->assertTrue(
            \Carbon\Carbon::parse($row['last_activity'])
                ->setTimezone(config('app.timezone'))
                ->isSameDay(now()->subDays(1))
            );
    }

    public function test_days_parameter_widens_window_and_is_capped(): void
    {
        $old = $this->student('Old');
        $this->statement($old, now()->subDays(60));

        $this->assertSame(0, $this->active()['total_active_students']);
        $this->assertSame(1, $this->active(['days' => 90])['total_active_students']);
        $this->assertSame(365, $this->active(['days' => 9999])['period_days']);
    }

    public function test_students_only_see_forbidden(): void
    {
        Sanctum::actingAs($this->student('S'));
        $this->getJson('/api/student-profiles/active')->assertStatus(403);
    }
}
