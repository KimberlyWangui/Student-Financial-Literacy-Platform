<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Badge;
use App\Models\StudentBadge;
use App\Services\BadgeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class StudentBadgeController extends Controller
{
    protected $badgeService;

    public function __construct(BadgeService $badgeService)
    {
        $this->badgeService = $badgeService;
    }

    /**
     * Get badges for a specific student.
     * Admin: Can view any student's badges
     * Student: Can only view their own badges
     */
    public function getStudentBadges($studentId)
    {
        $currentUser = Auth::user();

        // Students can only view their own badges
        if ($currentUser->role === 'student' && $currentUser->id != $studentId) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own badges.'
            ], 403);
        }

        // Find student
        $student = User::find($studentId);

        if (!$student) {
            return response()->json([
                'message' => 'Student not found'
            ], 404);
        }

        // Get badges with earned_at and xp_earned
        $badges = $student->badges()
            ->orderByPivot('earned_at', 'desc')
            ->get();

        // Get student profile for XP info
        $profile = $student->studentProfile;

        return response()->json([
            'message' => 'Student badges retrieved successfully',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'total_xp' => $profile ? $profile->xp_total : 0,
                    'level' => $profile ? $profile->xp_level : 0,
                    'xp_progress' => $profile ? $profile->xp_progress : 0,
                    'xp_needed' => $profile ? $profile->xp_needed : 100,
                ],
                'badges' => $badges,
                'total_badges' => $badges->count(),
                'total_xp_from_badges' => $badges->sum('pivot.xp_earned')
            ]
        ], 200);
    }

    /**
     * Get my badges (authenticated student).
     * Accessible by: Students only
     */
    public function myBadges()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        // Get badges with all necessary fields
        $badges = $currentUser->badges()
            ->orderByPivot('earned_at', 'desc')
            ->get()
            ->map(function ($badge) {
                return [
                    'badge_id' => $badge->badge_id,
                    'badge_name' => $badge->badge_name,
                    'description' => $badge->description,
                    'criteria_type' => $badge->criteria_type,
                    'criteria_value' => $badge->criteria_value,
                    'xp_reward' => $badge->xp_reward,
                    'image_url' => $badge->image_url,
                    'image_url_full' => $badge->image_url_full,
                    'earned_at' => $badge->pivot->earned_at,
                    'xp_earned' => $badge->pivot->xp_earned,
                    'criteria_description' => $badge->criteria_description,
                ];
            });

        $profile = $currentUser->studentProfile;

        return response()->json([
            'message' => 'Your badges retrieved successfully',
            'data' => $badges,
            'summary' => [
                'total_badges' => $badges->count(),
                'total_xp_from_badges' => $badges->sum('xp_earned'),
                'xp_info' => [
                    'total_xp' => $profile ? $profile->xp_total : 0,
                    'level' => $profile ? $profile->xp_level : 0,
                    'xp_progress' => $profile ? $profile->xp_progress : 0,
                    'xp_needed' => $profile ? $profile->xp_needed : 100,
                ]
            ]
        ], 200);
    }

    /**
     * Get badge progress for authenticated student.
     * Shows progress towards earning each badge.
     * Accessible by: Students only
     */
    public function myBadgeProgress()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        $progress = $this->badgeService->getBadgeProgress($currentUser);

        return response()->json([
            'message' => 'Badge progress retrieved successfully',
            'data' => $progress
        ], 200);
    }

    /**
     * Check and award eligible badges for authenticated student.
     * This endpoint manually triggers badge checking.
     * Accessible by: Students only
     */
    public function checkMyBadges()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        $newBadges = $this->badgeService->checkAndAwardBadges($currentUser);

        if ($newBadges->isEmpty()) {
            return response()->json([
                'message' => 'No new badges earned at this time.',
                'data' => [
                    'newly_earned' => [],
                    'new_badges' => [],
                    'total_new_badges' => 0,
                    'total_xp_earned' => 0
                ]
            ], 200);
        }

        $totalXp = $newBadges->sum('xp_reward');

        return response()->json([
            'message' => 'Congratulations! You earned new badges!',
            'data' => [
                'newly_earned' => $newBadges,
                'new_badges' => $newBadges,
                'total_new_badges' => $newBadges->count(),
                'total_xp_earned' => $totalXp
            ]
        ], 200);
    }

    /**
     * Award a badge to a student (Manual award by admin).
     * Accessible by: Admin only
     */
    public function awardBadge(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can award badges
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can award badges.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'student_id' => 'required|exists:users,id',
            'badge_id' => 'required|exists:badges,badge_id',
        ]);

        // Find student and badge
        $student = User::find($validated['student_id']);
        $badge = Badge::find($validated['badge_id']);

        // Check if student is actually a student
        if ($student->role !== 'student') {
            return response()->json([
                'message' => 'User is not a student.'
            ], 422);
        }

        // Check if student already has this badge
        if ($student->hasBadge($validated['badge_id'])) {
            return response()->json([
                'message' => 'Student already has this badge.'
            ], 409);
        }

        // Award badge with XP
        $student->awardBadge($validated['badge_id'], $badge->xp_reward);

        // Get updated profile
        $profile = $student->studentProfile;

        return response()->json([
            'message' => 'Badge awarded successfully',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'total_xp' => $profile ? $profile->xp_total : 0,
                    'level' => $profile ? $profile->xp_level : 0,
                ],
                'badge' => $badge,
                'xp_earned' => $badge->xp_reward,
                'earned_at' => now()
            ]
        ], 201);
    }

    /**
     * Remove a badge from a student.
     * Accessible by: Admin only
     */
    public function removeBadge(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can remove badges
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can remove badges.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'student_id' => 'required|exists:users,id',
            'badge_id' => 'required|exists:badges,badge_id',
        ]);

        // Find student
        $student = User::find($validated['student_id']);

        // Check if student has this badge
        if (!$student->hasBadge($validated['badge_id'])) {
            return response()->json([
                'message' => 'Student does not have this badge.'
            ], 404);
        }

        // Remove badge (also removes XP)
        $student->removeBadge($validated['badge_id']);

        // Get updated profile
        $profile = $student->studentProfile;

        return response()->json([
            'message' => 'Badge removed successfully',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'total_xp' => $profile ? $profile->xp_total : 0,
                    'level' => $profile ? $profile->xp_level : 0,
                ]
            ]
        ], 200);
    }

    /**
     * Get all students who earned a specific badge.
     * Accessible by: Admin only
     */
    public function getBadgeStudents($badgeId)
    {
        $currentUser = Auth::user();

        // Only admins can view this
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Only admins can view this information.'
            ], 403);
        }

        // Find badge
        $badge = Badge::find($badgeId);

        if (!$badge) {
            return response()->json([
                'message' => 'Badge not found'
            ], 404);
        }

        // Get students with earned_at and xp_earned
        $students = $badge->students()
            ->select('users.id', 'users.name', 'users.email')
            ->orderByPivot('earned_at', 'desc')
            ->get();

        return response()->json([
            'message' => 'Students retrieved successfully',
            'data' => [
                'badge' => $badge,
                'students' => $students,
                'total_students' => $students->count(),
                'total_xp_distributed' => $students->sum('pivot.xp_earned')
            ]
        ], 200);
    }

    /**
     * Get leaderboard based on XP.
     * Accessible by: All authenticated users
     */
    public function leaderboard(Request $request)
    {
        $limit = $request->get('limit', 10);
        $limit = min($limit, 100); // Max 100 students

        $students = User::where('role', 'student')
            ->whereHas('studentProfile')
            ->with(['studentProfile:student_id,xp_total', 'badges'])
            ->get()
            ->map(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'xp_total' => $student->studentProfile->xp_total ?? 0,
                    'level' => $student->studentProfile->xp_level ?? 0,
                    'badge_count' => $student->badges->count(),
                ];
            })
            ->sortByDesc('xp_total')
            ->take($limit)
            ->values();

        return response()->json([
            'message' => 'Leaderboard retrieved successfully',
            'data' => $students
        ], 200);
    }
}