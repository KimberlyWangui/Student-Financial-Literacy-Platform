<?php

namespace App\Http\Controllers;

use App\Models\InvestmentSimulation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;

class InvestmentSimulationController extends Controller
{
    /**
     * Flask API base URL
     */
    /**
     * Flask API base URL
     */
    private $flaskApiUrl;

    public function __construct()
    {
        $this->flaskApiUrl = config('services.simulator.url');
    }

    // Every call to the simulator goes through here so it always carries the shared token.
    // Render's free servers can take about a minute to wake up, so the timeouts are generous.
    private function flask(int $seconds)
    {
        return Http::timeout($seconds)
            ->withHeaders(['X-Internal-Token' => (string) config('services.simulator.token')])
            ->retry(
                5,
                app()->environment('testing') ? 0 : 12000,
                fn ($e) => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [502, 503, 504])),
                throw: false
            );
    }

    /**
     * Display a listing of investment simulations.
     * Admin: View all simulations (READ only)
     * Student: View only their own simulations
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = InvestmentSimulation::with('student:id,name,email');

        // Students can only see their own simulations
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Filter by investment type if provided
        if ($request->has('investment_type')) {
            $query->byType($request->investment_type);
        }

        // Sort by created_at descending (most recent first)
        $query->recent();

        $simulations = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Investment simulations retrieved successfully',
            'data' => $simulations
        ], 200);
    }

    /**
     * Store a newly created investment simulation.
     * Accessible by: Students only
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create simulations
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create investment simulations.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'amount_invested' => 'required|numeric|min:1|max:999999999.99',
            'duration_value' => 'required|integer|min:1|max:600',
            'duration_unit' => 'required|in:months,years',
            'investment_type' => 'required|in:mmf,tbill,stock,bond',
            'monthly_topup' => 'sometimes|numeric|min:0|max:999999999.99',
            'target_amount' => 'sometimes|nullable|numeric|min:1|max:999999999.99',
            'reinvestment_frequency' => 'sometimes|in:monthly,quarterly,annually',
        ]);

        try {
            // Call Flask API to run simulation
            $response = $this->flask(90)->post("{$this->flaskApiUrl}/api/investment/simulate", [
                'amount_invested' => $validated['amount_invested'],
                'duration_value' => $validated['duration_value'],
                'duration_unit' => $validated['duration_unit'],
                'investment_type' => $validated['investment_type'],
                'monthly_topup' => $validated['monthly_topup'] ?? 0,
                'target_amount' => $validated['target_amount'] ?? null,
                'reinvestment_frequency' => $validated['reinvestment_frequency'] ?? 'monthly',
            ]);

            if (!$response->successful()) {
                Log::error('Flask API error', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);

                return response()->json([
                    'message' => 'Failed to run investment simulation',
                    'error' => $response->json()['message'] ?? 'Unknown error'
                ], 500);
            }

            $simulationResult = $response->json()['data'];

            // Store simulation in database
            $simulation = InvestmentSimulation::create([
                'student_id' => $currentUser->id,
                'simulation_reference' => $simulationResult['simulation_id'],
                
                // Input parameters
                'investment_type' => $simulationResult['investment_details']['investment_type'],
                'amount_invested' => $simulationResult['investment_details']['amount_invested'],
                'duration_value' => $simulationResult['investment_details']['duration_value'],
                'duration_unit' => $simulationResult['investment_details']['duration_unit'],
                'duration_months' => $simulationResult['investment_details']['duration_months'],
                'monthly_topup' => $simulationResult['investment_details']['monthly_topup'],
                'reinvestment_frequency' => $simulationResult['investment_details']['reinvestment_frequency'],
                'target_amount' => $simulationResult['investment_details']['target_amount'],
                
                // Projections
                'projected_final_value' => $simulationResult['projections']['projected_final_value'],
                'total_invested' => $simulationResult['projections']['total_invested'],
                'total_growth' => $simulationResult['projections']['total_growth'],
                'percentage_return' => $simulationResult['projections']['percentage_return'],
                'annualized_return' => $simulationResult['projections']['annualized_return'],
                
                // Risk analysis
                'risk_level' => $simulationResult['risk_analysis']['risk_level'],
                'volatility' => $simulationResult['risk_analysis']['volatility'],
                'best_case_scenario' => $simulationResult['risk_analysis']['best_case_scenario'],
                'worst_case_scenario' => $simulationResult['risk_analysis']['worst_case_scenario'],
                'median_scenario' => $simulationResult['risk_analysis']['median_scenario'],
                'confidence_95_lower' => $simulationResult['risk_analysis']['confidence_95_lower'],
                'confidence_95_upper' => $simulationResult['risk_analysis']['confidence_95_upper'],
                
                // Additional data (JSON)
                'model_parameters' => $simulationResult['model_parameters'],
                'timeline' => $simulationResult['timeline'],
                'goal_analysis' => $simulationResult['goal_analysis'],
            ]);

            // Load student relationship
            $simulation->load('student:id,name,email');

            return response()->json([
                'message' => 'Investment simulation created successfully',
                'data' => $simulation
            ], 201);

        } catch (\Exception $e) {
            Log::error('Investment simulation error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to create investment simulation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified investment simulation.
     * Admin: View any simulation (READ only)
     * Student: View only their own simulation
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        $simulation = InvestmentSimulation::with('student:id,name,email')->find($id);

        if (!$simulation) {
            return response()->json([
                'message' => 'Investment simulation not found'
            ], 404);
        }

        // Students can only view their own simulations
        if ($currentUser->role === 'student' && $simulation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own simulations.'
            ], 403);
        }

        return response()->json([
            'message' => 'Investment simulation retrieved successfully',
            'data' => $simulation
        ], 200);
    }

    /**
     * Remove the specified investment simulation.
     * Admin: Can delete any simulation
     * Student: Can delete only their own simulation
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        $simulation = InvestmentSimulation::find($id);

        if (!$simulation) {
            return response()->json([
                'message' => 'Investment simulation not found'
            ], 404);
        }

        // Students can only delete their own simulations
        if ($currentUser->role === 'student' && $simulation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only delete your own simulations.'
            ], 403);
        }

        $simulation->delete();

        return response()->json([
            'message' => 'Investment simulation deleted successfully'
        ], 200);
    }

    /**
     * Preview an investment simulation without saving it.
     * Accessible by: All authenticated users
     */
    public function preview(Request $request)
    {
        // Validate request
        $validated = $request->validate([
            'amount_invested' => 'required|numeric|min:1|max:999999999.99',
            'duration_value' => 'required|integer|min:1|max:600',
            'duration_unit' => 'required|in:months,years',
            'investment_type' => 'required|in:mmf,tbill,stock,bond',
            'monthly_topup' => 'sometimes|numeric|min:0|max:999999999.99',
            'target_amount' => 'sometimes|nullable|numeric|min:1|max:999999999.99',
            'reinvestment_frequency' => 'sometimes|in:monthly,quarterly,annually',
        ]);

        try {
            // Call Flask API
            $response = $this->flask(90)->post("{$this->flaskApiUrl}/api/investment/simulate", [
                'amount_invested' => $validated['amount_invested'],
                'duration_value' => $validated['duration_value'],
                'duration_unit' => $validated['duration_unit'],
                'investment_type' => $validated['investment_type'],
                'monthly_topup' => $validated['monthly_topup'] ?? 0,
                'target_amount' => $validated['target_amount'] ?? null,
                'reinvestment_frequency' => $validated['reinvestment_frequency'] ?? 'monthly',
            ]);

            if (!$response->successful()) {
                return response()->json([
                    'message' => 'Failed to preview simulation',
                    'error' => $response->json()['message'] ?? 'Unknown error'
                ], 500);
            }

            return response()->json([
                'message' => 'Investment simulation preview generated successfully',
                'data' => $response->json()['data']
            ], 200);

        } catch (\Exception $e) {
            Log::error('Preview simulation error', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'Failed to preview simulation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get investment statistics for the authenticated student.
     * Accessible by: Students only
     */
    public function myStatistics()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        $totalSimulations = InvestmentSimulation::forStudent($currentUser->id)->count();

        if ($totalSimulations === 0) {
            return response()->json([
                'message' => 'No simulations found',
                'data' => [
                    'total_simulations' => 0,
                    'total_invested' => 0,
                    'total_projected_growth' => 0,
                    'average_return' => 0,
                    'by_investment_type' => [],
                    'most_recent_simulation' => null
                ]
            ], 200);
        }

        $simulations = InvestmentSimulation::forStudent($currentUser->id)->get();

        $totalInvested = $simulations->sum('total_invested');
        $totalGrowth = $simulations->sum('total_growth');
        $avgReturn = $simulations->avg('percentage_return');

        // Group by investment type
        $byType = $simulations->groupBy('investment_type')->map(function ($group) {
            return [
                'count' => $group->count(),
                'total_invested' => $group->sum('total_invested'),
                'total_growth' => $group->sum('total_growth'),
                'avg_return' => round($group->avg('percentage_return'), 2),
            ];
        });

        $mostRecent = InvestmentSimulation::forStudent($currentUser->id)->recent()->first();

        return response()->json([
            'message' => 'Investment statistics retrieved successfully',
            'data' => [
                'total_simulations' => $totalSimulations,
                'total_invested' => number_format($totalInvested, 2),
                'total_projected_growth' => number_format($totalGrowth, 2),
                'average_return' => round($avgReturn, 2),
                'by_investment_type' => $byType,
                'most_recent_simulation' => $mostRecent
            ]
        ], 200);
    }

    /**
     * Get available investment types with their statistics.
     * Accessible by: All authenticated users
     */
    public function getInvestmentTypes()
    {
        try {
            $response = $this->flask(60)->get("{$this->flaskApiUrl}/api/investment/statistics");

            if (!$response->successful()) {
                return response()->json([
                    'message' => 'Failed to retrieve investment types',
                    'error' => 'API unavailable'
                ], 500);
            }

            return response()->json([
                'message' => 'Investment types retrieved successfully',
                'data' => $response->json()['data']
            ], 200);

        } catch (\Exception $e) {
            Log::error('Get investment types error', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'Failed to retrieve investment types',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Compare multiple investment scenarios.
     * Accessible by: All authenticated users
     */
    public function compare(Request $request)
    {
        $validated = $request->validate([
            'scenarios' => 'required|array|min:2|max:4',
            'scenarios.*.investment_type' => 'required|in:mmf,tbill,stock,bond',
            'scenarios.*.amount_invested' => 'required|numeric|min:1',
            'scenarios.*.duration_value' => 'required|integer|min:1',
            'scenarios.*.duration_unit' => 'required|in:months,years',
            'scenarios.*.monthly_topup' => 'sometimes|numeric|min:0',
        ]);

        try {
            $results = [];

            foreach ($validated['scenarios'] as $index => $scenario) {
                $response = $this->flask(90)->post("{$this->flaskApiUrl}/api/investment/simulate", [
                    'amount_invested' => $scenario['amount_invested'],
                    'duration_value' => $scenario['duration_value'],
                    'duration_unit' => $scenario['duration_unit'],
                    'investment_type' => $scenario['investment_type'],
                    'monthly_topup' => $scenario['monthly_topup'] ?? 0,
                    'reinvestment_frequency' => 'monthly',
                ]);

                if ($response->successful()) {
                    $results[] = [
                        'scenario_number' => $index + 1,
                        'input' => $scenario,
                        'result' => $response->json()['data']
                    ];
                }
            }

            return response()->json([
                'message' => 'Investment comparison completed successfully',
                'data' => [
                    'scenarios_count' => count($results),
                    'comparisons' => $results
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Compare simulations error', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'Failed to compare simulations',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}