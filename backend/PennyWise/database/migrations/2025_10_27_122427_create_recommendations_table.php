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
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id('recommendation_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('recomm_text');
            $table->string('category');
            $table->decimal('confidence_score', 5, 2)->nullable(); // 0-100
            $table->text('reasoning')->nullable();
            $table->decimal('impact_estimate', 10, 2)->nullable();
            $table->enum('source_type', ['AI_Model', 'Admin', 'System_Rule'])->default('System_Rule');
            $table->string('model_version')->nullable();
            $table->enum('status', ['pending', 'viewed', 'accepted', 'rejected', 'ignored'])->default('pending');
            $table->text('feedback')->nullable();
            $table->timestamps();

            // Add indexes for faster queries
            $table->index('student_id');
            $table->index('category');
            $table->index('status');
            $table->index('source_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recommendations');
    }
};