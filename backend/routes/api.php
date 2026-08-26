<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomerTicketController;
use App\Http\Controllers\QueryCategoryController;
use App\Http\Controllers\QueryStatusController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ProductController;

use App\Http\Controllers\ReportController;

// ─── Public ────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/password-reset-request', [\App\Http\Controllers\UserProfileRequestController::class, 'store']);
Route::get('/categories/public', [QueryCategoryController::class, 'indexPublic']);

Route::get('/query-channels/public', [\App\Http\Controllers\QueryChannelController::class, 'index']);
Route::get('/query-types/public', [\App\Http\Controllers\QueryTypeController::class, 'index']);
Route::get('/query-filters/public', [\App\Http\Controllers\QueryFilterController::class, 'index']);
Route::get('/customer-outreaches/public', [\App\Http\Controllers\CustomerOutreachController::class, 'index']);

Route::get('/purchase-stores/public', [\App\Http\Controllers\PurchaseStoreController::class, 'index']);
Route::get('/countries/public', [\App\Http\Controllers\CountryController::class, 'index']);
Route::get('/statuses/public', [QueryStatusController::class, 'index']); // Make statuses public too for the form

Route::get('/run-migration', function () {
    try {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        return "Migration & Seeding successful: " . \Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        return "Error: " . $e->getMessage();
    }
});

Route::get('/clear-cache', function() {
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    return 'Cache cleared';
});

// ─── Protected (Sanctum) ───────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/reports/admin-stats', [ReportController::class, 'adminStats']);
    Route::get('/reports/le-stats', [ReportController::class, 'leStats']);

    // Auth / Profile
    Route::get('/user', [AuthController::class, 'profile']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Users (Admin)
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::get('/cse-list', [UserController::class, 'cseList']);
    Route::get('/le-list', [UserController::class, 'leList']);
    
    // Password Reset Requests
    Route::apiResource('password-reset-requests', \App\Http\Controllers\UserProfileRequestController::class)->only(['index', 'update']);

    // Categories
    Route::apiResource('categories', QueryCategoryController::class);

    // Statuses
    Route::apiResource('statuses', QueryStatusController::class);

    // Logistics Approval
    Route::put('/tickets/{ticket}/approve-logistics', [CustomerTicketController::class, 'approveLogistics']);
    Route::put('/tickets/{ticket}/reject-logistics', [CustomerTicketController::class, 'rejectLogistics']);

    // Products
    Route::apiResource('products', ProductController::class);

    // Logistics
    Route::get('/logistics', [\App\Http\Controllers\LogisticsController::class, 'index']);
    Route::put('/logistics/replacements/{id}', [\App\Http\Controllers\LogisticsController::class, 'updateReplacement']);
    Route::put('/logistics/returns/{id}', [\App\Http\Controllers\LogisticsController::class, 'updateReturn']);

    // Tickets
    Route::apiResource('tickets', CustomerTicketController::class);
    Route::post('/tickets/public', [CustomerTicketController::class, 'storePublic']);
    Route::post('/tickets/{ticket}/claim', [CustomerTicketController::class, 'claim']);
    Route::post('/tickets/{ticket}/allocate', [CustomerTicketController::class, 'allocate']);
    Route::post('/tickets/{ticket}/request-edit', [CustomerTicketController::class, 'requestEdit']);
    Route::post('/tickets/{ticket}/approve-edit', [CustomerTicketController::class, 'approveEdit']);
    Route::post('/tickets/{ticket}/request-profile-edit', [CustomerTicketController::class, 'requestProfileEdit']);
    Route::post('/tickets/{ticket}/approve-profile-edit', [CustomerTicketController::class, 'approveProfileEdit']);

    // Query Channels & Types
    Route::apiResource('query-channels', \App\Http\Controllers\QueryChannelController::class);
    Route::apiResource('query-types', \App\Http\Controllers\QueryTypeController::class);
    Route::apiResource('query-filters', \App\Http\Controllers\QueryFilterController::class);
    Route::apiResource('customer-outreaches', \App\Http\Controllers\CustomerOutreachController::class);

    Route::apiResource('purchase-stores', \App\Http\Controllers\PurchaseStoreController::class);
    Route::apiResource('countries', \App\Http\Controllers\CountryController::class);

    // User Activities & Analytics
    Route::get('/user-activities', [\App\Http\Controllers\UserActivityController::class, 'index']);
    Route::get('/user-activities/analytics', [\App\Http\Controllers\UserActivityController::class, 'analytics']);
});
