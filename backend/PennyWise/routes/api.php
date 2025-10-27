<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\StudentProfileController;
use App\Http\Controllers\FinancialDataController;
use App\Http\Controllers\GoalController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\RecommendationController;

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

    // Get my profile (student only) - Must come before {id} route
    Route::get('student-profiles/me', [StudentProfileController::class, 'myProfile']);

    // Admin can view all profiles
    Route::middleware('admin')->group(function () {
        Route::get('student-profiles', [StudentProfileController::class, 'index']);
    });

    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // Create profile
        Route::post(  'student-profiles',      [StudentProfileController::class, 'store']);

        // View, update, and delete specific profile
        Route::get(   'student-profiles/{id}', [StudentProfileController::class, 'show']);
        Route::put(   'student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::patch( 'student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::delete('student-profiles/{id}', [StudentProfileController::class, 'destroy']);
    });

    // ============================================
    // FINANCIAL DATA ROUTES
    // ============================================

    // Get metadata (entry types and categories)
    Route::get('financial-data/metadata', [FinancialDataController::class, 'metadata']);

    // Get my financial summary (student only)
    Route::get('financial-data/my-summary', [FinancialDataController::class, 'mySummary']);

    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // List entries (filtered by role in controller)
        Route::get(   'financial-data',      [FinancialDataController::class, 'index']);

        // View, update, and delete specific entry
        Route::get(   'financial-data/{id}', [FinancialDataController::class, 'show']);
        Route::put(   'financial-data/{id}', [FinancialDataController::class, 'update']);
        Route::patch( 'financial-data/{id}', [FinancialDataController::class, 'update']);
        Route::delete('financial-data/{id}', [FinancialDataController::class, 'destroy']);
    });

    // Create entry (student only)
    Route::post('financial-data', [FinancialDataController::class, 'store']);

     // ============================================
    // GOALS ROUTES
    // ============================================
    
    // Get my goals summary (student only) - Must come before {id} route
    Route::get('goals/my-summary', [GoalController::class, 'mySummary']);
    
    // Add progress to a goal (student only) - Must come before general routes
    Route::post('goals/{id}/add-progress', [GoalController::class, 'addProgress']);
    
    // Create goal (student only)
    Route::post('goals', [GoalController::class, 'store']);
    
    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        // List goals (filtered by role in controller)
        Route::get('goals', [GoalController::class, 'index']);
        
        // View specific goal
        Route::get('goals/{id}', [GoalController::class, 'show']);
    });
    
    // Update and delete (student only, checked in controller)
    Route::put('goals/{id}', [GoalController::class, 'update']);
    Route::patch('goals/{id}', [GoalController::class, 'update']);
    Route::delete('goals/{id}', [GoalController::class, 'destroy']);

    // ============================================
    // BUDGETS ROUTES
    // ============================================
    
    // Get budget categories - available to all
    Route::get('budgets/categories', [BudgetController::class, 'categories']);
    
    // Get my budget summary (student only) - Must come before {id} route
    Route::get('budgets/my-summary', [BudgetController::class, 'mySummary']);
    
    // Create budget (student only)
    Route::post('budgets', [BudgetController::class, 'store']);
    
    // Update budget (student only)
    Route::put('budgets/{id}', [BudgetController::class, 'update']);
    Route::patch('budgets/{id}', [BudgetController::class, 'update']);
    
    // Delete budget (student only)
    Route::delete('budgets/{id}', [BudgetController::class, 'destroy']);
    
    // Routes accessible by both students and admins (READ operations)
    Route::middleware('student.or.admin')->group(function () {
        // List budgets (filtered by role in controller)
        Route::get('budgets', [BudgetController::class, 'index']);
        
        // View specific budget
        Route::get('budgets/{id}', [BudgetController::class, 'show']);
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
});