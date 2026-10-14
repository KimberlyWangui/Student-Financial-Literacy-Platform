<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Statement extends Model
{
    protected $fillable = [
        'user_id',
        'period_start',
        'period_end',
        'rows_parsed',
        'rows_new',
        'balance_breaks',
        'parser_version',
        'warnings',
        'consent_version',
        'consented_at',
    ];

    // period_start and period_end are deliberately NOT cast to datetime: they are
    // Nairobi wall-clock times and a cast would shift them by the app timezone.
    protected $casts = [
        'rows_parsed' => 'integer',
        'rows_new' => 'integer',
        'balance_breaks' => 'integer',
        'warnings' => 'array',
        'consented_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}
