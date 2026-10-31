<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update existing categories to match model's expected categories
        $mappings = [
            // Transportation variations
            ['old' => 'transport', 'new' => 'transportation'],
            ['old' => 'Transport', 'new' => 'transportation'],
            
            // Housing variations
            ['old' => 'accommodation', 'new' => 'housing'],
            ['old' => 'Accommodation', 'new' => 'housing'],
            ['old' => 'rent', 'new' => 'housing'],
            ['old' => 'Rent', 'new' => 'housing'],
            ['old' => 'utilities', 'new' => 'housing'],
            ['old' => 'Utilities', 'new' => 'housing'],
            
            // Books variations
            ['old' => 'books & supplies', 'new' => 'books_supplies'],
            ['old' => 'Books & Supplies', 'new' => 'books_supplies'],
            ['old' => 'books and supplies', 'new' => 'books_supplies'],
            ['old' => 'Books and Supplies', 'new' => 'books_supplies'],
            ['old' => 'books', 'new' => 'books_supplies'],
            ['old' => 'Books', 'new' => 'books_supplies'],
            ['old' => 'stationery', 'new' => 'books_supplies'],
            ['old' => 'Stationery', 'new' => 'books_supplies'],
            ['old' => 'Books & Stationery', 'new' => 'books_supplies'],
            
            // Personal care variations
            ['old' => 'clothing', 'new' => 'personal_care'],
            ['old' => 'Clothing', 'new' => 'personal_care'],
            ['old' => 'personal care', 'new' => 'personal_care'],
            ['old' => 'Personal Care', 'new' => 'personal_care'],
            ['old' => 'grooming', 'new' => 'personal_care'],
            ['old' => 'Grooming', 'new' => 'personal_care'],
            ['old' => 'laundry', 'new' => 'personal_care'],
            ['old' => 'Laundry', 'new' => 'personal_care'],
            
            // Health variations
            ['old' => 'healthcare', 'new' => 'health_wellness'],
            ['old' => 'Healthcare', 'new' => 'health_wellness'],
            ['old' => 'health', 'new' => 'health_wellness'],
            ['old' => 'Health', 'new' => 'health_wellness'],
            ['old' => 'medical', 'new' => 'health_wellness'],
            ['old' => 'Medical', 'new' => 'health_wellness'],
            
            // Technology variations
            ['old' => 'tech', 'new' => 'technology'],
            ['old' => 'Tech', 'new' => 'technology'],
            ['old' => 'electronics', 'new' => 'technology'],
            ['old' => 'Electronics', 'new' => 'technology'],
            
            // Tuition variations
            ['old' => 'tuition', 'new' => 'tuition_monthly'],
            ['old' => 'Tuition', 'new' => 'tuition_monthly'],
            ['old' => 'school fees', 'new' => 'tuition_monthly'],
            ['old' => 'School Fees', 'new' => 'tuition_monthly'],
            
            // Miscellaneous variations
            ['old' => 'other expense', 'new' => 'miscellaneous'],
            ['old' => 'Other Expense', 'new' => 'miscellaneous'],
            ['old' => 'other', 'new' => 'miscellaneous'],
            ['old' => 'Other', 'new' => 'miscellaneous'],
        ];

        // Update each mapping
        foreach ($mappings as $mapping) {
            DB::table('financial_data')
                ->where('category', $mapping['old'])
                ->update(['category' => $mapping['new']]);
            
            echo "Updated '{$mapping['old']}' to '{$mapping['new']}'\n";
        }

        // Normalize food and entertainment (already correct, just lowercase)
        DB::table('financial_data')
            ->where('category', 'Food')
            ->update(['category' => 'food']);
            
        DB::table('financial_data')
            ->where('category', 'Entertainment')
            ->update(['category' => 'entertainment']);

        echo "\n✅ Category migration complete!\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Optionally reverse mappings
        $reverseMappings = [
            ['old' => 'transportation', 'new' => 'transport'],
            ['old' => 'housing', 'new' => 'accommodation'],
            ['old' => 'books_supplies', 'new' => 'books & supplies'],
            ['old' => 'personal_care', 'new' => 'personal care'],
            ['old' => 'health_wellness', 'new' => 'healthcare'],
            ['old' => 'tuition_monthly', 'new' => 'tuition'],
            ['old' => 'miscellaneous', 'new' => 'other expense'],
        ];

        foreach ($reverseMappings as $mapping) {
            DB::table('financial_data')
                ->where('category', $mapping['old'])
                ->update(['category' => $mapping['new']]);
        }
    }
};