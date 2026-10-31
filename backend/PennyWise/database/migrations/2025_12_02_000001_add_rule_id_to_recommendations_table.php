<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rule-based cards from the statement engine are stored in `recommendations`, one row per
     * (student, rule). `rule_id` names the rule (e.g. build_buffer). Re-running the engine updates the
     * same row, so a student's status and feedback survive. A card that stops applying is marked
     * `superseded_at` instead of being deleted.
     *
     * Older AI_Model rows keep rule_id = NULL; NULLs do not clash with the unique index.
     */
    public function up(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->string('rule_id', 40)->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->unique(['student_id', 'rule_id']);
        });
    }

    public function down(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'rule_id']);
            $table->dropColumn(['rule_id', 'superseded_at']);
        });
    }
};
