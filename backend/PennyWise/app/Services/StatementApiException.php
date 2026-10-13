<?php

namespace App\Services;

use RuntimeException;

/**
 * An error from the statement service that is safe to show to the student.
 * errorCode is a stable machine-readable string such as WRONG_PASSWORD.
 */
class StatementApiException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $httpStatus = 502,
    ) {
        parent::__construct($message);
    }
}
