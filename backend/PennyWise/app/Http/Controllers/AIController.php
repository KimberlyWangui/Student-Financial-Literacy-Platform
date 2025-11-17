<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use App\Models\Recommendation;
use App\Services\FinancialDataAggregator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

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
     * Generate AI recommendation for authenticated student
     * Accessible by: Students only
     */
    public function generateMyRecommendation(Request $request)
    {
        $user = Auth::user();
        
        // Ensure user is a student
        if ($user->role !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Only students can generate personal recommendations'
            ], 403);
        }

        // RATE LIMITING: Check if student already has a recent AI recommendation (last 24 hours)
        $recentAiRecommendation = Recommendation::where('student_id', $user->id)
            ->where('source_type', 'AI_Model')
            ->where('created_at', '>=', now()->subHours(24))
            ->latest()
            ->first();

        if ($recentAiRecommendation) {
            return response()->json([
                'status' => 'rate_limited',
                'message' => 'You already have a recent AI recommendation. Please wait 24 hours before generating a new one.',
                'next_available_at' => $recentAiRecommendation->created_at->addHours(24)->toDateTimeString(),
                'latest_recommendation' => $recentAiRecommendation
            ], 429); // 429 Too Many Requests
        }

        // Generate AI prediction for the authenticated student
        return $this->generatePredictionForStudent($user->id);
    }

    /**
     * Preview authenticated student's aggregated data
     * Accessible by: Students only (for transparency)
     */
    public function previewMyData(Request $request)
    {
        $user = Auth::user();
        
        if ($user->role !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Only students can view their data'
            ], 403);
        }

        try {
            $studentData = $this->aggregator->aggregateStudentData($user->id);
            
            return response()->json([
                'status' => 'success',
                'message' => 'This is the data our AI uses to generate your recommendations',
                'data' => $studentData,
                'explanation' => [
                    'monthly_income' => 'Your estimated monthly allowance (midpoint of your range)',
                    'total_expenses' => 'Total spending in the last 30 days',
                    'housing_burden' => 'Housing cost as percentage of income',
                    'education_burden' => 'Tuition cost as percentage of income',
                    'top_spending_category' => 'Your highest expense category',
                    'spending_concentration' => 'How focused your spending is (0-1)',
                    'confidence_note' => 'AI confidence improves with more transaction history across multiple categories'
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Check if student can generate a new AI recommendation
     * Accessible by: Students only
     */
    public function canGenerateRecommendation(Request $request)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'User not authenticated'
                ], 401);
            }
            
            if ($user->role !== 'student') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Only students can check recommendation availability'
                ], 403);
            }

            $recentAiRecommendation = Recommendation::where('student_id', $user->id)
                ->where('source_type', 'AI_Model')
                ->where('created_at', '>=', now()->subHours(24))
                ->latest()
                ->first();

            if ($recentAiRecommendation) {
                $nextAvailable = $recentAiRecommendation->created_at->copy()->addHours(24);
                $hoursRemaining = max(0, round($nextAvailable->diffInMinutes(now()) / 60, 1));
                
                return response()->json([
                    'status' => 'success',
                    'can_generate' => false,
                    'reason' => 'Recent recommendation exists',
                    'next_available_at' => $nextAvailable->toDateTimeString(),
                    'hours_remaining' => $hoursRemaining
                ], 200);
            }

            return response()->json([
                'status' => 'success',
                'can_generate' => true,
                'message' => 'You can generate a new AI recommendation'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error in canGenerateRecommendation: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'status' => 'error',
                'message' => 'An error occurred while checking generation status',
                'details' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Generate prediction for a single student (INTERNAL USE & ADMIN)
     * Called by: generateMyRecommendation(), admin routes, cron job
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
                    'message' => 'AI recommendation generated and stored successfully',
                    'data' => [
                        'predicted_label' => $data['predicted_label'],
                        'confidence' => $data['confidence'],
                        'recommendation_id' => $recommendation->recommendation_id,
                        'recommendation' => $recommendation
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
     * Accessible by: Admin, Cron job
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
     * Preview aggregated data for a student (ADMIN ONLY - for debugging)
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
     * Get all recommendations for a student (ADMIN ONLY)
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
     * Check Flask API health (ADMIN ONLY)
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