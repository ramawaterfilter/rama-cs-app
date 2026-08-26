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
            $table->softDeletes();
            $table->boolean('edit_requested')->default(false);
            $table->boolean('edit_approved')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['edit_requested', 'edit_approved']);
        });
    }
};
