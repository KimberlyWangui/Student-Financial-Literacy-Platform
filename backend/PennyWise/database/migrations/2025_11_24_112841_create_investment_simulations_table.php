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
        Schema::create('investment_simulations', function (Blueprint $table) {
            $table->id('simulation_id');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            
            // Input Parameters
            $table->string('investment_type', 20); // mmf, tbill, stock, bond
            $table->decimal('amount_invested', 15, 2);
            $table->integer('duration_value');
            $table->string('duration_unit', 10); // months, years
            $table->integer('duration_months'); // Computed total months
            $table->decimal('monthly_topup', 15, 2)->default(0);
            $table->string('reinvestment_frequency', 20)->default('monthly');
            $table->decimal('target_amount', 15, 2)->nullable();
            
            // Projection Results
            $table->decimal('projected_final_value', 15, 2);
            $table->decimal('total_invested', 15, 2);
            $table->decimal('total_growth', 15, 2);
            $table->decimal('percentage_return', 8, 2);
            $table->decimal('annualized_return', 8, 2);
            
            // Risk Analysis
            $table->string('risk_level', 20);
            $table->decimal('volatility', 8, 2);
            $table->decimal('best_case_scenario', 15, 2);
            $table->decimal('worst_case_scenario', 15, 2);
            $table->decimal('median_scenario', 15, 2);
            $table->decimal('confidence_95_lower', 15, 2);
            $table->decimal('confidence_95_upper', 15, 2);
            
            // Model Parameters (stored as JSON)
            $table->json('model_parameters');
            
            // Timeline (stored as JSON array)
            $table->json('timeline');
            
            // Goal Analysis (stored as JSON, nullable)
            $table->json('goal_analysis')->nullable();
            
            // Metadata
            $table->string('simulation_reference')->unique(); // e.g., SIM_20241124120000
            
            $table->timestamps();
            
            // Indexes
            $table->index('student_id');
            $table->index('investment_type');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_simulations');
    }
};