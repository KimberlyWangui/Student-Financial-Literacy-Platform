<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\FinancialData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class FinancialDataController extends Controller
{
    /**
     * Display a listing of financial data entries.
     * Admin: View all entries
     * Student: View only their own entries
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = FinancialData::with('student:id,name,email');

        // Students can only see their own entries
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Optional filters
        if ($request->has('entry_type')) {
            $query->where('entry_type', $request->entry_type);
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('entry_date', [$request->start_date, $request->end_date]);
        }

        // Sort by entry_date descending (most recent first)
        $query->orderBy('entry_date', 'desc');

        $entries = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Financial data retrieved successfully',
            'data' => $entries
        ], 200);
    }

    /**
     * Store a newly created financial entry.
     * Accessible by: Students (only for themselves)
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create financial entries
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create financial entries.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'entry_type' => ['required', Rule::in(FinancialData::getEntryTypes())],
            'category' => ['required', 'string', 'max:255'],
            'amount' => 'required|numeric|min:0|max:9999999.99',
            'entry_date' => 'required|date|before_or_equal:today',
        ]);

        // Create financial entry for the authenticated student
        $entry = FinancialData::create([
            'student_id' => $currentUser->id,
            'entry_type' => $validated['entry_type'],
            'category' => $validated['category'],
            'amount' => $validated['amount'],
            'entry_date' => $validated['entry_date'],
        ]);

        // Load student relationship
        $entry->load('student:id,name,email');

        return response()->json([
            'message' => 'Financial entry created successfully',
            'data' => $entry
        ], 201);
    }

    /**
     * Display the specified financial entry.
     * Admin: View any entry
     * Student: View only their own entry
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find entry
        $entry = FinancialData::with('student:id,name,email')->find($id);

        if (!$entry) {
            return response()->json([
                'message' => 'Financial entry not found'
            ], 404);
        }

        // Students can only view their own entries
        if ($currentUser->role === 'student' && $entry->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own financial entries.'
            ], 403);
        }

        return response()->json([
            'message' => 'Financial entry retrieved successfully',
            'data' => $entry
        ], 200);
    }

    /**
     * Update the specified financial entry.
     * Admin: Update any entry
     * Student: Update only their own entry
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Find entry
        $entry = FinancialData::find($id);

        if (!$entry) {
            return response()->json([
                'message' => 'Financial entry not found'
            ], 404);
        }

        // Students can only update their own entries
        if ($currentUser->role === 'student' && $entry->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own financial entries.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'entry_type' => ['sometimes', Rule::in(FinancialData::getEntryTypes())],
            'category' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0|max:9999999.99',
            'entry_date' => 'sometimes|date|before_or_equal:today',
        ]);

        // Update entry
        $entry->update($validated);

        // Load student relationship
        $entry->load('student:id,name,email');

        return response()->json([
            'message' => 'Financial entry updated successfully',
            'data' => $entry
        ], 200);
    }

    /**
     * Remove the specified financial entry.
     * Admin: Delete any entry
     * Student: Delete only their own entry
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Find entry
        $entry = FinancialData::find($id);

        if (!$entry) {
            return response()->json([
                'message' => 'Financial entry not found'
            ], 404);
        }

        // Students can only delete their own entries
        if ($currentUser->role === 'student' && $entry->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only delete your own financial entries.'
            ], 403);
        }

        $entry->delete();

        return response()->json([
            'message' => 'Financial entry deleted successfully'
        ], 200);
    }

    /**
     * Get financial summary for the authenticated student.
     * Accessible by: Students only
     */
    public function mySummary(Request $request)
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        // Get date range (default to current month)
        $startDate = $request->get('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', now()->endOfMonth()->toDateString());

        // Calculate totals
        $totalIncome = FinancialData::forStudent($currentUser->id)
            ->ofType('income')
            ->dateRange($startDate, $endDate)
            ->sum('amount');

        $totalExpenses = FinancialData::forStudent($currentUser->id)
            ->ofType('expense')
            ->dateRange($startDate, $endDate)
            ->sum('amount');

        $balance = $totalIncome - $totalExpenses;

        // Get category breakdown for expenses
        $expensesByCategory = FinancialData::forStudent($currentUser->id)
            ->ofType('expense')
            ->dateRange($startDate, $endDate)
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->orderBy('total', 'desc')
            ->get();

        return response()->json([
            'message' => 'Financial summary retrieved successfully',
            'data' => [
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ],
                'summary' => [
                    'total_income' => number_format($totalIncome, 2),
                    'total_expenses' => number_format($totalExpenses, 2),
                    'balance' => number_format($balance, 2)
                ],
                'expenses_by_category' => $expensesByCategory
            ]
        ], 200);
    }

    /**
     * Get available entry types and categories.
     * Accessible by: All authenticated users
     */
    public function metadata()
    {
        return response()->json([
            'message' => 'Metadata retrieved successfully',
            'data' => [
                'entry_types' => FinancialData::getEntryTypes(),
                'categories' => FinancialData::getCategories()
            ]
        ], 200);
    }
};