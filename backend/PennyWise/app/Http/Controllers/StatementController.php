<?php

namespace App\Http\Controllers;

use App\Models\Recommendation;
use App\Models\Statement;
use App\Models\Transaction;
use App\Services\StatementApiClient;
use App\Services\StatementApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StatementController extends Controller
{
    // Columns the Flask /v1/insights endpoint expects, in the shape /v1/parse returned them.
    /** Bump this whenever the privacy wording on the upload form changes in a way that matters. */
    public const CONSENT_VERSION = '2026-10';

    private const INSIGHT_COLUMNS = [
        'row_id', 'receipt_id', 'time', 'type', 'funding', 'direction',
        'amount', 'paid_in', 'withdrawn', 'balance', 'payee', 'merchant_id',
    ];

    public function __construct(private StatementApiClient $client)
    {
    }

    /**
     * Upload an M-Pesa statement PDF: parse it, store the cleaned rows, return fresh insights.
     * Accessible by: students only. The PDF and its password are never stored or logged.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        if ($user->role !== 'student') {
            return $this->error('FORBIDDEN', 'Only students can upload statements.', 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',   // 10 MB, matches MAX_UPLOAD_MB on the Flask side
            'password' => 'required|string|max:128',
            'consent' => 'accepted',
        ], [
            'consent.accepted' => 'Please confirm that you agree before uploading your statement.',
        ]);

        try {
            $parsed = $this->client->parse($request->file('file'), $request->input('password'), $user->id);
        } catch (StatementApiException $e) {
            return $this->error($e->errorCode, $e->getMessage(), $e->httpStatus);
        }

        $report = $parsed['report'];
        $rows = $parsed['transactions'];

        $statement = DB::transaction(function () use ($user, $report, $rows) {
            $statement = Statement::create([
                'user_id' => $user->id,
                'period_start' => $this->naiveTime($report['period']['start']),
                'period_end' => $this->naiveTime($report['period']['end']),
                'rows_parsed' => (int) $report['rows_parsed'],
                'rows_new' => 0,
                'balance_breaks' => (int) $report['balance_breaks'],
                'parser_version' => (string) $report['parser_version'],
                'warnings' => $report['warnings'] ?? [],
                'consent_version' => self::CONSENT_VERSION,
                'consented_at' => now(),
            ]);

            // Insert in the order the API returned them (oldest first, same-second rows already
            // ordered by the balance chain) so `id` preserves that order. Rows already stored from
            // an overlapping statement are skipped by the unique (user_id, row_id) index.
            $now = now();
            $new = 0;
            foreach (array_chunk($rows, 500) as $chunk) {
                $batch = array_map(fn (array $r) => [
                    'user_id' => $user->id,
                    'statement_id' => $statement->id,
                    'row_id' => $r['row_id'],
                    'receipt_id' => $r['receipt_id'],
                    'time' => $this->naiveTime($r['time']),
                    'type' => $r['type'],
                    'funding' => $r['funding'],
                    'direction' => $r['direction'],
                    'amount' => $r['amount'],
                    'paid_in' => $r['paid_in'],
                    'withdrawn' => $r['withdrawn'],
                    'balance' => $r['balance'],
                    'payee' => $r['payee'] ?? null,
                    'merchant_id' => $r['merchant_id'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk);

                $new += Transaction::insertOrIgnore($batch);
            }

            $statement->update(['rows_new' => $new]);

            return $statement;
        });

        // The upload succeeded even if insights fail; the student can retry GET /statements/insights.
        $insights = null;
        $insightsError = null;
        try {
            $insights = $this->buildInsights($user->id, 0.0);
        } catch (StatementApiException $e) {
            $insightsError = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        }

        if ($insights !== null) {
            try {
                $this->syncRecommendations($user->id, $insights);
            } catch (\Throwable $e) {
                // The upload itself succeeded; GET /statements/recommendations will retry the sync.
                Log::error('Recommendation sync failed after upload', ['error' => get_class($e)]);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Statement processed.',
            'statement' => $this->present($statement),
            'insights' => $insights,
            'insights_error' => $insightsError,
        ], 201);
    }

    /**
     * Statements this student has uploaded, newest first.
     */
    public function index(): JsonResponse
    {
        $statements = Statement::where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Statement $s) => $this->present($s));

        return response()->json(['status' => 'success', 'data' => $statements]);
    }

    /**
     * Metrics, stage and next step from everything stored for this student.
     * Optional ?extra_savings=N adds savings held outside the wallet (M-Shwari, Ziidi).
     */
    public function insights(Request $request): JsonResponse
    {
        $user = Auth::user();
        if ($user->role !== 'student') {
            return $this->error('FORBIDDEN', 'Only students have statement insights.', 403);
        }

        $validated = $request->validate(['extra_savings' => 'sometimes|numeric|min:0|max:100000000']);

        try {
            $insights = $this->buildInsights($user->id, (float) ($validated['extra_savings'] ?? 0));
        } catch (StatementApiException $e) {
            return $this->error($e->errorCode, $e->getMessage(), $e->httpStatus);
        }

        if ($insights === null) {
            return $this->error('NO_STATEMENT', 'Upload an M-Pesa statement first.', 404);
        }

        return response()->json(['status' => 'success', 'data' => $insights]);
    }

    /**
     * What the Recommendations page shows: the stage, the current cards and the statement coverage.
     * Recomputes from stored transactions, so a card that depends on time (a stale statement) appears
     * on its own, and keeps each card's status and feedback.
     * Accessible by: students only.
     */
    public function recommendations(): JsonResponse
    {
        $user = Auth::user();
        if ($user->role !== 'student') {
            return $this->error('FORBIDDEN', 'Only students have recommendations.', 403);
        }

        try {
            $insights = $this->buildInsights($user->id, 0.0);
        } catch (StatementApiException $e) {
            return $this->error($e->errorCode, $e->getMessage(), $e->httpStatus);
        }

        if ($insights === null) {
            return $this->error('NO_STATEMENT', 'Upload an M-Pesa statement first.', 404);
        }

        $this->syncRecommendations($user->id, $insights);

        $statements = Statement::where('user_id', $user->id);
        $latest = (clone $statements)->orderByDesc('created_at')->orderByDesc('id')->first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'statement' => [
                    'count' => (clone $statements)->count(),
                    'period_start' => str_replace(' ', 'T', (string) (clone $statements)->min('period_start')),
                    'period_end' => str_replace(' ', 'T', (string) (clone $statements)->max('period_end')),
                    'last_uploaded_at' => $latest?->created_at?->toIso8601String(),   // UTC
                ],
                'stage' => $insights['stage'],
                'data_quality' => [
                    'days_since_last' => $insights['data_quality']['days_since_last'] ?? null,
                    'last_transaction' => $insights['data_quality']['last_transaction'] ?? null,
                ],
                'recommendations' => $this->presentCards($user->id, $insights['actions'] ?? []),
            ],
        ]);
    }

    /**
     * Delete every statement record and transaction stored for this student.
     */
    public function destroy(): JsonResponse
    {
        $userId = Auth::id();

        [$transactions, $statements] = DB::transaction(function () use ($userId) {
            // Cards made from the deleted data go too. Older AI_Model rows (rule_id NULL) are left alone.
            Recommendation::where('student_id', $userId)->whereNotNull('rule_id')->delete();

            return [
                Transaction::where('user_id', $userId)->delete(),
                Statement::where('user_id', $userId)->delete(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Your statement data has been deleted.',
            'deleted' => ['transactions' => $transactions, 'statements' => $statements],
        ]);
    }

    // ------------------------------------------------------------------------------------------

    /**
     * Read the student's stored rows oldest first (time, then id) and ask Flask for insights.
     * Returns null when nothing is stored yet.
     */
    private function buildInsights(int $userId, float $extraSavings): ?array
    {
        $rows = Transaction::where('user_id', $userId)
            ->orderBy('time')
            ->orderBy('id')
            ->get(self::INSIGHT_COLUMNS)
            ->map(fn (Transaction $t) => [
                'row_id' => $t->row_id,
                'receipt_id' => $t->receipt_id,
                'time' => str_replace(' ', 'T', (string) $t->getRawOriginal('time')),
                'type' => $t->type,
                'funding' => $t->funding,
                'direction' => $t->direction,
                'amount' => (float) $t->amount,
                'paid_in' => (float) $t->paid_in,
                'withdrawn' => (float) $t->withdrawn,
                'balance' => (float) $t->balance,
                'payee' => $t->payee,
                'merchant_id' => $t->merchant_id,
            ])
            ->all();

        if ($rows === []) {
            return null;
        }

        $result = $this->client->insights($rows, $extraSavings);
        unset($result['status']);

        return $result;
    }

    /**
     * Save the engine's cards as recommendations: one row per (student, rule). An existing row is
     * updated in place, so its status and feedback are kept; a rule that no longer applies is marked
     * superseded. confidence_score stays NULL, because rule-based cards have no model probability.
     */
    private function syncRecommendations(int $studentId, array $insights): void
    {
        $cards = $insights['actions'] ?? [];
        $version = 'rules-' . ($insights['parser_version'] ?? '0');

        DB::transaction(function () use ($studentId, $cards, $version) {
            if ($cards !== []) {
                $rows = array_map(fn (array $c) => [
                    'student_id' => $studentId,
                    'rule_id' => $c['id'],
                    'title' => $c['title'],
                    'recomm_text' => $this->composeText($c),
                    'category' => $c['category'],
                    'confidence_score' => null,
                    'reasoning' => $c['why'],
                    'impact_estimate' => $c['impact_kes'],
                    'source_type' => 'System_Rule',
                    'model_version' => $version,
                    'status' => 'pending',          // only used when the row is new
                    'feedback' => null,             // only used when the row is new
                    'superseded_at' => null,
                ], $cards);

                Recommendation::upsert(
                    $rows,
                    ['student_id', 'rule_id'],
                    // status and feedback are deliberately NOT updated
                    ['title', 'recomm_text', 'category', 'confidence_score', 'reasoning',
                     'impact_estimate', 'source_type', 'model_version', 'superseded_at'],
                );
            }

            Recommendation::where('student_id', $studentId)
                ->whereNotNull('rule_id')
                ->whereNull('superseded_at')
                ->whereNotIn('rule_id', array_column($cards, 'id'))
                ->update(['superseded_at' => now()]);
        });
    }

    /** The text stored in recomm_text: what to do, the first step, and any learning note. */
    private function composeText(array $card): string
    {
        $text = $card['what'] . "\n\nFirst step: " . $card['first_step'];
        if (! empty($card['learn'])) {
            $text .= "\n\n" . $card['learn'];
        }

        return $text;
    }

    /** The engine's cards in ranked order, joined with the stored row's id, status and feedback. */
    private function presentCards(int $studentId, array $cards): array
    {
        $rows = Recommendation::where('student_id', $studentId)
            ->whereIn('rule_id', array_column($cards, 'id'))
            ->whereNull('superseded_at')
            ->get()
            ->keyBy('rule_id');

        return array_map(function (array $c) use ($rows) {
            $row = $rows->get($c['id']);

            return [
                'recommendation_id' => $row?->recommendation_id,
                'rule_id' => $c['id'],
                'category' => $c['category'],
                'title' => $c['title'],
                'what' => $c['what'],
                'why' => $c['why'],
                'first_step' => $c['first_step'],
                'learn' => $c['learn'] ?? null,
                'impact_kes' => $c['impact_kes'] ?? null,
                'status' => $row?->status ?? 'pending',
                'feedback' => $row?->feedback,
                'created_at' => $row?->created_at?->toIso8601String(),
            ];
        }, $cards);
    }

    private function present(Statement $s): array
    {
        return [
            'id' => $s->id,
            'period_start' => str_replace(' ', 'T', (string) $s->getRawOriginal('period_start')),
            'period_end' => str_replace(' ', 'T', (string) $s->getRawOriginal('period_end')),
            'rows_parsed' => $s->rows_parsed,
            'rows_new' => $s->rows_new,
            'balance_breaks' => $s->balance_breaks,
            'warnings' => $s->warnings ?? [],
            'uploaded_at' => $s->created_at?->toIso8601String(),
        ];
    }

    /** "2025-01-02T16:39:34" -> "2025-01-02 16:39:34", with no timezone conversion. */
    private function naiveTime(string $iso): string
    {
        return str_replace('T', ' ', substr($iso, 0, 19));
    }

    private function error(string $code, string $message, int $status): JsonResponse
    {
        return response()->json(['status' => 'error', 'code' => $code, 'message' => $message], $status);
    }
}
