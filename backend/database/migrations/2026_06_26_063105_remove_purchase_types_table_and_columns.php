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
            if (Schema::hasColumn('customer_tickets', 'purchase_type_id')) {
                $table->dropForeign(['purchase_type_id']);
                $table->dropColumn('purchase_type_id');
            }
        });

        Schema::dropIfExists('purchase_types');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('purchase_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->foreignId('purchase_type_id')->nullable()->constrained('purchase_types')->nullOnDelete();
        });
    }
};
