<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\StudentProfileController;
use App\Http\Controllers\RecommendationController;
use App\Http\Controllers\SimulationController;
use App\Http\Controllers\BadgeController;
use App\Http\Controllers\StudentBadgeController;
use App\Http\Controllers\InvestmentSimulationController;
use App\Http\Controllers\StatementController;

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

Route::post('/register',           [AuthController::class,         'register']);
Route::post('/login',              [AuthController::class,         'login']);
Route::post('/forgot-password',    [PasswordResetController::class,'forgotPassword']);
Route::post('/reset-password',     [PasswordResetController::class,'reset']);
Route::post('/verify-otp',         [AuthController::class,         'verifyOtp']);
Route::post('/resend-otp',         [AuthController::class,         'resendOtp']);

// Google OAuth routes
Route::get('/auth/google',         [GoogleAuthController::class,   'redirectToGoogle']);
Route::get('/auth/google/callback',[GoogleAuthController::class,   'handleGoogleCallback']);
Route::post('/auth/google/exchange', [GoogleAuthController::class, 'exchange'])->middleware('throttle:10,1');

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

Route::middleware('auth:sanctum')->group(function () {

    // Get authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Authentication routes
    Route::post('/logout',          [AuthController::class,         'logout']);
    Route::post('/enable-2fa',      [AuthController::class,         'enable2FA']);
    Route::post('/disable-2fa',     [AuthController::class,         'disable2FA']);

    // ============================================
    // USER MANAGEMENT ROUTES
    // ============================================

    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        Route::get(   'users/{id}', [UserController::class,         'show']);
        Route::put(   'users/{id}', [UserController::class,         'update']);
        Route::patch( 'users/{id}', [UserController::class,         'update']);
    });

    // Routes accessible by admins only
    Route::middleware('admin')->group(function () {
        Route::get(   'users',      [UserController::class,         'index']);
        Route::post(  'users',      [UserController::class,         'store']);
        Route::delete('users/{id}', [UserController::class,         'destroy']);
    });

    // ============================================
    // STUDENT PROFILE ROUTES
    // ============================================

    // Get profile metadata - available to all authenticated users
    Route::get('student-profiles/metadata', [StudentProfileController::class, 'metadata']);

    // Get my profile (student only) - Must come before {id} route
    Route::get('student-profiles/me', [StudentProfileController::class, 'myProfile']);

    // Admin can view all profiles
    Route::middleware('admin')->group(function () {
        Route::get('student-profiles', [StudentProfileController::class, 'index']);
        Route::get('student-profiles/active', [StudentProfileController::class, 'activeStudents']);
        Route::get('student-profiles/total-students', [StudentProfileController::class, 'totalStudents']);
        Route::get('student-profiles/new-students', [StudentProfileController::class, 'newStudents']);
    });

    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // Create profile
        Route::post('student-profiles', [StudentProfileController::class, 'store']);

        // View, update, and delete specific profile
        Route::get('student-profiles/{id}', [StudentProfileController::class, 'show']);
        Route::put('student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::patch('student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::delete('student-profiles/{id}', [StudentProfileController::class, 'destroy']);
    });

    // ============================================
    // RECOMMENDATIONS ROUTES
    // ============================================
    
    // Get metadata (categories, statuses, source types) - available to all
    Route::get('recommendations/metadata', [RecommendationController::class, 'metadata']);
    
    // Get recommendation statistics - Must come before {id} route
    Route::get('recommendations/statistics', [RecommendationController::class, 'statistics']);
    
    // Update recommendation status (student only) - Must come before {id} route
    Route::patch('recommendations/{id}/status', [RecommendationController::class, 'updateStatus']);
    
    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // List recommendations (filtered by role in controller)
        Route::get('recommendations', [RecommendationController::class, 'index']);
        
        // View specific recommendation
        Route::get('recommendations/{id}', [RecommendationController::class, 'show']);
        
        // Update recommendation (different permissions in controller)
        Route::put('recommendations/{id}', [RecommendationController::class, 'update']);
        Route::patch('recommendations/{id}', [RecommendationController::class, 'update']);
    });
    
    // Admin-only routes
    Route::middleware('admin')->group(function () {
        // Create recommendation
        Route::post('recommendations', [RecommendationController::class, 'store']);
        
        // Delete recommendation
        Route::delete('recommendations/{id}', [RecommendationController::class, 'destroy']);
    });

    // ============================================
    // M-PESA STATEMENT ROUTES
    // ============================================
    Route::post('statements', [StatementController::class, 'store'])
        ->middleware('throttle:10,60');  // 10 uploads per hour
    Route::get('statements', [StatementController::class, 'index']);
    Route::get('statements/insights', [StatementController::class, 'insights']);
    Route::delete('statements/data', [StatementController::class, 'destroy']);
    Route::get('statements/recommendations', [StatementController::class, 'recommendations'])
        ->middleware('throttle:30,1');
    Route::get('statements/savings-balance', [StatementController::class, 'savingsBalance']);
    Route::put('statements/savings-balance', [StatementController::class, 'updateSavingsBalance']);

    // ============================================
    // SIMULATIONS ROUTES
    // ============================================
    
    // Preview simulation without saving (available to all) - Must come before {id} route
    Route::post('simulations/preview', [SimulationController::class, 'preview']);
    
    // Get my simulation statistics (student only) - Must come before {id} route
    Route::get('simulations/my-statistics', [SimulationController::class, 'myStatistics']);
    
    // Create simulation (student only)
    Route::post('simulations', [SimulationController::class, 'store']);
    
    // Update simulation (student only)
    Route::put('simulations/{id}', [SimulationController::class, 'update']);
    Route::patch('simulations/{id}', [SimulationController::class, 'update']);
    
    // Delete simulation (student can delete own, admin can delete any)
    Route::delete('simulations/{id}', [SimulationController::class, 'destroy']);
    
    // Routes accessible by both students and admins (READ operations)
    Route::middleware('student.or.admin')->group(function () {
        // List simulations (filtered by role in controller)
        Route::get('simulations', [SimulationController::class, 'index']);
        
        // View specific simulation
        Route::get('simulations/{id}', [SimulationController::class, 'show']);
    });

    // ============================================
    // INVESTMENT SIMULATION ROUTES
    // ============================================

    // Get investment types/statistics (available to all authenticated users)
    Route::get('investments/types', [InvestmentSimulationController::class, 'getInvestmentTypes']);

    // Preview simulation without saving (available to all)
    Route::post('investments/preview', [InvestmentSimulationController::class, 'preview']);

    // Compare multiple investment scenarios
    Route::post('investments/compare', [InvestmentSimulationController::class, 'compare']);

    // Get my investment statistics (student only)
    Route::get('investments/my-statistics', [InvestmentSimulationController::class, 'myStatistics']);

    // Create investment simulation (student only)
    Route::post('investments', [InvestmentSimulationController::class, 'store']);

    // Delete investment simulation (student can delete own, admin can delete any)
    Route::delete('investments/{id}', [InvestmentSimulationController::class, 'destroy']);

    // Routes accessible by both students and admins (READ operations)
    Route::middleware('student.or.admin')->group(function () {
        // List simulations (filtered by role in controller)
        Route::get('investments', [InvestmentSimulationController::class, 'index']);
        
        // View specific simulation
        Route::get('investments/{id}', [InvestmentSimulationController::class, 'show']);
    });

    // ============================================
    // BADGES ROUTES
    // ============================================

    // Get badge criteria types - available to all
    Route::get('badges/criteria-types', [BadgeController::class, 'criteriaTypes']);

    // Student badge routes (must come before {id} routes)
    // My badges (student only)
    Route::get('badges/my-badges', [StudentBadgeController::class, 'myBadges']);
    // My badge progress (student only)
    Route::get('badges/my-progress', [StudentBadgeController::class, 'myBadgeProgress']);
    // Check and award my badges (student only)
    Route::post('badges/check-my-badges', [StudentBadgeController::class, 'checkMyBadges']);
    // Leaderboard (all users)
    Route::get('badges/leaderboard', [StudentBadgeController::class, 'leaderboard']);

    // Admin-only badge routes
    Route::middleware('admin')->group(function () {
        // Badge statistics
        Route::get('badges/statistics', [BadgeController::class, 'statistics']);
        // Create, update, delete badges
        Route::post('badges', [BadgeController::class, 'store']);
        Route::put('badges/{id}', [BadgeController::class, 'update']);
        Route::patch('badges/{id}', [BadgeController::class, 'update']);
        Route::delete('badges/{id}', [BadgeController::class, 'destroy']);
        // Manual badge award/removal
        Route::post('badges/award', [StudentBadgeController::class, 'awardBadge']);
        Route::post('badges/remove', [StudentBadgeController::class, 'removeBadge']);
        // Get students who earned a badge
        Route::get('badges/{id}/students', [StudentBadgeController::class, 'getBadgeStudents']);
    });

    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // List all badges
        Route::get('badges', [BadgeController::class, 'index']);
        // View specific badge
        Route::get('badges/{id}', [BadgeController::class, 'show']);
        // Get student's badges (filtered by permissions in controller)
        Route::get('students/{studentId}/badges', [StudentBadgeController::class, 'getStudentBadges']);
    });
});