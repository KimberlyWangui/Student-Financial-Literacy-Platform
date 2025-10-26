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
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id('profile_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->string('year_of_study')->nullable();
            $table->string('living_situation')->nullable();
            $table->enum('monthly_allowance_range', [
                '0 – 5,000',
                '5,001 – 10,000',
                '10,001 – 20,000',
                '20,001 – 35,000',
                '35,001 – 50,000+'
            ])->nullable();
            $table->string('course')->nullable();
            $table->timestamps();

            // Add index for faster queries
            $table->index('student_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};