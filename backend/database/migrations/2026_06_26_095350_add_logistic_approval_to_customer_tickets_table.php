<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->boolean('is_logistic_approved')->default(false)->after('edit_approved');
            $table->boolean('is_logistic_rejected')->default(false)->after('is_logistic_approved');
            $table->text('logistic_rejection_reason')->nullable()->after('is_logistic_rejected');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropColumn(['is_logistic_approved', 'is_logistic_rejected', 'logistic_rejection_reason']);
        });
    }
};
