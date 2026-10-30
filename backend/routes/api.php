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

// ─── Protected (Sanctum) ───────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/reports/admin-stats', [ReportController::class, 'adminStats']);
    Route::get('/reports/le-stats', [ReportController::class, 'leStats']);

    Route::get('/notifications/summary', [\App\Http\Controllers\NotificationController::class, 'getSummary']);

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
    Route::get('/categories/bulk-template', [\App\Http\Controllers\CategoryBulkController::class, 'template']);
    Route::post('/categories/bulk', [\App\Http\Controllers\CategoryBulkController::class, 'upload']);
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
    Route::apiResource('logistics-reasons', \App\Http\Controllers\LogisticsReasonController::class)
        ->parameters(['logistics-reasons' => 'logisticsReason']);

    // User Activities & Analytics
    Route::get('/user-activities', [\App\Http\Controllers\UserActivityController::class, 'index']);
    Route::get('/user-activities/analytics', [\App\Http\Controllers\UserActivityController::class, 'analytics']);
});
