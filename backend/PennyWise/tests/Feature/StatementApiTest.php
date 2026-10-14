<?php

namespace Tests\Feature;

use App\Models\Statement;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Uses Http::fake, so no Flask server is needed. If User::factory() fails on a required
 * column in your users table, add it to makeStudent() below.
 */
class StatementApiTest extends TestCase
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

    private function makeStudent(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    private function fakeRows(): array
    {
        $row = fn (string $id, string $time, string $type, string $dir, float $in, float $out, float $bal) => [
            'row_id' => $id, 'receipt_id' => 'rc_' . $id, 'time' => $time, 'type' => $type,
            'funding' => 'wallet', 'direction' => $dir, 'amount' => $in + abs($out),
            'paid_in' => $in, 'withdrawn' => $out, 'balance' => $bal,
            'payee' => $type === 'send_money' ? 'p_ab12cd34ef' : null, 'merchant_id' => null,
        ];

        return [
            $row('r1', '2025-01-02T16:39:34', 'received_money', 'in', 1000.0, 0.0, 1000.0),
            $row('r2', '2025-01-03T08:00:00', 'send_money', 'out', 0.0, -300.0, 700.0),
            $row('r3', '2025-01-03T08:00:00', 'fee', 'out', 0.0, -11.0, 689.0),   // same second as r2
        ];
    }

    private function fakeParseBody(): array
    {
        return [
            'status' => 'ok',
            'report' => [
                'parser_version' => '1.0.0', 'rows_parsed' => 3,
                'period' => ['start' => '2025-01-02T16:39:34', 'end' => '2025-01-03T08:00:00'],
                'balance_breaks' => 0, 'warnings' => [],
            ],
            'transactions' => $this->fakeRows(),
        ];
    }

    private function fakeInsightsBody(): array
    {
        return [
            'status' => 'ok', 'parser_version' => '1.0.0', 'metrics' => [], 'monthly_flows' => [],
            'data_quality' => [],
            'stage' => ['stage' => 'not_enough_data', 'confidence' => 'low', 'borrowing' => 'unknown',
                        'buffer_days' => null, 'reasons' => [], 'notes' => [],
                        'next_step' => ['id' => 'upload_longer_statement', 'title' => 'Upload a longer statement']],
        ];
    }

    private function upload(string $password = 'secret123')
    {
        return $this->postJson('/api/statements', [
            'file' => UploadedFile::fake()->create('statement.pdf', 100, 'application/pdf'),
            'password' => $password,
            'consent' => '1',
        ]);
    }

    public function test_upload_needs_the_students_agreement_and_records_it(): void
    {
        Http::fake(['*/v1/parse' => Http::response($this->fakeParseBody()), '*/v1/insights' => Http::response($this->fakeInsightsBody())]);
        $u = $this->makeStudent();
        Sanctum::actingAs($u);
        $file = fn () => UploadedFile::fake()->create('statement.pdf', 100, 'application/pdf');

        $this->postJson('/api/statements', ['file' => $file(), 'password' => 'x'])
            ->assertStatus(422)->assertJsonValidationErrors('consent');
        $this->postJson('/api/statements', ['file' => $file(), 'password' => 'x', 'consent' => '0'])
            ->assertStatus(422)->assertJsonValidationErrors('consent');
        Http::assertNothingSent();                                   // the PDF never reaches the parser without agreement
        $this->assertSame(0, Statement::where('user_id', $u->id)->count());

        $this->postJson('/api/statements', ['file' => $file(), 'password' => 'x', 'consent' => '1'])->assertStatus(201);
        $row = Statement::where('user_id', $u->id)->first();
        $this->assertSame('2026-10', $row->consent_version);
        $this->assertNotNull($row->consented_at);
    }

    public function test_requires_login(): void
    {
        $this->postJson('/api/statements')->assertStatus(401);
        $this->getJson('/api/statements/insights')->assertStatus(401);
    }

    public function test_only_students_can_upload(): void
    {
        Http::fake();
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->upload()->assertStatus(403);
        Http::assertNothingSent();
    }

    public function test_upload_stores_rows_in_order_and_returns_insights(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response($this->fakeParseBody()),
            '*/v1/insights' => Http::response($this->fakeInsightsBody()),
        ]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);

        $this->upload()
            ->assertStatus(201)
            ->assertJsonPath('statement.rows_parsed', 3)
            ->assertJsonPath('statement.rows_new', 3)
            ->assertJsonPath('insights.stage.stage', 'not_enough_data');

        $this->assertSame(
            ['r1', 'r2', 'r3'],
            Transaction::where('user_id', $student->id)->orderBy('id')->pluck('row_id')->all()
        );
        $this->assertSame('2025-01-03 08:00:00', Transaction::where('row_id', 'r2')->value('time'));

        // The token header and the student's id (not email or name) go to Flask.
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/v1/parse')
            && $request->hasHeader('X-Internal-Token', 'test-internal-token-0123456789'));
    }

    public function test_uploading_an_overlapping_statement_does_not_double_count(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response($this->fakeParseBody()),
            '*/v1/insights' => Http::response($this->fakeInsightsBody()),
        ]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);

        $this->upload()->assertStatus(201)->assertJsonPath('statement.rows_new', 3);
        $this->upload()->assertStatus(201)->assertJsonPath('statement.rows_new', 0);

        $this->assertSame(3, Transaction::where('user_id', $student->id)->count());
        $this->assertSame(2, Statement::where('user_id', $student->id)->count());
    }

    public function test_insights_are_sent_oldest_first_with_ties_in_insertion_order(): void
    {
        Http::fake(['*/v1/insights' => Http::response($this->fakeInsightsBody())]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);

        // Stored out of order on purpose: r3 is inserted before r2 and r1.
        foreach (['r3' => 2, 'r2' => 1, 'r1' => 0] as $id => $n) {
            $rows = collect($this->fakeRows())->firstWhere('row_id', $id);
            Transaction::create(array_merge($rows, [
                'user_id' => $student->id,
                'time' => str_replace('T', ' ', $rows['time']),
            ]));
        }

        $this->getJson('/api/statements/insights?extra_savings=500')->assertStatus(200);

        Http::assertSent(function ($request) {
            $ids = collect($request['transactions'])->pluck('row_id')->all();
            // r1 is earliest; r3 and r2 share a second, so the one inserted first (r3) leads.
            return $ids === ['r1', 'r3', 'r2'] && $request['extra_savings'] == 500;
        });
    }

    public function test_insights_without_a_statement_is_a_clear_404(): void
    {
        Http::fake();
        Sanctum::actingAs($this->makeStudent());

        $this->getJson('/api/statements/insights')
            ->assertStatus(404)
            ->assertJsonPath('code', 'NO_STATEMENT');
        Http::assertNothingSent();
    }

    public function test_wrong_password_is_reported_and_nothing_is_stored(): void
    {
        Http::fake(['*/v1/parse' => Http::response(
            ['status' => 'error', 'code' => 'WRONG_PASSWORD', 'message' => 'The statement password is wrong.'], 422
        )]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);

        $this->upload('nope')
            ->assertStatus(422)
            ->assertJsonPath('code', 'WRONG_PASSWORD');

        $this->assertSame(0, Transaction::count());
        $this->assertSame(0, Statement::count());
    }

    public function test_internal_errors_do_not_leak_details(): void
    {
        Http::fake(['*/v1/parse' => Http::response(
            ['status' => 'error', 'code' => 'UNAUTHORIZED', 'message' => 'bad token'], 401
        )]);
        Sanctum::actingAs($this->makeStudent());

        $response = $this->upload()->assertStatus(502)->assertJsonPath('code', 'SERVICE_ERROR');
        $this->assertStringNotContainsString('token', strtolower($response->getContent()));
    }

    public function test_a_failed_insights_call_does_not_lose_the_upload(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response($this->fakeParseBody()),
            '*/v1/insights' => Http::response(['status' => 'error', 'code' => 'INTERNAL', 'message' => 'x'], 500),
        ]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);

        $this->upload()
            ->assertStatus(201)
            ->assertJsonPath('insights', null)
            ->assertJsonPath('insights_error.code', 'SERVICE_ERROR');
        $this->assertSame(3, Transaction::where('user_id', $student->id)->count());
    }

    public function test_students_cannot_see_or_delete_each_others_data(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response($this->fakeParseBody()),
            '*/v1/insights' => Http::response($this->fakeInsightsBody()),
        ]);
        $a = $this->makeStudent();
        $b = $this->makeStudent();

        Sanctum::actingAs($a);
        $this->upload()->assertStatus(201);

        Sanctum::actingAs($b);
        $this->getJson('/api/statements')->assertJsonCount(0, 'data');
        $this->deleteJson('/api/statements/data')->assertStatus(200);

        $this->assertSame(3, Transaction::where('user_id', $a->id)->count());   // a's rows survive b's delete
    }

    public function test_delete_removes_all_of_my_data(): void
    {
        Http::fake([
            '*/v1/parse' => Http::response($this->fakeParseBody()),
            '*/v1/insights' => Http::response($this->fakeInsightsBody()),
        ]);
        $student = $this->makeStudent();
        Sanctum::actingAs($student);
        $this->upload()->assertStatus(201);

        $this->deleteJson('/api/statements/data')
            ->assertStatus(200)
            ->assertJsonPath('deleted.transactions', 3)
            ->assertJsonPath('deleted.statements', 1);

        $this->assertSame(0, Transaction::count());
        $this->assertSame(0, Statement::count());
    }
}
