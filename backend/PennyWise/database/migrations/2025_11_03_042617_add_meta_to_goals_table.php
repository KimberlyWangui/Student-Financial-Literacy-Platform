<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->enum('goal_type', ['short-term', 'long-term'])->default('short-term')->after('target_amount');
            $table->enum('status', ['in-progress', 'completed', 'missed'])->default('in-progress')->after('goal_type');
        });
    }

    public function down(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn(['goal_type', 'status']);
        });
    }
};
