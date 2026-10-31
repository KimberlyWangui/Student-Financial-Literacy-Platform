<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'user_id',
        'statement_id',
        'row_id',
        'receipt_id',
        'time',
        'type',
        'funding',
        'direction',
        'amount',
        'paid_in',
        'withdrawn',
        'balance',
        'payee',
        'merchant_id',
    ];

    // `time` is not cast to datetime on purpose (see Statement). Money columns are
    // read back as strings by PDO; StatementController casts them to float.

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function statement(): BelongsTo
    {
        return $this->belongsTo(Statement::class);
    }
}
