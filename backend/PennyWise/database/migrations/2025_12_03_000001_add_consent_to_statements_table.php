<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A record of the student's agreement each time they upload a statement: which wording of the
     * privacy text they agreed to, and when. Older uploads (before this existed) stay NULL.
     */
    public function up(): void
    {
        Schema::table('statements', function (Blueprint $table) {
            $table->string('consent_version', 20)->nullable();
            $table->timestamp('consented_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('statements', function (Blueprint $table) {
            $table->dropColumn(['consent_version', 'consented_at']);
        });
    }
};
