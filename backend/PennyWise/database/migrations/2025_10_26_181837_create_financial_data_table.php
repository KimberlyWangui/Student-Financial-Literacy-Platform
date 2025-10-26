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
        Schema::create('financial_data', function (Blueprint $table) {
            $table->id('entry_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->string('entry_type'); // e.g., 'income', 'expense'
            $table->string('category'); // e.g., 'food', 'transport', 'entertainment', 'allowance'
            $table->decimal('amount', 10, 2); // 10 digits total, 2 decimal places
            $table->date('entry_date');
            $table->timestamps();

            // Add indexes for faster queries
            $table->index('student_id');
            $table->index('entry_type');
            $table->index('entry_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_data');
    }
};