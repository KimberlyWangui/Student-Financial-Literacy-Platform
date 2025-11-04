<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Faker\Factory as Faker;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();

        // --- 1️⃣ Create 5 Admin Users ---
        $admins = [
            [
                'name' => 'Admin One',
                'email' => 'admin1@pennywise.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Admin Two',
                'email' => 'admin2@pennywise.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Sarah Johnson',
                'email' => 'sarah.admin@pennywise.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'two_factor_enabled' => true,
            ],
            [
                'name' => 'Michael Chen',
                'email' => 'michael.admin@pennywise.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Emily Rodriguez',
                'email' => 'emily.admin@pennywise.com',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'two_factor_enabled' => true,
            ],
        ];

        foreach ($admins as $admin) {
            User::create($admin);
        }

        // --- 2️⃣ Create 20 Fixed Student Users ---
        $students = [
            ['name' => 'James Kamau', 'email' => 'james.kamau@student.com'],
            ['name' => 'Mary Wanjiku', 'email' => 'mary.wanjiku@student.com'],
            ['name' => 'David Ochieng', 'email' => 'david.ochieng@student.com'],
            ['name' => 'Grace Akinyi', 'email' => 'grace.akinyi@student.com'],
            ['name' => 'Peter Mwangi', 'email' => 'peter.mwangi@student.com'],
            ['name' => 'Jane Njeri', 'email' => 'jane.njeri@student.com'],
            ['name' => 'Joseph Otieno', 'email' => 'joseph.otieno@student.com'],
            ['name' => 'Catherine Wambui', 'email' => 'catherine.wambui@student.com'],
            ['name' => 'Daniel Kipchoge', 'email' => 'daniel.kipchoge@student.com'],
            ['name' => 'Lucy Chepkemoi', 'email' => 'lucy.chepkemoi@student.com'],
            ['name' => 'Samuel Mutua', 'email' => 'samuel.mutua@student.com'],
            ['name' => 'Ann Wangari', 'email' => 'ann.wangari@student.com'],
            ['name' => 'Brian Omondi', 'email' => 'brian.omondi@student.com'],
            ['name' => 'Faith Nyambura', 'email' => 'faith.nyambura@student.com'],
            ['name' => 'Kevin Kimani', 'email' => 'kevin.kimani@student.com'],
            ['name' => 'Elizabeth Moraa', 'email' => 'elizabeth.moraa@student.com'],
            ['name' => 'Patrick Njoroge', 'email' => 'patrick.njoroge@student.com'],
            ['name' => 'Rose Adhiambo', 'email' => 'rose.adhiambo@student.com'],
            ['name' => 'Thomas Kariuki', 'email' => 'thomas.kariuki@student.com'],
            ['name' => 'Betty Kerubo', 'email' => 'betty.kerubo@student.com'],
        ];

        foreach ($students as $student) {
            User::create([
                'name' => $student['name'],
                'email' => $student['email'],
                'password' => Hash::make('password123'),
                'role' => 'student',
                'two_factor_enabled' => rand(0, 1),
            ]);
        }

        // --- 3️⃣ Create 50 Random Student Users using Faker ---
        for ($i = 0; $i < 50; $i++) {
            User::create([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'password' => Hash::make('password123'),
                'role' => 'student',
                'two_factor_enabled' => $faker->boolean(30), // 30% chance of having 2FA
            ]);
        }

        $this->command->info('✓ Created 5 admins and 70 students (75 total)');
    }
}
