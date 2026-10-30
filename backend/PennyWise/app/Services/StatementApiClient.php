<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\RequestException;
use GuzzleHttp\Psr7\Utils;

/**
 * Talks to the Flask statement service (finance_model_api/statement_api.py).
 *
 * Never logs the statement password, the PDF, or any response body: the only
 * things written to the log are the HTTP status and the service's error code.
 */
class StatementApiClient
{
    // Errors the student can act on. Everything else becomes a generic message.
    private const USER_FACING = [
        'WRONG_PASSWORD' => 422,
        'NOT_PDF' => 422,
        'UNREADABLE' => 422,
        'NO_TRANSACTIONS' => 422,
        'LAYOUT_CHANGED' => 422,
        'TOO_LARGE' => 413,
    ];

    /**
     * Parse an encrypted M-Pesa statement. Returns ['report' => [...], 'transactions' => [...]].
     * $userId must be the same value every time for one user, because the ids are keyed on it.
     */
    public function parse(UploadedFile $file, string $password, int $userId): array
    {
        $path = $file->getRealPath();
        $contents = $path ? @file_get_contents($path) : false;
        if ($contents === false) {
            throw new StatementApiException('UNREADABLE', 'We could not read the uploaded file.', 422);
        }
        try {
            $response = $this->request()
                ->timeout(120)   // parsing took about 6 s for 660 rows; leave room for a year of data
                ->attach('file', Utils::streamFor($contents), 'statement.pdf')
                ->post('/v1/parse', [
                    'user_id' => (string) $userId,
                    'password' => $password,
                ]);
        } catch (ConnectionException) {
            throw $this->unavailable();
        }
        return $this->handle($response);
    }

    /**
     * Compute metrics, stage and next step from stored transactions.
     * $transactions must be ordered by time, then id (oldest first).
     */
    public function insights(array $transactions, float $extraSavings = 0.0): array
    {
        try {
            $response = $this->request()
                ->timeout(60)
                ->asJson()
                ->post('/v1/insights', [
                    'transactions' => $transactions,
                    'extra_savings' => $extraSavings,
                ]);
        } catch (ConnectionException) {
            throw $this->unavailable();
        }

        return $this->handle($response);
    }

    private function request(): PendingRequest
    {
        $token = config('services.statement_api.token');
        $url = config('services.statement_api.url');

        if (! $token || ! $url) {
            Log::error('Statement API is not configured (STATEMENT_API_URL / STATEMENT_API_TOKEN).');
            throw new StatementApiException('NOT_CONFIGURED', 'The statement service is not set up yet.', 500);
        }

        return Http::baseUrl(rtrim($url, '/'))
            ->withHeaders(['X-Internal-Token' => $token])
            ->acceptJson()
            ->connectTimeout(15)
            ->retry(
                7,
                app()->environment('testing') ? 0 : 12000,   
                fn ($e) => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [502, 503, 504])),
                throw: false
            );
    }

    private function handle(Response $response): array
    {
        if ($response->successful()) {
            $json = $response->json();
            if (is_array($json) && ($json['status'] ?? null) === 'ok') {
                return $json;
            }
            Log::error('Statement API returned an unexpected success body', ['http' => $response->status()]);
            throw new StatementApiException('SERVICE_ERROR', 'The statement service gave an unexpected answer.', 502);
        }

        $code = (string) ($response->json('code') ?? 'UPSTREAM_ERROR');

        if (isset(self::USER_FACING[$code])) {
            throw new StatementApiException(
                $code,
                (string) ($response->json('message') ?: 'We could not process this statement.'),
                self::USER_FACING[$code],
            );
        }

        // UNAUTHORIZED (token mismatch), ROWS_NOT_CHRONOLOGICAL, INTERNAL, ...: our problem, not the student's.
        Log::error('Statement API error', ['http' => $response->status(), 'code' => $code]);
        throw new StatementApiException('SERVICE_ERROR', 'The statement service had a problem. Please try again later.', 502);
    }

    private function unavailable(): StatementApiException
    {
        Log::error('Statement API is unreachable.');
        return new StatementApiException('SERVICE_UNAVAILABLE', 'The statement service is not available right now. Please try again later.', 503);
    }
}
