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
        Schema::create('simulations', function (Blueprint $table) {
            $table->id('simulation_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->decimal('principal', 12, 2); // Starting amount
            $table->decimal('interest_rate', 5, 2); // Interest rate percentage (e.g., 5.50 for 5.5%)
            $table->integer('time_period'); // Time period (e.g., months or years)
            $table->decimal('result', 12, 2); // Final amount after calculation
            $table->timestamps();

            // Add indexes for faster queries
            $table->index('student_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('simulations');
    }
};