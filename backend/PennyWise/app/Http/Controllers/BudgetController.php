<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BudgetController extends Controller
{
    /**
     * Display a listing of budgets.
     * Admin: View all budgets (READ only)
     * Student: View only their own budgets
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = Budget::with('student:id,name,email');

        // Students can only see their own budgets
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Optional filters
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('status')) {
            if ($request->status === 'active') {
                $query->active();
            } elseif ($request->status === 'expired') {
                $query->expired();
            } elseif ($request->status === 'upcoming') {
                $query->upcoming();
            }
        }

        // Sort by start_date descending (most recent first)
        $query->orderBy('start_date', 'desc');

        $budgets = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Budgets retrieved successfully',
            'data' => $budgets
        ], 200);
    }

    /**
     * Store a newly created budget.
     * Accessible by: Students only (only for themselves)
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create budgets
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create budgets.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'category' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01|max:9999999.99',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
        ]);

        // Check for overlapping budgets in the same category
        $overlapping = Budget::where('student_id', $currentUser->id)
            ->where('category', $validated['category'])
            ->where(function ($query) use ($validated) {
                $query->whereBetween('start_date', [$validated['start_date'], $validated['end_date']])
                    ->orWhereBetween('end_date', [$validated['start_date'], $validated['end_date']])
                    ->orWhere(function ($q) use ($validated) {
                        $q->where('start_date', '<=', $validated['start_date'])
                          ->where('end_date', '>=', $validated['end_date']);
                    });
            })
            ->exists();

        if ($overlapping) {
            return response()->json([
                'message' => 'A budget for this category already exists in the specified date range.'
            ], 422);
        }

        // Create budget for the authenticated student
        $budget = Budget::create([
            'student_id' => $currentUser->id,
            'category' => $validated['category'],
            'amount' => $validated['amount'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
        ]);

        // Load student relationship
        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget created successfully',
            'data' => $budget
        ], 201);
    }

    /**
     * Display the specified budget.
     * Admin: View any budget (READ only)
     * Student: View only their own budget
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find budget
        $budget = Budget::with('student:id,name,email')->find($id);

        if (!$budget) {
            return response()->json([
                'message' => 'Budget not found'
            ], 404);
        }

        // Students can only view their own budgets
        if ($currentUser->role === 'student' && $budget->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own budgets.'
            ], 403);
        }

        return response()->json([
            'message' => 'Budget retrieved successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Update the specified budget.
     * Accessible by: Students only (only their own budgets)
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only students can update budgets
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can update budgets.'
            ], 403);
        }

        // Find budget
        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json([
                'message' => 'Budget not found'
            ], 404);
        }

        // Students can only update their own budgets
        if ($budget->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own budgets.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'category' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01|max:9999999.99',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
        ]);

        // If dates are being updated, check end_date is after start_date
        $startDate = $validated['start_date'] ?? $budget->start_date;
        $endDate = $validated['end_date'] ?? $budget->end_date;

        if ($endDate <= $startDate) {
            return response()->json([
                'message' => 'End date must be after start date'
            ], 422);
        }

        // Check for overlapping budgets if category or dates are being updated
        if (isset($validated['category']) || isset($validated['start_date']) || isset($validated['end_date'])) {
            $category = $validated['category'] ?? $budget->category;

            $overlapping = Budget::where('student_id', $currentUser->id)
                ->where('budget_id', '!=', $id)
                ->where('category', $category)
                ->where(function ($query) use ($startDate, $endDate) {
                    $query->whereBetween('start_date', [$startDate, $endDate])
                        ->orWhereBetween('end_date', [$startDate, $endDate])
                        ->orWhere(function ($q) use ($startDate, $endDate) {
                            $q->where('start_date', '<=', $startDate)
                              ->where('end_date', '>=', $endDate);
                        });
                })
                ->exists();

            if ($overlapping) {
                return response()->json([
                    'message' => 'A budget for this category already exists in the specified date range.'
                ], 422);
            }
        }

        // Update budget
        $budget->update($validated);

        // Load student relationship
        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget updated successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Remove the specified budget.
     * Accessible by: Students only (only their own budgets)
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Only students can delete budgets
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can delete budgets.'
            ], 403);
        }

        // Find budget
        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json([
                'message' => 'Budget not found'
            ], 404);
        }

        // Students can only delete their own budgets
        if ($budget->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only delete your own budgets.'
            ], 403);
        }

        $budget->delete();

        return response()->json([
            'message' => 'Budget deleted successfully'
        ], 200);
    }

    /**
     * Get budget summary for the authenticated student.
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

        $totalBudgets = Budget::forStudent($currentUser->id)->count();
        $activeBudgets = Budget::forStudent($currentUser->id)->active()->count();
        $expiredBudgets = Budget::forStudent($currentUser->id)->expired()->count();

        // Get total budgeted amount for active budgets
        $totalBudgetedAmount = Budget::forStudent($currentUser->id)
            ->active()
            ->sum('amount');

        // Get budgets with exceeded status
        $activeBudgetsList = Budget::forStudent($currentUser->id)
            ->active()
            ->get();

        $exceededBudgets = $activeBudgetsList->filter(function ($budget) {
            return $budget->is_exceeded;
        })->count();

        $totalSpent = $activeBudgetsList->sum('total_spent');
        $totalRemaining = max($totalBudgetedAmount - $totalSpent, 0);

        return response()->json([
            'message' => 'Budget summary retrieved successfully',
            'data' => [
                'total_budgets' => $totalBudgets,
                'active_budgets' => $activeBudgets,
                'expired_budgets' => $expiredBudgets,
                'exceeded_budgets' => $exceededBudgets,
                'financial_summary' => [
                    'total_budgeted_amount' => number_format($totalBudgetedAmount, 2),
                    'total_spent' => number_format($totalSpent, 2),
                    'total_remaining' => number_format($totalRemaining, 2),
                    'overall_usage_percentage' => $totalBudgetedAmount > 0 
                        ? round(($totalSpent / $totalBudgetedAmount) * 100, 2) 
                        : 0
                ]
            ]
        ], 200);
    }

    /**
     * Get available budget categories.
     * Accessible by: All authenticated users
     */
    public function categories()
    {
        return response()->json([
            'message' => 'Categories retrieved successfully',
            'data' => Budget::getCategories()
        ], 200);
    }
}