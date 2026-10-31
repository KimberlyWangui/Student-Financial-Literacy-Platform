<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Recommendation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class RecommendationController extends Controller
{
    /**
     * Display a listing of recommendations.
     * Admin: View all recommendations
     * Student: View only their own recommendations
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        $query = Recommendation::with('student:id,name,email');

        // Students can only see their own recommendations
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        // Optional filters
        if ($request->has('status')) {
            $query->byStatus($request->status);
        }

        if ($request->has('category')) {
            $query->byCategory($request->category);
        }

        if ($request->has('source_type')) {
            $query->bySourceType($request->source_type);
        }

        // Sort by created_at descending (most recent first)
        $query->orderBy('created_at', 'desc');

        $recommendations = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Recommendations retrieved successfully',
            'data' => $recommendations
        ], 200);
    }

    /**
     * Store a newly created recommendation.
     * Accessible by: Admin only
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can create recommendations
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can create recommendations.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'student_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'recomm_text' => 'required|string',
            'category' => ['required', 'string', 'max:255'],
            'confidence_score' => 'nullable|numeric|min:0|max:100',
            'reasoning' => 'nullable|string',
            'impact_estimate' => 'nullable|numeric',
            'source_type' => ['required', Rule::in(Recommendation::getSourceTypes())],
            'model_version' => 'nullable|string|max:255',
            'status' => ['nullable', Rule::in(Recommendation::getStatuses())],
        ]);

        // Create recommendation
        $recommendation = Recommendation::create($validated);

        // Load student relationship
        $recommendation->load('student:id,name,email');

        return response()->json([
            'message' => 'Recommendation created successfully',
            'data' => $recommendation
        ], 201);
    }

    /**
     * Display the specified recommendation.
     * Admin: View any recommendation
     * Student: View only their own recommendation
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find recommendation
        $recommendation = Recommendation::with('student:id,name,email')->find($id);

        if (!$recommendation) {
            return response()->json([
                'message' => 'Recommendation not found'
            ], 404);
        }

        // Students can only view their own recommendations
        if ($currentUser->role === 'student' && $recommendation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own recommendations.'
            ], 403);
        }

        // Auto-update status to 'viewed' if student views it for the first time
        if ($currentUser->role === 'student' && $recommendation->status === 'pending') {
            $recommendation->status = 'viewed';
            $recommendation->save();
        }

        return response()->json([
            'message' => 'Recommendation retrieved successfully',
            'data' => $recommendation
        ], 200);
    }

    /**
     * Update the specified recommendation.
     * Admin: Full update control
     * Student: Can only update status and feedback
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Find recommendation
        $recommendation = Recommendation::find($id);

        if (!$recommendation) {
            return response()->json([
                'message' => 'Recommendation not found'
            ], 404);
        }

        // Students can only update their own recommendations
        if ($currentUser->role === 'student' && $recommendation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own recommendations.'
            ], 403);
        }

        // Different validation based on role
        if ($currentUser->role === 'admin') {
            // Admin can update everything
            $validated = $request->validate([
                'student_id' => 'sometimes|exists:users,id',
                'title' => 'sometimes|string|max:255',
                'recomm_text' => 'sometimes|string',
                'category' => 'sometimes|string|max:255',
                'confidence_score' => 'nullable|numeric|min:0|max:100',
                'reasoning' => 'nullable|string',
                'impact_estimate' => 'nullable|numeric',
                'source_type' => ['sometimes', Rule::in(Recommendation::getSourceTypes())],
                'model_version' => 'nullable|string|max:255',
                'status' => ['sometimes', Rule::in(Recommendation::getStatuses())],
                'feedback' => 'nullable|string',
            ]);
        } else {
            // Students can only update status and feedback
            $validated = $request->validate([
                'status' => ['sometimes', Rule::in(['viewed', 'accepted', 'rejected', 'ignored'])],
                'feedback' => 'nullable|string',
            ]);

            // Prevent students from changing system-generated content
            if ($request->has(['title', 'recomm_text', 'category', 'confidence_score', 'reasoning', 'impact_estimate', 'source_type', 'model_version'])) {
                return response()->json([
                    'message' => 'Students cannot modify system-generated content.'
                ], 403);
            }
        }

        // Update recommendation
        $recommendation->update($validated);

        // Load student relationship
        $recommendation->load('student:id,name,email');

        return response()->json([
            'message' => 'Recommendation updated successfully',
            'data' => $recommendation
        ], 200);
    }

    /**
     * Remove the specified recommendation.
     * Accessible by: Admin only
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Only admins can delete recommendations
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can delete recommendations.'
            ], 403);
        }

        // Find recommendation
        $recommendation = Recommendation::find($id);

        if (!$recommendation) {
            return response()->json([
                'message' => 'Recommendation not found'
            ], 404);
        }

        $recommendation->delete();

        return response()->json([
            'message' => 'Recommendation deleted successfully'
        ], 200);
    }

    /**
     * Update recommendation status (for students).
     * Accessible by: Students only (for their own recommendations)
     */
    public function updateStatus(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only students can use this endpoint
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'This endpoint is for students only.'
            ], 403);
        }

        // Find recommendation
        $recommendation = Recommendation::find($id);

        if (!$recommendation) {
            return response()->json([
                'message' => 'Recommendation not found'
            ], 404);
        }

        // Students can only update their own recommendations
        if ($recommendation->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own recommendations.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'status' => ['required', Rule::in(['viewed', 'accepted', 'rejected', 'ignored'])],
            'feedback' => 'nullable|string',
        ]);

        // Update status and feedback
        $recommendation->update($validated);

        // Load student relationship
        $recommendation->load('student:id,name,email');

        return response()->json([
            'message' => 'Recommendation status updated successfully',
            'data' => $recommendation
        ], 200);
    }

    /**
     * Get recommendation statistics.
     * Admin: Statistics for all recommendations
     * Student: Statistics for their own recommendations
     */
    public function statistics()
    {
        $currentUser = Auth::user();

        $query = Recommendation::query();

        // Students can only see their own statistics
        if ($currentUser->role === 'student') {
            $query->where('student_id', $currentUser->id);
        }

        $total = $query->count();
        $pending = $query->clone()->where('status', 'pending')->count();
        $viewed = $query->clone()->where('status', 'viewed')->count();
        $accepted = $query->clone()->where('status', 'accepted')->count();
        $rejected = $query->clone()->where('status', 'rejected')->count();
        $ignored = $query->clone()->where('status', 'ignored')->count();

        // By source type
        $aiModel = $query->clone()->where('source_type', 'AI_Model')->count();
        $admin = $query->clone()->where('source_type', 'Admin')->count();
        $systemRule = $query->clone()->where('source_type', 'System_Rule')->count();

        // Calculate average confidence score
        $avgConfidence = $query->clone()->whereNotNull('confidence_score')->avg('confidence_score');

        // Calculate total estimated impact
        $totalImpact = $query->clone()->whereNotNull('impact_estimate')->sum('impact_estimate');

        return response()->json([
            'message' => 'Recommendation statistics retrieved successfully',
            'data' => [
                'total_recommendations' => $total,
                'by_status' => [
                    'pending' => $pending,
                    'viewed' => $viewed,
                    'accepted' => $accepted,
                    'rejected' => $rejected,
                    'ignored' => $ignored,
                ],
                'by_source' => [
                    'ai_model' => $aiModel,
                    'admin' => $admin,
                    'system_rule' => $systemRule,
                ],
                'metrics' => [
                    'average_confidence_score' => $avgConfidence ? round($avgConfidence, 2) : null,
                    'total_estimated_impact' => $totalImpact ? number_format($totalImpact, 2) : null,
                    'acceptance_rate' => $total > 0 ? round(($accepted / $total) * 100, 2) : 0,
                ]
            ]
        ], 200);
    }

    /**
     * Get metadata (categories, statuses, source types).
     * Accessible by: All authenticated users
     */
    public function metadata()
    {
        return response()->json([
            'message' => 'Metadata retrieved successfully',
            'data' => [
                'categories' => Recommendation::getCategories(),
                'statuses' => Recommendation::getStatuses(),
                'source_types' => Recommendation::getSourceTypes(),
            ]
        ], 200);
    }
}