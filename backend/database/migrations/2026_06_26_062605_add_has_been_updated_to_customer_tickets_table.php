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
            $table->boolean('has_been_updated')->default(false)->after('edit_approved');
        });
    }

    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropColumn('has_been_updated');
        });
    }
};
