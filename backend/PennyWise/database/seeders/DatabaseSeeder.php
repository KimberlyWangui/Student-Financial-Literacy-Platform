<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🌱 Starting PennyWise Database Seeding...');
        $this->command->newLine();

        $this->call([
            UserSeeder::class,
            StudentProfileSeeder::class,
            FinancialDataSeeder::class,
            BudgetSeeder::class,
            GoalSeeder::class,
            BadgeSeeder::class,
        ]);

        $this->command->newLine();
        $this->command->info('✅ Database seeding completed successfully!');
        $this->command->newLine();
        $this->command->info('📊 Summary:');
        $this->command->info('  - Users: 25 (5 admins + 20 students)');
        $this->command->info('  - Student Profiles: 20 (with ENUM allowance ranges)');
        $this->command->info('  - Financial Data: 200-300 entries');
        $this->command->info('  - Budgets: 80-100 entries');
        $this->command->info('  - Goals: 40-60 entries');
        $this->command->newLine();
        $this->command->info('🔐 Default password for all users: password123');
        $this->command->newLine();
        $this->command->info('💰 Allowance Distribution:');
        $this->command->info('  - Low (0-10k): 4 students');
        $this->command->info('  - Medium (10-35k): 10 students');
        $this->command->info('  - High (35k+): 6 students');
    }
}