<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per uploaded M-Pesa statement. The PDF itself is never stored,
     * only this summary of what the upload contained.
     */
    public function up(): void
    {
        Schema::create('statements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('period_start');
            $table->dateTime('period_end');
            $table->unsignedInteger('rows_parsed');
            $table->unsignedInteger('rows_new')->default(0);     // rows not already stored from an earlier upload
            $table->unsignedInteger('balance_breaks')->default(0);
            $table->string('parser_version', 20);
            $table->json('warnings')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('statements');
    }
};
