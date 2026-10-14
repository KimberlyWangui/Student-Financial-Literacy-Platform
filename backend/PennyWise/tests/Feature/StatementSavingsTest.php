<?php

namespace Tests\Feature;

use App\Models\Recommendation;
use App\Models\Statement;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The savings balance a student enters, stored on their profile and sent to the rule engine.
 * Uses Http::fake, so no Flask server is needed.
 *
 * If inserting into student_profiles fails because a column is required, add it to makeProfile() below.
 */
class StatementSavingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.statement_api.url' => 'http://127.0.0.1:5001',
            'services.statement_api.token' => 'test-internal-token-0123456789',
        ]);
    }

    private function student(bool $withProfile = true): User
    {
        $u = User::factory()->create(['role' => 'student']);
        if ($withProfile) {
            $this->makeProfile($u);
        }

        return $u;
    }

    private function makeProfile(User $u): void
    {
        DB::table('student_profiles')->insert(['student_id' => $u->id]);
    }

    /** The stored balance as a number. The database may return '2500.5' or '2500.50', so never compare it as text. */
    private function dbBalance(User $u): float
    {
        return (float) DB::table('student_profiles')->where('student_id', $u->id)->value('savings_balance');
    }

    /** Whole amounts can come back as 100 or 100.0 in JSON, so compare as numbers (null stays a separate check). */
    private function assertAmount(float $expected, $response, string $path = 'data.amount'): void
    {
        $actual = $response->json($path);
        $this->assertNotNull($actual, "$path is null");
        $this->assertEqualsWithDelta($expected, (float) $actual, 0.001);
    }

    private function seedStatement(User $u): void
    {
        $s = Statement::create([
            'user_id' => $u->id, 'period_start' => '2026-01-01 10:00:00', 'period_end' => '2026-02-01 10:00:00',
            'rows_parsed' => 1, 'rows_new' => 1, 'balance_breaks' => 0, 'parser_version' => '1.0.0', 'warnings' => [],
        ]);
        Transaction::create([
            'user_id' => $u->id, 'statement_id' => $s->id, 'row_id' => 'r1', 'receipt_id' => 'rc1',
            'time' => '2026-01-01 10:00:00', 'type' => 'received_money', 'funding' => 'wallet', 'direction' => 'in',
            'amount' => 1000, 'paid_in' => 1000, 'withdrawn' => 0, 'balance' => 1000,
        ]);
    }

    private function insightsBody(array $cards): array
    {
        return [
            'status' => 'ok', 'parser_version' => '1.0.0', 'metrics' => [], 'monthly_flows' => [],
            'data_quality' => ['days_since_last' => 3, 'last_transaction' => '2026-02-01T10:00:00'],
            'stage' => ['stage' => 'ready_to_explore', 'confidence' => 'high', 'borrowing' => 'none_detected',
                        'buffer_days' => 20.0, 'reasons' => ['r'], 'notes' => [],
                        'next_step' => ['id' => 'learn_investing_basics', 'title' => 'Learn']],
            'actions' => $cards,
        ];
    }

    private function investingCard(?int $amount = 600): array
    {
        return [
            'id' => 'learn_investing_basics', 'category' => 'General', 'title' => 'Learn how options compare',
            'what' => 'What', 'why' => 'Why', 'first_step' => 'Step', 'learn' => 'Not guaranteed.', 'impact_kes' => null,
            'confidence' => 'high', 'priority' => 10, 'evidence' => [],
            'simulator' => ['investment_type' => 'mmf', 'monthly_amount' => $amount],
        ];
    }

    // ---------------------------------------------------------------- access
    public function test_login_and_a_student_account_are_required(): void
    {
        $this->getJson('/api/statements/savings-balance')->assertStatus(401);
        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 100])->assertStatus(401);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/statements/savings-balance')->assertStatus(403);
        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 100])->assertStatus(403);
    }

    // ---------------------------------------------------------------- store and read
    public function test_nothing_is_entered_until_the_student_enters_it(): void
    {
        Sanctum::actingAs($this->student());

        $this->getJson('/api/statements/savings-balance')
            ->assertStatus(200)
            ->assertJsonPath('data.amount', null)
            ->assertJsonPath('data.updated_at', null);
    }

    public function test_the_balance_is_saved_on_the_profile_and_read_back_with_a_timestamp_that_has_an_offset(): void
    {
        Http::fake();
        $u = $this->student();
        Sanctum::actingAs($u);

        $res = $this->putJson('/api/statements/savings-balance', ['savings_balance' => '2500.5'])
            ->assertStatus(200)
            ->assertJsonPath('cards_refreshed', false);        // no statement yet, so nothing to refresh
        $this->assertAmount(2500.5, $res);

        $this->assertEqualsWithDelta(2500.5, $this->dbBalance($u), 0.001);

        $res = $this->getJson('/api/statements/savings-balance')->assertStatus(200);
        $this->assertAmount(2500.5, $res);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/', $res->json('data.updated_at'));
        Http::assertNothingSent();
    }

    public function test_zero_is_a_valid_balance_and_null_removes_it(): void
    {
        Http::fake();
        Sanctum::actingAs($this->student());

        $res = $this->putJson('/api/statements/savings-balance', ['savings_balance' => 0])->assertStatus(200);
        $this->assertAmount(0.0, $res);                       // zero is a real amount, not "nothing entered"

        $this->putJson('/api/statements/savings-balance', ['savings_balance' => null])
            ->assertStatus(200)->assertJsonPath('data.amount', null)->assertJsonPath('data.updated_at', null);
    }

    #[DataProvider('badValues')]
    public function test_bad_values_are_refused_with_a_readable_message(mixed $value): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);

        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 1000]);
        $this->putJson('/api/statements/savings-balance', ['savings_balance' => $value])
            ->assertStatus(422)->assertJsonValidationErrors('savings_balance');

        // the earlier good value is untouched
        $this->assertEqualsWithDelta(1000.0, $this->dbBalance($u), 0.001);
    }

    public static function badValues(): array
    {
        return [['-1'], ['abc'], ['100000001'], [[5]], [true]];
    }

    public function test_the_field_must_be_sent_so_a_mistake_cannot_silently_clear_the_balance(): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);
        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 700]);

        $this->putJson('/api/statements/savings-balance', [])->assertStatus(422)->assertJsonValidationErrors('savings_balance');
        $this->assertEqualsWithDelta(700.0, $this->dbBalance($u), 0.001);
    }

    public function test_a_student_without_a_profile_is_told_what_to_do(): void
    {
        Sanctum::actingAs($this->student(false));

        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 500])
            ->assertStatus(422)->assertJsonPath('code', 'PROFILE_REQUIRED');
    }

    public function test_students_only_ever_see_and_change_their_own_balance(): void
    {
        Http::fake();
        $a = $this->student();
        $b = $this->student();
        DB::table('student_profiles')->where('student_id', $b->id)->update(['savings_balance' => 9999]);

        Sanctum::actingAs($a);
        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 100])->assertStatus(200);
        $this->assertAmount(100.0, $this->getJson('/api/statements/savings-balance'));

        $this->assertEqualsWithDelta(9999.0, $this->dbBalance($b), 0.001);
    }

    // ---------------------------------------------------------------- the rule engine uses it
    public function test_saving_the_balance_sends_it_to_the_engine_and_refreshes_the_cards(): void
    {
        Http::fake(['*/v1/insights' => Http::response($this->insightsBody([$this->investingCard()]))]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->putJson('/api/statements/savings-balance', ['savings_balance' => 1500])
            ->assertStatus(200)->assertJsonPath('cards_refreshed', true);

        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/v1/insights') && $r['extra_savings'] == 1500);
        $this->assertSame(1, Recommendation::where('student_id', $u->id)->where('rule_id', 'learn_investing_basics')->count());
    }

    public function test_the_saved_balance_is_used_when_the_recommendations_page_loads_and_on_insights(): void
    {
        Http::fake(['*/v1/insights' => Http::response($this->insightsBody([$this->investingCard()]))]);
        $u = $this->student();
        $this->seedStatement($u);
        DB::table('student_profiles')->where('student_id', $u->id)->update(['savings_balance' => 800]);
        Sanctum::actingAs($u);

        $res = $this->getJson('/api/statements/recommendations')->assertStatus(200);
        $this->assertAmount(800.0, $res, 'data.savings_balance.amount');
        Http::assertSent(fn ($r) => $r['extra_savings'] == 800);

        // an explicit value overrides the saved one for that request only
        $this->getJson('/api/statements/insights?extra_savings=50')->assertStatus(200);
        Http::assertSent(fn ($r) => $r['extra_savings'] == 50);
        $this->getJson('/api/statements/insights')->assertStatus(200);
        Http::assertSentCount(3);
    }

    public function test_no_balance_means_zero_is_sent(): void
    {
        Http::fake(['*/v1/insights' => Http::response($this->insightsBody([$this->investingCard()]))]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->getJson('/api/statements/recommendations')->assertStatus(200)->assertJsonPath('data.savings_balance.amount', null);
        Http::assertSent(fn ($r) => $r['extra_savings'] == 0);
    }

    public function test_the_simulator_hint_reaches_the_page(): void
    {
        Http::fake(['*/v1/insights' => Http::response($this->insightsBody([$this->investingCard(600)]))]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->getJson('/api/statements/recommendations')
            ->assertJsonPath('data.recommendations.0.simulator.investment_type', 'mmf')
            ->assertJsonPath('data.recommendations.0.simulator.monthly_amount', 600);
    }

    public function test_the_balance_is_kept_even_when_the_engine_is_down(): void
    {
        Http::fake(['*/v1/insights' => Http::response(['status' => 'error', 'code' => 'INTERNAL', 'message' => 'x'], 500)]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $res = $this->putJson('/api/statements/savings-balance', ['savings_balance' => 1200])
            ->assertStatus(200)->assertJsonPath('cards_refreshed', false);
        $this->assertAmount(1200.0, $res);

        $this->assertEqualsWithDelta(1200.0, $this->dbBalance($u), 0.001);
    }
}