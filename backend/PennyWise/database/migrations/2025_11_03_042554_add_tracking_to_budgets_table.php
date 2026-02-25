<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            $table->decimal('actual_spent', 10, 2)->default(0.00)->after('amount')->comment('actual spent against this budget period');
            // status to indicate whether budget is active, completed, over or under
            $table->enum('status', ['active', 'completed', 'over', 'under'])->default('active')->after('actual_spent');
        });
    }

    public function down(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            $table->dropColumn(['actual_spent', 'status']);
        });
    }
};
