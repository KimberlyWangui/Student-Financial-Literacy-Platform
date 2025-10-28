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
        Schema::create('badges', function (Blueprint $table) {
            $table->id('badge_id');
            $table->string('badge_name');
            $table->text('description');
            $table->text('criteria');
            $table->string('image_url')->nullable(); // Path to badge image
            $table->timestamps();

            // Add index for faster queries
            $table->index('badge_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('badges');
    }
};