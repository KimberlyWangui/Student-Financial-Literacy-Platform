<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('budgets', function (Blueprint $table) {
            $table->id('budget_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->string('category');
            $table->decimal('amount', 10, 2); // 10 digits total, 2 decimal places
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamps();

            // Add indexes for faster queries
            $table->index('student_id');
            $table->index('category');
            $table->index(['start_date', 'end_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budgets');
    }
};