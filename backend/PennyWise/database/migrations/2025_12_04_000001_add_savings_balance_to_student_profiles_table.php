<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What the student says they already have saved outside their M-Pesa wallet (M-Shwari, Ziidi, a SACCO).
     * It is one number they type in; no account details are stored. NULL means "not entered".
     */
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->decimal('savings_balance', 12, 2)->nullable();
            $table->timestamp('savings_balance_updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn(['savings_balance', 'savings_balance_updated_at']);
        });
    }
};
