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
        Schema::table('student_badges', function (Blueprint $table) {
            $table->integer('xp_earned')->default(0)->after('earned_at')
                ->comment('XP points earned when this badge was awarded');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('student_badges', function (Blueprint $table) {
            $table->dropColumn('xp_earned');
        });
    }
};