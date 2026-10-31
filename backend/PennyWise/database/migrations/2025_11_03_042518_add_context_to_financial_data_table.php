<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_data', function (Blueprint $table) {
            // shorter varchar for method, allow null for legacy rows
            $table->string('payment_method', 50)->nullable()->after('category')->comment('e.g. cash, card, mobile_money');
            $table->text('description')->nullable()->after('payment_method')->comment('optional free-text description');
        });
    }

    public function down(): void
    {
        Schema::table('financial_data', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'description']);
        });
    }
};
