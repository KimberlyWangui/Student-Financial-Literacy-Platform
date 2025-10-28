<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Badge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class BadgeController extends Controller
{
    /**
     * Display a listing of badges.
     * Accessible by: All authenticated users (READ only for students)
     */
    public function index(Request $request)
    {
        $query = Badge::query();

        // Optional search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('badge_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sort by created_at descending (most recent first)
        $query->orderBy('created_at', 'desc');

        $badges = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Badges retrieved successfully',
            'data' => $badges
        ], 200);
    }

    /**
     * Store a newly created badge.
     * Accessible by: Admin only
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can create badges
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can create badges.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'badge_name' => 'required|string|max:255|unique:badges,badge_name',
            'description' => 'required|string',
            'criteria' => 'required|string',
            'image' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048', // Max 2MB
        ]);

        // Handle image upload
        $imageUrl = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = Str::slug($validated['badge_name']) . '-' . time() . '.' . $image->getClientOriginalExtension();
            
            // Store in public/images directory
            $image->move(public_path('images'), $imageName);
            $imageUrl = "/images/{$imageName}";
        }

        // Create badge
        $badge = Badge::create([
            'badge_name' => $validated['badge_name'],
            'description' => $validated['description'],
            'criteria' => $validated['criteria'],
            'image_url' => $imageUrl,
        ]);

        return response()->json([
            'message' => 'Badge created successfully',
            'data' => $badge
        ], 201);
    }

    /**
     * Display the specified badge.
     * Accessible by: All authenticated users
     */
    public function show($id)
    {
        // Find badge
        $badge = Badge::find($id);

        if (!$badge) {
            return response()->json([
                'message' => 'Badge not found'
            ], 404);
        }

        // Load students who earned this badge (for admin)
        if (Auth::user()->role === 'admin') {
            $badge->load(['students' => function ($query) {
                $query->select('users.id', 'users.name', 'users.email')
                      ->withPivot('earned_at');
            }]);
        }

        return response()->json([
            'message' => 'Badge retrieved successfully',
            'data' => $badge
        ], 200);
    }

    /**
     * Update the specified badge.
     * Accessible by: Admin only
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Only admins can update badges
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can update badges.'
            ], 403);
        }

        // Find badge
        $badge = Badge::find($id);

        if (!$badge) {
            return response()->json([
                'message' => 'Badge not found'
            ], 404);
        }

        // Validate request
        $validated = $request->validate([
            'badge_name' => 'sometimes|string|max:255|unique:badges,badge_name,' . $id . ',badge_id',
            'description' => 'sometimes|string',
            'criteria' => 'sometimes|string',
            'image' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
        ]);

        // Handle image upload
        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($badge->image_url && file_exists(public_path($badge->image_url))) {
                unlink(public_path($badge->image_url));
            }

            $image = $request->file('image');
            $imageName = Str::slug($validated['badge_name'] ?? $badge->badge_name) . '-' . time() . '.' . $image->getClientOriginalExtension();
            
            // Store in public/images directory
            $image->move(public_path('images'), $imageName);
            $validated['image_url'] = "/images/{$imageName}";
        }

        // Update badge
        $badge->update($validated);

        return response()->json([
            'message' => 'Badge updated successfully',
            'data' => $badge
        ], 200);
    }

    /**
     * Remove the specified badge.
     * Accessible by: Admin only
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Only admins can delete badges
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can delete badges.'
            ], 403);
        }

        // Find badge
        $badge = Badge::find($id);

        if (!$badge) {
            return response()->json([
                'message' => 'Badge not found'
            ], 404);
        }

        // Delete image if exists
        if ($badge->image_url && file_exists(public_path($badge->image_url))) {
            unlink(public_path($badge->image_url));
        }

        $badge->delete();

        return response()->json([
            'message' => 'Badge deleted successfully'
        ], 200);
    }

    /**
     * Get badge statistics.
     * Accessible by: Admin only
     */
    public function statistics()
    {
        $currentUser = Auth::user();

        // Only admins can view statistics
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can view badge statistics.'
            ], 403);
        }

        $totalBadges = Badge::count();
        $totalAwarded = DB::table('student_badges')->count();
        
        // Get most earned badges
        $mostEarnedBadges = Badge::withCount('students')
            ->orderBy('students_count', 'desc')
            ->take(5)
            ->get();

        return response()->json([
            'message' => 'Badge statistics retrieved successfully',
            'data' => [
                'total_badges' => $totalBadges,
                'total_awarded' => $totalAwarded,
                'most_earned_badges' => $mostEarnedBadges
            ]
        ], 200);
    }
}