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
        Schema::table('badges', function (Blueprint $table) {
            // Drop the old criteria column
            $table->dropColumn('criteria');
            
            // Add new criteria columns
            $table->enum('criteria_type', [
                'transaction_count',
                'expense_streak',
                'created_budget',
                'stayed_under_budget',
                'goal_count',
                'completed_goal_count'
            ])->after('description');
            
            $table->integer('criteria_value')->after('criteria_type')
                ->comment('The threshold value to earn this badge');
            
            $table->integer('xp_reward')->default(0)->after('criteria_value')
                ->comment('XP points awarded when badge is earned');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('badges', function (Blueprint $table) {
            // Restore the old criteria column
            $table->text('criteria')->after('description');
            
            // Drop the new columns
            $table->dropColumn(['criteria_type', 'criteria_value', 'xp_reward']);
        });
    }
};