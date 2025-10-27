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
        Schema::create('goals', function (Blueprint $table) {
            $table->id('goal_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->string('goal_name');
            $table->decimal('target_amount', 10, 2); // 10 digits total, 2 decimal places
            $table->decimal('current_amount', 10, 2)->default(0.00);
            $table->date('deadline');
            $table->timestamps();

            // Add indexes for faster queries
            $table->index('student_id');
            $table->index('deadline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('goals');
    }
};