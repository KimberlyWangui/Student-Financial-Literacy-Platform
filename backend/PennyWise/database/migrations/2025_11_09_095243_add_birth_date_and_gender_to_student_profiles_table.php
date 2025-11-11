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
         Schema::table('student_profiles', function (Blueprint $table) {
            $table->date('birth_date')->nullable()->after('course');
            $table->enum('gender', ['male', 'female', 'other', 'prefer_not_to_say'])->nullable()->after('birth_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
       Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn(['birth_date', 'gender']);
        });
    }
};
