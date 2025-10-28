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
        Schema::create('student_badges', function (Blueprint $table) {
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('badge_id')->constrained('badges', 'badge_id')->onDelete('cascade');
            $table->timestamp('earned_at')->useCurrent();

            // Composite primary key
            $table->primary(['student_id', 'badge_id']);

            // Add indexes
            $table->index('student_id');
            $table->index('badge_id');
            $table->index('earned_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_badges');
    }
};