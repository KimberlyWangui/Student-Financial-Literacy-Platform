<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Simulation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SimulationController extends Controller
{
    /**
     * Display a listing of simulations.
     * Admin: View all simulations (READ only)
     * Student: View only their own simulations
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = Simulation::with('student:id,name,email');

        // Students can only see their own simulations
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Sort by created_at descending (most recent first)
        $query->recent();

        $simulations = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Simulations retrieved successfully',
            'data' => $simulations
        ], 200);
    }

    /**
     * Store a newly created simulation.
     * Accessible by: Students only (only for themselves)
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create simulations
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create simulations.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'principal' => 'required|numeric|min:0.01|max:999999999.99',
            'interest_rate' => 'required|numeric|min:0|max:100',
            'time_period' => 'required|integer|min:1|max:600', // Max 50 years (600 months)
            'calculation_type' => 'sometimes|in:simple,compound', // Optional: type of interest calculation
        ]);

        // Calculate the result based on calculation type
        $calculationType = $validated['calculation_type'] ?? 'compound';

        if ($calculationType === 'simple') {
            $result = Simulation::calculateSimpleInterest(
                $validated['principal'],
                $validated['interest_rate'],
                $validated['time_period']
            );
        } else {
            $result = Simulation::calculateCompoundInterest(
                $validated['principal'],
                $validated['interest_rate'],
                $validated['time_period']
            );
        }

        // Create simulation for the authenticated student
        $simulation = Simulation::create([
            'student_id' => $currentUser->id,
            'principal' => $validated['principal'],
            'interest_rate' => $validated['interest_rate'],
            'time_period' => $validated['time_period'],
            'result' => $result,
        ]);

        // Load student relationship
        $simulation->load('student:id,name,email');

        return response()->json([
            'message' => 'Simulation created successfully',
            'data' => $simulation,
            'calculation_type' => $calculationType
        ], 201);
    }

    /**
     * Display the specified simulation.
     * Admin: View any simulation (READ only)
     * Student: View only their own simulation
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find simulation
        $simulation = Simulation::with('student:id,name,email')->find($id);

        if (!$simulation) {
            return response()->json([
                'message' => 'Simulation not found'
            ], 404);
        }

        // Students can only view their own simulations
        if ($currentUser->role === 'student' && $simulation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own simulations.'
            ], 403);
        }

        return response()->json([
            'message' => 'Simulation retrieved successfully',
            'data' => $simulation
        ], 200);
    }

    /**
     * Update the specified simulation.
     * Accessible by: Students only (only their own simulations)
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only students can update simulations
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can update simulations.'
            ], 403);
        }

        // Find simulation
        $simulation = Simulation::find($id);

        if (!$simulation) {
            return response()->json([
                'message' => 'Simulation not found'
            ], 404);
        }

        // Students can only update their own simulations
        if ($simulation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own simulations.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'principal' => 'sometimes|numeric|min:0.01|max:999999999.99',
            'interest_rate' => 'sometimes|numeric|min:0|max:100',
            'time_period' => 'sometimes|integer|min:1|max:600',
            'calculation_type' => 'sometimes|in:simple,compound',
        ]);

        // Get current or updated values
        $principal = $validated['principal'] ?? $simulation->principal;
        $interestRate = $validated['interest_rate'] ?? $simulation->interest_rate;
        $timePeriod = $validated['time_period'] ?? $simulation->time_period;
        $calculationType = $validated['calculation_type'] ?? 'compound';

        // Recalculate the result if any parameter changed
        if (isset($validated['principal']) || isset($validated['interest_rate']) || isset($validated['time_period'])) {
            if ($calculationType === 'simple') {
                $result = Simulation::calculateSimpleInterest($principal, $interestRate, $timePeriod);
            } else {
                $result = Simulation::calculateCompoundInterest($principal, $interestRate, $timePeriod);
            }
            $validated['result'] = $result;
        }

        // Remove calculation_type from validated data (not a DB column)
        unset($validated['calculation_type']);

        // Update simulation
        $simulation->update($validated);

        // Load student relationship
        $simulation->load('student:id,name,email');

        return response()->json([
            'message' => 'Simulation updated successfully',
            'data' => $simulation
        ], 200);
    }

    /**
     * Remove the specified simulation.
     * Admin: Can delete any simulation
     * Student: Can delete only their own simulation
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Find simulation
        $simulation = Simulation::find($id);

        if (!$simulation) {
            return response()->json([
                'message' => 'Simulation not found'
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
            'message' => 'Simulation deleted successfully'
        ], 200);
    }

    /**
     * Preview a simulation without saving it.
     * Accessible by: All authenticated users
     */
    public function preview(Request $request)
    {
        // Validate request
        $validated = $request->validate([
            'principal' => 'required|numeric|min:0.01|max:999999999.99',
            'interest_rate' => 'required|numeric|min:0|max:100',
            'time_period' => 'required|integer|min:1|max:600',
            'calculation_type' => 'sometimes|in:simple,compound',
        ]);

        $calculationType = $validated['calculation_type'] ?? 'compound';

        // Calculate the result
        if ($calculationType === 'simple') {
            $result = Simulation::calculateSimpleInterest(
                $validated['principal'],
                $validated['interest_rate'],
                $validated['time_period']
            );
        } else {
            $result = Simulation::calculateCompoundInterest(
                $validated['principal'],
                $validated['interest_rate'],
                $validated['time_period']
            );
        }

        $interestEarned = round($result - $validated['principal'], 2);
        $roiPercentage = round(($interestEarned / $validated['principal']) * 100, 2);

        return response()->json([
            'message' => 'Simulation preview calculated successfully',
            'data' => [
                'principal' => number_format($validated['principal'], 2),
                'interest_rate' => $validated['interest_rate'],
                'time_period' => $validated['time_period'],
                'time_period_years' => round($validated['time_period'] / 12, 2),
                'result' => number_format($result, 2),
                'interest_earned' => number_format($interestEarned, 2),
                'roi_percentage' => $roiPercentage,
                'calculation_type' => $calculationType
            ]
        ], 200);
    }

    /**
     * Get simulation statistics for the authenticated student.
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

        $totalSimulations = Simulation::forStudent($currentUser->id)->count();

        if ($totalSimulations === 0) {
            return response()->json([
                'message' => 'No simulations found',
                'data' => [
                    'total_simulations' => 0,
                    'average_principal' => null,
                    'average_result' => null,
                    'total_interest_earned' => null,
                    'highest_result' => null,
                    'most_recent_simulation' => null
                ]
            ], 200);
        }

        $simulations = Simulation::forStudent($currentUser->id)->get();

        $avgPrincipal = $simulations->avg('principal');
        $avgResult = $simulations->avg('result');
        $totalInterestEarned = $simulations->sum('interest_earned');
        $highestResult = $simulations->max('result');
        $mostRecent = Simulation::forStudent($currentUser->id)->recent()->first();

        return response()->json([
            'message' => 'Simulation statistics retrieved successfully',
            'data' => [
                'total_simulations' => $totalSimulations,
                'average_principal' => number_format($avgPrincipal, 2),
                'average_result' => number_format($avgResult, 2),
                'total_interest_earned' => number_format($totalInterestEarned, 2),
                'highest_result' => number_format($highestResult, 2),
                'most_recent_simulation' => $mostRecent
            ]
        ], 200);
    }
}