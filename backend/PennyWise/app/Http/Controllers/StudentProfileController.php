<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StudentProfileController extends Controller
{
    /**
     * Display a listing of student profiles.
     * Accessible by: Admin only
     */
    public function index(Request $request)
    {
        $currentUser = Auth::user();

        // Only admins can view all profiles
        if ($currentUser->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only admins can view all student profiles.'
            ], 403);
        }

        // Get all profiles with pagination and include student info
        $profiles = StudentProfile::with('student:id,name,email')
            ->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Student profiles retrieved successfully',
            'data' => $profiles
        ], 200);
    }

    /**
     * Store a newly created student profile.
     * Accessible by: Students (only for themselves)
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();

        // Only students can create their own profile
        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can create a profile.'
            ], 403);
        }

        // Check if student already has a profile
        $existingProfile = StudentProfile::where('student_id', $currentUser->id)->first();
        if ($existingProfile) {
            return response()->json([
                'message' => 'You already have a profile. Use update instead.'
            ], 409);
        }

        // Validate request
        $validated = $request->validate([
            'year_of_study' => 'required|string|max:255',
            'living_situation' => 'required|string|max:255',
            'monthly_allowance_range' => [
                'required',
                Rule::in(StudentProfile::getAllowanceRanges())
            ],
            'course' => 'required|string|max:255',
        ]);

        // Create profile for the authenticated student
        $profile = StudentProfile::create([
            'student_id' => $currentUser->id,
            'year_of_study' => $validated['year_of_study'],
            'living_situation' => $validated['living_situation'],
            'monthly_allowance_range' => $validated['monthly_allowance_range'],
            'course' => $validated['course'],
        ]);

        // Load student relationship
        $profile->load('student:id,name,email');

        return response()->json([
            'message' => 'Student profile created successfully',
            'data' => $profile
        ], 201);
    }

    /**
     * Display the specified student profile.
     * Accessible by: Admin (any profile) and Student (only their own)
     */
    public function show($id)
    {
        $currentUser = Auth::user();

        // Find profile
        $profile = StudentProfile::with('student:id,name,email')->find($id);

        if (!$profile) {
            return response()->json([
                'message' => 'Student profile not found'
            ], 404);
        }

        // Students can only view their own profile
        if ($currentUser->role === 'student' && $profile->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own profile.'
            ], 403);
        }

        return response()->json([
            'message' => 'Student profile retrieved successfully',
            'data' => $profile
        ], 200);
    }

    /**
     * Update the specified student profile.
     * Accessible by: Admin (any profile) and Student (only their own)
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::user();

        // Find profile
        $profile = StudentProfile::find($id);

        if (!$profile) {
            return response()->json([
                'message' => 'Student profile not found'
            ], 404);
        }

        // Students can only update their own profile
        if ($currentUser->role === 'student' && $profile->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only update your own profile.'
            ], 403);
        }

        // Validate request
        $validated = $request->validate([
            'year_of_study' => 'sometimes|string|max:255',
            'living_situation' => 'sometimes|string|max:255',
            'monthly_allowance_range' => [
                'sometimes',
                Rule::in(StudentProfile::getAllowanceRanges())
            ],
            'course' => 'sometimes|string|max:255',
        ]);

        // Update profile
        $profile->update($validated);

        // Load student relationship
        $profile->load('student:id,name,email');

        return response()->json([
            'message' => 'Student profile updated successfully',
            'data' => $profile
        ], 200);
    }

    /**
     * Remove the specified student profile.
     * Accessible by: Admin (any profile) and Student (only their own)
     */
    public function destroy($id)
    {
        $currentUser = Auth::user();

        // Find profile
        $profile = StudentProfile::find($id);

        if (!$profile) {
            return response()->json([
                'message' => 'Student profile not found'
            ], 404);
        }

        // Students can only delete their own profile
        if ($currentUser->role === 'student' && $profile->student_id != $currentUser->id) {
            return response()->json([
                'message' => 'Unauthorized. You can only delete your own profile.'
            ], 403);
        }

        $profile->delete();

        return response()->json([
            'message' => 'Student profile deleted successfully'
        ], 200);
    }

    /**
     * Get the authenticated student's profile.
     * Accessible by: Students only
     */
    public function myProfile()
    {
        $currentUser = Auth::user();

        if ($currentUser->role !== 'student') {
            return response()->json([
                'message' => 'Only students can access this endpoint.'
            ], 403);
        }

        $profile = StudentProfile::with('student:id,name,email')
            ->where('student_id', $currentUser->id)
            ->first();

        if (!$profile) {
            return response()->json([
                'message' => 'Profile not found. Please create your profile first.',
                'data' => null
            ], 404);
        }

        return response()->json([
            'message' => 'Your profile retrieved successfully',
            'data' => $profile
        ], 200);
    }
}