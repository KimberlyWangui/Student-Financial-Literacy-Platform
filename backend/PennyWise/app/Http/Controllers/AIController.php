<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use App\Models\Recommendation;
use App\Services\FinancialDataAggregator;
use Illuminate\Support\Facades\Log;

class AIController extends Controller
{
    protected $flaskApiUrl;
    protected $aggregator;

    public function __construct(FinancialDataAggregator $aggregator)
    {
        $this->flaskApiUrl = env('FLASK_API_URL', 'http://127.0.0.1:5000');
        $this->aggregator = $aggregator;
    }

    /**
     * Generate prediction for a single student (auto-fetches data from DB)
     */
    public function generatePredictionForStudent($studentId)
    {
        try {
            // Automatically aggregate data from database
            $studentData = $this->aggregator->aggregateStudentData($studentId);

            // Call Flask API with aggregated data
            $client = new Client([
                'base_uri' => $this->flaskApiUrl,
                'timeout' => 30.0,
            ]);

            $response = $client->post('/predict', [
                'json' => $studentData,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ]
            ]);

            $data = json_decode($response->getBody(), true);

            if ($data['status'] === 'success') {
                // Store recommendation in database
                $recommendation = Recommendation::create([
                    'student_id' => $studentId,
                    'title' => $data['recommendation']['title'],
                    'recomm_text' => $data['recommendation']['recomm_text'],
                    'category' => $data['recommendation']['category'],
                    'confidence_score' => $data['recommendation']['confidence_score'],
                    'reasoning' => $data['recommendation']['reasoning'],
                    'impact_estimate' => $data['recommendation']['impact_estimate'],
                    'source_type' => $data['recommendation']['source_type'],
                    'model_version' => $data['recommendation']['model_version'],
                    'status' => 'pending',
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Prediction generated and recommendation stored successfully',
                    'data' => [
                        'predicted_label' => $data['predicted_label'],
                        'confidence' => $data['confidence'],
                        'recommendation_id' => $recommendation->recommendation_id,
                        'recommendation' => $recommendation,
                        'student_data' => $studentData // For debugging
                    ]
                ], 201);
            }

        } catch (GuzzleException $e) {
            Log::error('Flask API Error: ' . $e->getMessage());
            
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to connect to AI prediction service',
                'details' => $e->getMessage()
            ], 503);
        } catch (\Exception $e) {
            Log::error('AI Controller Error: ' . $e->getMessage());
            
            return response()->json([
                'status' => 'error',
                'message' => 'An error occurred while processing your request',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate predictions for ALL students (batch processing)
     */
    public function generatePredictionsForAllStudents()
    {
        try {
            // Get all students' aggregated data
            $allStudentsData = $this->aggregator->aggregateAllStudents();

            $results = [];
            $successCount = 0;
            $failCount = 0;

            $client = new Client([
                'base_uri' => $this->flaskApiUrl,
                'timeout' => 30.0,
            ]);

            foreach ($allStudentsData as $studentData) {
                try {
                    // Call Flask API
                    $response = $client->post('/predict', [
                        'json' => $studentData,
                        'headers' => [
                            'Content-Type' => 'application/json',
                            'Accept' => 'application/json',
                        ]
                    ]);

                    $data = json_decode($response->getBody(), true);

                    if ($data['status'] === 'success') {
                        // Store recommendation
                        $recommendation = Recommendation::create([
                            'student_id' => $studentData['student_id'],
                            'title' => $data['recommendation']['title'],
                            'recomm_text' => $data['recommendation']['recomm_text'],
                            'category' => $data['recommendation']['category'],
                            'confidence_score' => $data['recommendation']['confidence_score'],
                            'reasoning' => $data['recommendation']['reasoning'],
                            'impact_estimate' => $data['recommendation']['impact_estimate'],
                            'source_type' => $data['recommendation']['source_type'],
                            'model_version' => $data['recommendation']['model_version'],
                            'status' => 'pending',
                        ]);

                        $results[] = [
                            'student_id' => $studentData['student_id'],
                            'status' => 'success',
                            'recommendation_id' => $recommendation->recommendation_id
                        ];
                        $successCount++;
                    }

                } catch (\Exception $e) {
                    $results[] = [
                        'student_id' => $studentData['student_id'],
                        'status' => 'failed',
                        'error' => $e->getMessage()
                    ];
                    $failCount++;
                    Log::error("Failed to generate prediction for student {$studentData['student_id']}: {$e->getMessage()}");
                }
            }

            return response()->json([
                'status' => 'success',
                'message' => "Batch processing complete. Success: {$successCount}, Failed: {$failCount}",
                'summary' => [
                    'total_students' => count($allStudentsData),
                    'successful' => $successCount,
                    'failed' => $failCount
                ],
                'results' => $results
            ]);

        } catch (\Exception $e) {
            Log::error('Batch Prediction Error: ' . $e->getMessage());
            
            return response()->json([
                'status' => 'error',
                'message' => 'An error occurred during batch processing',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Preview aggregated data for a student (for testing/debugging)
     */
    public function previewStudentData($studentId)
    {
        try {
            $studentData = $this->aggregator->aggregateStudentData($studentId);
            
            return response()->json([
                'status' => 'success',
                'data' => $studentData
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Get all recommendations for a student
     */
    public function getStudentRecommendations($studentId)
    {
        $recommendations = Recommendation::where('student_id', $studentId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $recommendations
        ]);
    }

    /**
     * Update recommendation status
     */
    public function updateRecommendationStatus(Request $request, $recommendationId)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,viewed,accepted,rejected,ignored',
            'feedback' => 'nullable|string'
        ]);

        $recommendation = Recommendation::findOrFail($recommendationId);
        $recommendation->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Recommendation status updated',
            'data' => $recommendation
        ]);
    }

    /**
     * Check Flask API health
     */
    public function checkApiHealth()
    {
        try {
            $client = new Client([
                'base_uri' => $this->flaskApiUrl,
                'timeout' => 5.0,
            ]);

            $response = $client->get('/health');
            $data = json_decode($response->getBody(), true);

            return response()->json([
                'status' => 'success',
                'flask_api' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Flask API is not responding',
                'details' => $e->getMessage()
            ], 503);
        }
    }
}