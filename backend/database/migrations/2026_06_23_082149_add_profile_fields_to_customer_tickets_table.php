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
            $table->foreignId('state_id')->nullable()->constrained()->nullOnDelete();
            $table->text('address')->nullable();
            $table->boolean('profile_edit_requested')->default(false);
            $table->boolean('profile_edit_approved')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropForeign(['state_id']);
            $table->dropColumn(['state_id', 'address', 'profile_edit_requested', 'profile_edit_approved']);
        });
    }
};
