<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class GoalController extends Controller
{
    /**
     * Display a listing of goals.
     * Admin: View all goals
     * Student: View only their own goals
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = Goal::with('student:id,name,email');

        // Students can only see their own goals
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Optional filters
        if ($request->has('status')) {
            if ($request->status === 'active') {
                $query->active();
            } elseif ($request->status === 'completed') {
                $query->completed();
            }
        }

        // Sort by deadline ascending (closest deadline first)
        $query->orderBy('deadline', 'asc');

        $goals = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Goals retrieved successfully',
            'data' => $goals
        ], 200);
    }

    /**
     * Store a newly created goal.
     * Accessible by: Students (only for themselves)
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create goals
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create goals.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'goal_name' => 'required|string|max:255',
            'target_amount' => 'required|numeric|min:0.01|max:9999999.99',
            'current_amount' => 'nullable|numeric|min:0|max:9999999.99',
            'deadline' => 'required|date|after:today',
        ]);

        // Create goal for the authenticated student
        $goal = Goal::create([
            'student_id' => $currentUser->id,
            'goal_name' => $validated['goal_name'],
            'target_amount' => $validated['target_amount'],
            'current_amount' => $validated['current_amount'] ?? 0.00,
            'deadline' => $validated['deadline'],
        ]);

        // Load student relationship
        $goal->load('student:id,name,email');

        return response()->json([
            'message' => 'Goal created successfully',
            'data' => $goal
        ], 201);
    }

    /**
     * Display the specified goal.
     * Admin: View any goal
     * Student: View only their own goal
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find goal
        $goal = Goal::with('student:id,name,email')->find($id);

        if (!$goal) {
            return response()->json([
                'message' => 'Goal not found'
            ], 404);
        }

        // Students can only view their own goals
        if ($currentUser->role === 'student' && $goal->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own goals.'
            ], 403);
        }

        return response()->json([
            'message' => 'Goal retrieved successfully',
            'data' => $goal
        ], 200);
    }

    /**
     * Update the specified goal.
     * Accessible by: Students (only their own goals)
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only students can update goals
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can update goals.'
            ], 403);
        }

        // Find goal
        $goal = Goal::find($id);

        if (!$goal) {
            return response()->json([
                'message' => 'Goal not found'
            ], 404);
        }

        // Students can only update their own goals
        if ($goal->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own goals.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'goal_name' => 'sometimes|string|max:255',
            'target_amount' => 'sometimes|numeric|min:0.01|max:9999999.99',
            'current_amount' => 'sometimes|numeric|min:0|max:9999999.99',
            'deadline' => 'sometimes|date|after:today',
        ]);

        // Ensure current_amount doesn't exceed target_amount
        if (isset($validated['current_amount']) && isset($validated['target_amount'])) {
            if ($validated['current_amount'] > $validated['target_amount']) {
                return response()->json([
                    'message' => 'Current amount cannot exceed target amount'
                ], 422);
            }
        } elseif (isset($validated['current_amount'])) {
            if ($validated['current_amount'] > $goal->target_amount) {
                return response()->json([
                    'message' => 'Current amount cannot exceed target amount'
                ], 422);
            }
        } elseif (isset($validated['target_amount'])) {
            if ($goal->current_amount > $validated['target_amount']) {
                return response()->json([
                    'message' => 'Target amount cannot be less than current amount'
                ], 422);
            }
        }

        // Update goal
        $goal->update($validated);

        // Load student relationship
        $goal->load('student:id,name,email');

        return response()->json([
            'message' => 'Goal updated successfully',
            'data' => $goal
        ], 200);
    }

    /**
     * Remove the specified goal.
     * Accessible by: Students (only their own goals)
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Only students can delete goals
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can delete goals.'
            ], 403);
        }

        // Find goal
        $goal = Goal::find($id);

        if (!$goal) {
            return response()->json([
                'message' => 'Goal not found'
            ], 404);
        }

        // Students can only delete their own goals
        if ($goal->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only delete your own goals.'
            ], 403);
        }

        $goal->delete();

        return response()->json([
            'message' => 'Goal deleted successfully'
        ], 200);
    }

    /**
     * Add progress to a goal (increase current_amount).
     * Accessible by: Students (only their own goals)
     */
    public function addProgress(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only students can add progress
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can add progress to goals.'
            ], 403);
        }

        // Find goal
        $goal = Goal::find($id);

        if (!$goal) {
            return response()->json([
                'message' => 'Goal not found'
            ], 404);
        }

        // Students can only update their own goals
        if ($goal->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own goals.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:9999999.99',
        ]);

        // Add to current amount
        $newAmount = $goal->current_amount + $validated['amount'];

        // Cap at target amount
        if ($newAmount > $goal->target_amount) {
            $newAmount = $goal->target_amount;
        }

        $goal->current_amount = $newAmount;
        $goal->save();

        // Load student relationship
        $goal->load('student:id,name,email');

        return response()->json([
            'message' => 'Progress added successfully',
            'data' => $goal
        ], 200);
    }

    /**
     * Get summary of goals for the authenticated student.
     * Accessible by: Students only
     */
    public function mySummary()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        $totalGoals = Goal::forStudent($currentUser->id)->count();
        $completedGoals = Goal::forStudent($currentUser->id)->completed()->count();
        $activeGoals = Goal::forStudent($currentUser->id)->active()->count();

        $totalTargetAmount = Goal::forStudent($currentUser->id)->sum('target_amount');
        $totalCurrentAmount = Goal::forStudent($currentUser->id)->sum('current_amount');
        $totalRemainingAmount = $totalTargetAmount - $totalCurrentAmount;

        // Get overdue goals
        $overdueGoals = Goal::forStudent($currentUser->id)
            ->active()
            ->where('deadline', '<', now())
            ->count();

        return response()->json([
            'message' => 'Goals summary retrieved successfully',
            'data' => [
                'total_goals' => $totalGoals,
                'completed_goals' => $completedGoals,
                'active_goals' => $activeGoals,
                'overdue_goals' => $overdueGoals,
                'financial_summary' => [
                    'total_target_amount' => number_format($totalTargetAmount, 2),
                    'total_current_amount' => number_format($totalCurrentAmount, 2),
                    'total_remaining_amount' => number_format($totalRemainingAmount, 2),
                    'overall_progress_percentage' => $totalTargetAmount > 0 
                        ? round(($totalCurrentAmount / $totalTargetAmount) * 100, 2) 
                        : 0
                ]
            ]
        ], 200);
    }
}