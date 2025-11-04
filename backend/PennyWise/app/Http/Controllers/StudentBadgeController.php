<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Badge;
use App\Models\StudentBadge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class StudentBadgeController extends Controller
{
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

        // Get badges with earned_at timestamp
        $badges = $student->badges()
            ->orderByPivot('earned_at', 'desc')
            ->get();

        return response()->json([
            'message' => 'Student badges retrieved successfully',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email
                ],
                'badges' => $badges,
                'total_badges' => $badges->count()
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

        $badges = $currentUser->badges()
            ->orderByPivot('earned_at', 'desc')
            ->get();

        return response()->json([
            'message' => 'Your badges retrieved successfully',
            'data' => [
                'badges' => $badges,
                'total_badges' => $badges->count()
            ]
        ], 200);
    }

    /**
     * Award a badge to a student.
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

        // Check if student already has this badge
        if ($student->hasBadge($validated['badge_id'])) {
            return response()->json([
                'message' => 'Student already has this badge.'
            ], 409);
        }

        // Award badge
        $student->awardBadge($validated['badge_id']);

        return response()->json([
            'message' => 'Badge awarded successfully',
            'data' => [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email
                ],
                'badge' => $badge,
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

        // Remove badge
        $student->removeBadge($validated['badge_id']);

        return response()->json([
            'message' => 'Badge removed successfully'
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

        // Get students with earned_at timestamp
        $students = $badge->students()
            ->select('users.id', 'users.name', 'users.email')
            ->orderByPivot('earned_at', 'desc')
            ->get();

        return response()->json([
            'message' => 'Students retrieved successfully',
            'data' => [
                'badge' => $badge,
                'students' => $students,
                'total_students' => $students->count()
            ]
        ], 200);
    }
}