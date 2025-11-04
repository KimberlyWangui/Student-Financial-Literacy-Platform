<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Http\Controllers\AIController;
use App\Services\FinancialDataAggregator;

class GenerateAIRecommendations extends Command
{
    protected $signature = 'ai:generate-recommendations {--student= : Specific student ID to test}';
    protected $description = 'Generate AI recommendations for all students based on their financial data';

    public function handle()
    {
        $this->info('Starting AI recommendation generation...');
        $this->info('Fetching data from database and generating predictions...');
        
        try {
            $controller = new AIController(new FinancialDataAggregator());
            
            // Test with single student if provided
            if ($studentId = $this->option('student')) {
                $this->info("Testing with student ID: {$studentId}");
                $response = $controller->generatePredictionForStudent($studentId);
            } else {
                $response = $controller->generatePredictionsForAllStudents();
            }
            
            $data = $response->getData();
            
            if ($data->status === 'success') {
                $this->newLine();
                
                if (isset($data->summary)) {
                    $this->info("✓ Success! Generated {$data->summary->successful} recommendations");
                    
                    if ($data->summary->failed > 0) {
                        $this->warn("⚠ {$data->summary->failed} students failed");
                        
                        // Show failed student details
                        if (isset($data->results)) {
                            $failed = array_filter((array)$data->results, fn($r) => $r->status === 'failed');
                            if (!empty($failed)) {
                                $this->newLine();
                                $this->error('Failed Students (first 10):');
                                foreach (array_slice($failed, 0, 10) as $result) {
                                    $this->line("Student {$result->student_id}: {$result->error}");
                                }
                                if (count($failed) > 10) {
                                    $this->line('... and ' . (count($failed) - 10) . ' more');
                                }
                            }
                        }
                    }
                    
                    $this->newLine();
                    $this->table(
                        ['Metric', 'Count'],
                        [
                            ['Total Students', $data->summary->total_students],
                            ['Successful', $data->summary->successful],
                            ['Failed', $data->summary->failed],
                        ]
                    );
                } else {
                    $this->info('✓ Single prediction generated successfully');
                    $this->line("Prediction: {$data->data->predicted_label}");
                    $this->line("Confidence: {$data->data->confidence}");
                }
                
                return Command::SUCCESS;
            } else {
                $this->error('✗ Failed to generate recommendations');
                $this->error('Details: ' . ($data->message ?? 'Unknown error'));
                if (isset($data->details)) {
                    $this->line($data->details);
                }
                return Command::FAILURE;
            }
        } catch (\Exception $e) {
            $this->error('✗ Error: ' . $e->getMessage());
            $this->error('Stack trace:');
            $this->line($e->getTraceAsString());
            return Command::FAILURE;
        }
    }
}