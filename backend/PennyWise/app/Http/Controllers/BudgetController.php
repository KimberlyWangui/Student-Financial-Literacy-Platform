<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;

class BudgetController extends Controller
{
    /**
     * Display a listing of budgets.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = Auth::user();
        $query = Budget::with('student:id,name,email');

        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        if ($request->has('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->has('status')) {
            $status = $request->input('status');
            
            if (in_array($status, Budget::getStatuses())) {
                $query->byStatus($status);
            } elseif ($status === 'active_period') {
                $query->active();
            } elseif ($status === 'expired_period') {
                $query->expired();
            } elseif ($status === 'upcoming_period') {
                $query->upcoming();
            }
        }

        $query->orderBy('start_date', 'desc');
        $perPage = $request->input('per_page', 15);
        
        if ($perPage === 'all' || $perPage > 100) {
            $budgets = $query->get();
            return response()->json([
                'message' => 'Budgets retrieved successfully',
                'data' => $budgets
            ], 200);
        }

        $budgets = $query->paginate($perPage);
        return response()->json([
            'message' => 'Budgets retrieved successfully',
            'data' => $budgets->items()
        ], 200);
    }

    /**
     * Store a newly created budget.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can create budgets.'], 403);
        }

        $validated = $request->validate([
            'category' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01|max:9999999.99',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'actual_spent' => 'nullable|numeric|min:0|max:9999999.99',
            'status' => ['nullable', Rule::in(Budget::getStatuses())],
        ]);

        $overlapping = Budget::where('student_id', $currentUser->id)
            ->where('category', $validated['category'])
            ->where(function ($query) use ($validated) {
                $query->whereBetween('start_date', [$validated['start_date'], $validated['end_date']])
                    ->orWhereBetween('end_date', [$validated['start_date'], $validated['end_date']])
                    ->orWhere(function ($q) use ($validated) {
                        $q->where('start_date', '<=', $validated['start_date'])
                          ->where('end_date', '>=', $validated['end_date']);
                    });
            })->exists();

        if ($overlapping) {
            return response()->json(['message' => 'A budget for this category already exists in the specified date range.'], 422);
        }

        $budget = Budget::create([
            'student_id' => $currentUser->id,
            'category' => $validated['category'],
            'amount' => $validated['amount'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'actual_spent' => $validated['actual_spent'] ?? 0.00,
            'status' => $validated['status'] ?? 'active',
        ]);

        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget created successfully',
            'data' => $budget
        ], 201);
    }

    /**
     * Display the specified budget.
     *
     * @param int|string $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $currentUser = Auth::user();
        $budget = Budget::with('student:id,name,email')->find($id);

        if (!$budget) {
            return response()->json(['message' => 'Budget not found'], 404);
        }

        if ($currentUser->role === 'student' && $budget->student_id != $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. You can only view your own budgets.'], 403);
        }

        return response()->json([
            'message' => 'Budget retrieved successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Update the specified budget.
     *
     * @param Request $request
     * @param int|string $id
     * @return JsonResponse
     */
    public function update(Request $request, $id): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can update budgets.'], 403);
        }

        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json(['message' => 'Budget not found'], 404);
        }

        if ($budget->student_id != $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. You can only update your own budgets.'], 403);
        }

        $validated = $request->validate([
            'category' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01|max:9999999.99',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'actual_spent' => 'sometimes|numeric|min:0|max:9999999.99',
            'status' => ['sometimes', Rule::in(Budget::getStatuses())],
        ]);

        $startDate = $validated['start_date'] ?? $budget->start_date;
        $endDate = $validated['end_date'] ?? $budget->end_date;

        if ($endDate <= $startDate) {
            return response()->json(['message' => 'End date must be after start date'], 422);
        }

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
                })->exists();

            if ($overlapping) {
                return response()->json(['message' => 'A budget for this category already exists in the specified date range.'], 422);
            }
        }

        $budget->update($validated);
        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget updated successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Remove the specified budget.
     *
     * @param int|string $id
     * @return JsonResponse
     */
    public function destroy($id): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can delete budgets.'], 403);
        }

        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json(['message' => 'Budget not found'], 404);
        }

        if ($budget->student_id != $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. You can only delete your own budgets.'], 403);
        }

        $budget->delete();

        return response()->json(['message' => 'Budget deleted successfully'], 200);
    }

    /**
     * Sync actual_spent for a budget from financial data.
     *
     * @param int|string $id
     * @return JsonResponse
     */
    public function syncActualSpent($id): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can sync their budgets.'], 403);
        }

        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json(['message' => 'Budget not found'], 404);
        }

        if ($budget->student_id != $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. You can only sync your own budgets.'], 403);
        }

        $budget->syncActualSpent();
        $budget->updateStatus();
        $budget->refresh();
        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget synced successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Update status for a budget.
     *
     * @param int|string $id
     * @return JsonResponse
     */
    public function updateStatus($id): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can update budget status.'], 403);
        }

        $budget = Budget::find($id);

        if (!$budget) {
            return response()->json(['message' => 'Budget not found'], 404);
        }

        if ($budget->student_id != $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. You can only update your own budgets.'], 403);
        }

        $budget->updateStatus();
        $budget->refresh();
        $budget->load('student:id,name,email');

        return response()->json([
            'message' => 'Budget status updated successfully',
            'data' => $budget
        ], 200);
    }

    /**
     * Get budget summary for the authenticated student.
     *
     * @return JsonResponse
     */
    public function mySummary(): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json(['message' => 'Only students can access this endpoint.'], 403);
        }

        // Get all budgets for the student
        $allBudgets = Budget::forStudent($currentUser->id)->get();

        // Count by status (enum values)
        $statusCounts = [
            'active'    => $allBudgets->where('status', 'active')->count(),
            'completed' => $allBudgets->where('status', 'completed')->count(),
            'over'      => $allBudgets->where('status', 'over')->count(),
            'under'     => $allBudgets->where('status', 'under')->count(),
        ];

        // Count actually exceeded budgets (regardless of status)
        $exceededCount = $allBudgets->filter(function ($budget) {
            return (float)$budget->actual_spent > (float)$budget->amount;
        })->count();

        // Get total budgeted amount for all budgets
        $totalBudgetedAmount = $allBudgets->sum('amount');
        $totalActualSpent = $allBudgets->sum('actual_spent');
        $totalRemaining = max($totalBudgetedAmount - $totalActualSpent, 0);

        return response()->json([
            'message' => 'Budget summary retrieved successfully',
            'data' => [
                'total_budgets' => (float) $totalBudgetedAmount,
                'exceeded_budgets' => $exceededCount,
                'status_counts' => $statusCounts,
                'financial_summary' => [
                    'total_budgeted_amount'    => (float) $totalBudgetedAmount,
                    'total_actual_spent'       => (float) $totalActualSpent,
                    'total_remaining'          => (float) $totalRemaining,
                    'overall_usage_percentage' => $totalBudgetedAmount > 0
                        ? round(($totalActualSpent / $totalBudgetedAmount) * 100, 2)
                        : 0
                ]
            ]
        ], 200);
    }

    /**
     * Get available budget categories and statuses.
     *
     * @return JsonResponse
     */
    public function metadata(): JsonResponse
    {
        return response()->json([
            'message' => 'Metadata retrieved successfully',
            'data' => [
                'categories' => Budget::getCategories(),
                'statuses' => Budget::getStatuses()
            ]
        ], 200);
    }
}