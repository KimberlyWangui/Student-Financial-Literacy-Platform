<?php

namespace Tests\Feature;

use App\Models\Recommendation;
use App\Models\Statement;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Rule-based cards saved into `recommendations`. Uses Http::fake, so no Flask server is needed.
 */
class StatementRecommendationsTest extends TestCase
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

    private function student(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    /** One stored transaction and statement, so the endpoint has something to send to Flask. */
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

    private function card(string $id, array $o = []): array
    {
        return array_merge([
            'id' => $id, 'category' => 'Saving', 'title' => "Title {$id}", 'what' => "What {$id}",
            'why' => "Why {$id}", 'first_step' => "Step {$id}", 'learn' => null, 'impact_kes' => 900,
            'confidence' => 'high', 'priority' => 10, 'evidence' => [],
        ], $o);
    }

    private function insights(array $cards): array
    {
        return [
            'status' => 'ok', 'parser_version' => '1.0.0', 'metrics' => [], 'monthly_flows' => [],
            'data_quality' => ['days_since_last' => 3, 'last_transaction' => '2026-02-01T10:00:00'],
            'stage' => ['stage' => 'stable', 'confidence' => 'high', 'borrowing' => 'none_detected',
                        'buffer_days' => 9.0, 'reasons' => ['r'], 'notes' => ['n'],
                        'next_step' => ['id' => 'build_buffer', 'title' => 'Build a small buffer first']],
            'actions' => $cards,
        ];
    }

    private function fakeInsights(array ...$responses): void
    {
        $seq = Http::sequence();
        foreach ($responses as $cards) {
            $seq->push($this->insights($cards));
        }
        Http::fake(['*/v1/insights' => $seq]);
    }

    public function test_requires_login_and_a_student_account(): void
    {
        $this->getJson('/api/statements/recommendations')->assertStatus(401);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/statements/recommendations')->assertStatus(403);
    }

    public function test_no_statement_is_a_clear_404(): void
    {
        Http::fake();
        Sanctum::actingAs($this->student());

        $this->getJson('/api/statements/recommendations')
            ->assertStatus(404)->assertJsonPath('code', 'NO_STATEMENT');
        Http::assertNothingSent();
    }

    public function test_cards_are_saved_as_system_rule_recommendations_and_returned_in_rank_order(): void
    {
        $this->fakeInsights([
            $this->card('upload_recent_statement', ['category' => 'General', 'priority' => 0, 'impact_kes' => null]),
            $this->card('build_buffer', ['learn' => 'Not guaranteed.']),
        ]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $res = $this->getJson('/api/statements/recommendations')->assertStatus(200);

        $res->assertJsonPath('data.recommendations.0.rule_id', 'upload_recent_statement')
            ->assertJsonPath('data.recommendations.1.rule_id', 'build_buffer')
            ->assertJsonPath('data.recommendations.1.first_step', 'Step build_buffer')
            ->assertJsonPath('data.recommendations.1.status', 'pending')
            ->assertJsonPath('data.stage.stage', 'stable')
            ->assertJsonPath('data.statement.count', 1)
            ->assertJsonPath('data.statement.period_start', '2026-01-01T10:00:00');

        $row = Recommendation::where('student_id', $u->id)->where('rule_id', 'build_buffer')->first();
        $this->assertNotNull($row);
        $this->assertSame('System_Rule', $row->source_type);
        $this->assertSame('rules-1.0.0', $row->model_version);
        $this->assertNull($row->confidence_score);
        $this->assertSame('Saving', $row->category);
        $this->assertSame('Why build_buffer', $row->reasoning);
        $this->assertSame("What build_buffer\n\nFirst step: Step build_buffer\n\nNot guaranteed.", $row->recomm_text);
        $this->assertSame($row->recommendation_id, $res->json('data.recommendations.1.recommendation_id'));
    }

    public function test_asking_again_updates_cards_without_duplicating_them(): void
    {
        $this->fakeInsights([$this->card('build_buffer')], [$this->card('build_buffer', ['title' => 'New title'])]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->getJson('/api/statements/recommendations')->assertStatus(200);
        $id = Recommendation::where('student_id', $u->id)->value('recommendation_id');
        $this->getJson('/api/statements/recommendations')->assertStatus(200);

        $this->assertSame(1, Recommendation::where('student_id', $u->id)->count());
        $row = Recommendation::where('student_id', $u->id)->first();
        $this->assertSame($id, $row->recommendation_id);
        $this->assertSame('New title', $row->title);
    }

    public function test_status_and_feedback_survive_a_refresh(): void
    {
        $this->fakeInsights([$this->card('build_buffer')], [$this->card('build_buffer', ['what' => 'Reworded'])]);
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->getJson('/api/statements/recommendations')->assertStatus(200);
        Recommendation::where('student_id', $u->id)->update(['status' => 'accepted', 'feedback' => 'Helpful']);

        $this->getJson('/api/statements/recommendations')
            ->assertStatus(200)
            ->assertJsonPath('data.recommendations.0.status', 'accepted')
            ->assertJsonPath('data.recommendations.0.feedback', 'Helpful');
        $this->assertStringContainsString('Reworded', Recommendation::where('student_id', $u->id)->value('recomm_text'));
    }

    public function test_a_card_that_stops_applying_is_superseded_and_can_come_back(): void
    {
        $this->fakeInsights(
            [$this->card('build_buffer'), $this->card('plan_big_payments', ['category' => 'Budget'])],
            [$this->card('build_buffer')],
            [$this->card('build_buffer'), $this->card('plan_big_payments', ['category' => 'Budget'])],
        );
        $u = $this->student();
        $this->seedStatement($u);
        Sanctum::actingAs($u);

        $this->getJson('/api/statements/recommendations')->assertJsonCount(2, 'data.recommendations');

        $this->getJson('/api/statements/recommendations')->assertJsonCount(1, 'data.recommendations');
        $gone = Recommendation::where('student_id', $u->id)->where('rule_id', 'plan_big_payments')->first();
        $this->assertNotNull($gone->superseded_at);                      // kept as history, not deleted

        $this->getJson('/api/statements/recommendations')->assertJsonCount(2, 'data.recommendations');
        $this->assertNull($gone->fresh()->superseded_at);
        $this->assertSame(2, Recommendation::where('student_id', $u->id)->count());
    }

    public function test_older_ai_recommendations_are_never_returned_or_touched(): void
    {
        $this->fakeInsights([$this->card('build_buffer')], [$this->card('build_buffer')]);
        $u = $this->student();
        $this->seedStatement($u);
        $old = Recommendation::create([
            'student_id' => $u->id, 'title' => 'Old AI advice', 'recomm_text' => 'Old', 'category' => 'Saving',
            'source_type' => 'AI_Model', 'status' => 'pending',
        ]);
        Sanctum::actingAs($u);

        $res = $this->getJson('/api/statements/recommendations')->assertStatus(200);
        $this->assertNotContains('Old AI advice', collect($res->json('data.recommendations'))->pluck('title')->all());
        $this->getJson('/api/statements/recommendations')->assertStatus(200);

        $this->assertNull($old->fresh()->superseded_at);
        $this->assertNull($old->fresh()->rule_id);
    }

    public function test_one_student_never_sees_or_changes_anothers_cards(): void
    {
        $this->fakeInsights([$this->card('build_buffer')], [$this->card('plan_big_payments')]);
        $a = $this->student();
        $b = $this->student();
        $this->seedStatement($a);
        $this->seedStatement($b);

        Sanctum::actingAs($a);
        $this->getJson('/api/statements/recommendations')->assertStatus(200);
        Sanctum::actingAs($b);
        $this->getJson('/api/statements/recommendations')
            ->assertJsonCount(1, 'data.recommendations')
            ->assertJsonPath('data.recommendations.0.rule_id', 'plan_big_payments');

        $this->assertNull(Recommendation::where('student_id', $a->id)->where('rule_id', 'build_buffer')->value('superseded_at'));
    }

    public function test_uploading_a_statement_creates_the_cards_straight_away(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response([
                'status' => 'ok',
                'report' => ['parser_version' => '1.0.0', 'rows_parsed' => 1,
                             'period' => ['start' => '2026-01-01T10:00:00', 'end' => '2026-01-01T10:00:00'],
                             'balance_breaks' => 0, 'warnings' => []],
                'transactions' => [[
                    'row_id' => 'r1', 'receipt_id' => 'rc1', 'time' => '2026-01-01T10:00:00', 'type' => 'received_money',
                    'funding' => 'wallet', 'direction' => 'in', 'amount' => 1000.0, 'paid_in' => 1000.0,
                    'withdrawn' => 0.0, 'balance' => 1000.0, 'payee' => null, 'merchant_id' => null,
                ]],
            ]),
            '*/v1/insights' => Http::response($this->insights([$this->card('build_buffer')])),
        ]);
        $u = $this->student();
        Sanctum::actingAs($u);

        $this->postJson('/api/statements', [
            'file' => UploadedFile::fake()->create('statement.pdf', 100, 'application/pdf'),
            'password' => 'secret123',
            'consent' => '1',
        ])->assertStatus(201);

        $this->assertSame(1, Recommendation::where('student_id', $u->id)->where('rule_id', 'build_buffer')->count());
    }

    public function test_deleting_my_data_removes_my_cards_but_not_older_ai_rows(): void
    {
        $this->fakeInsights([$this->card('build_buffer')]);
        $u = $this->student();
        $this->seedStatement($u);
        $old = Recommendation::create([
            'student_id' => $u->id, 'title' => 'Old AI advice', 'recomm_text' => 'Old', 'category' => 'Saving',
            'source_type' => 'AI_Model', 'status' => 'pending',
        ]);
        Sanctum::actingAs($u);
        $this->getJson('/api/statements/recommendations')->assertStatus(200);

        $this->deleteJson('/api/statements/data')->assertStatus(200);

        $this->assertSame(0, Recommendation::where('student_id', $u->id)->whereNotNull('rule_id')->count());
        $this->assertNotNull(Recommendation::find($old->recommendation_id));
        $this->getJson('/api/statements/recommendations')->assertStatus(404);
    }
}
