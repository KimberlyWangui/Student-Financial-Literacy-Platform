<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cleaned M-Pesa rows as returned by the Flask /v1/parse endpoint.
     *
     * Nothing here identifies a counterparty: no names, phone numbers, receipt
     * numbers or paybill account numbers. row_id, receipt_id and payee are
     * keyed hashes that only make sense within one user.
     *
     * `id` doubles as the insertion order. Rows that share the same second
     * (a transfer and its fee) keep their order because they are inserted
     * together, so always read with ORDER BY time, id.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('statement_id')->nullable()->constrained('statements')->nullOnDelete();

            $table->string('row_id', 32);
            $table->string('receipt_id', 32);
            $table->dateTime('time');                 // Nairobi wall-clock time exactly as on the statement
            $table->string('type', 32);
            $table->string('funding', 10);            // wallet | fuliza
            $table->string('direction', 8);           // in | out | none
            $table->decimal('amount', 14, 2);
            $table->decimal('paid_in', 14, 2);
            $table->decimal('withdrawn', 14, 2);      // negative, as on the statement
            $table->decimal('balance', 14, 2);
            $table->string('payee', 16)->nullable();       // keyed pseudonym, e.g. p_ab12cd34ef
            $table->string('merchant_id', 32)->nullable(); // public till or paybill number only
            $table->timestamps();

            $table->unique(['user_id', 'row_id']);    // overlapping statements never double count
            $table->index(['user_id', 'time', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
