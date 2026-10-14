<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Hub, Budgets and Goals are removed from PennyWise.
 * This drops their tables, and makes badges.criteria_type a plain string so the
 * new badge types (statement_count, simulation_count, simulation_types) can be stored
 * even if the column was created as an ENUM of the old types.
 *
 * NOT reversible: dropped data cannot be restored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('financial_data');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('goals');

        if (Schema::hasColumn('badges', 'criteria_type')) {
            if (DB::getDriverName() === 'sqlite') {
                // SQLite stores enums as text with a CHECK; rebuild the column.
                Schema::table('badges', function ($table) {
                    $table->dropColumn('criteria_type');
                });
                Schema::table('badges', function ($table) {
                    $table->string('criteria_type', 50)->default('statement_count');
                });
            } else {
                Schema::table('badges', function ($table) {
                    $table->string('criteria_type', 50)->change();
                });
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: the removed tables and their data are gone for good.
    }
};
