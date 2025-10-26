<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\StudentProfileController;

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword']);
Route::post('/reset-password', [PasswordResetController::class, 'reset']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/resend-otp', [AuthController::class, 'resendOtp']);

// Google OAuth routes
Route::get('/auth/google', [GoogleAuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [GoogleAuthController::class, 'handleGoogleCallback']);

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

Route::middleware('auth:sanctum')->group(function () {
    
    // Get authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    
    // Authentication routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/enable-2fa', [AuthController::class, 'enable2FA']);
    Route::post('/disable-2fa', [AuthController::class, 'disable2FA']);

    // ============================================
    // USER MANAGEMENT ROUTES
    // ============================================
    
    // Routes accessible by both students and admins
    Route::middleware('student.or.admin')->group(function () {
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::put('users/{id}', [UserController::class, 'update']);
        Route::patch('users/{id}', [UserController::class, 'update']);
    });

    // Routes accessible by admins only
    Route::middleware('admin')->group(function () {
        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::delete('users/{id}', [UserController::class, 'destroy']);
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
        Route::post('student-profiles', [StudentProfileController::class, 'store']);
        
        // View, update, and delete specific profile
        Route::get('student-profiles/{id}', [StudentProfileController::class, 'show']);
        Route::put('student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::patch('student-profiles/{id}', [StudentProfileController::class, 'update']);
        Route::delete('student-profiles/{id}', [StudentProfileController::class, 'destroy']);
    });
});