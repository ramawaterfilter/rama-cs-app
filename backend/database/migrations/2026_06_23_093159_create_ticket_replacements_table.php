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
        Schema::create('ticket_replacements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('customer_tickets')->onDelete('cascade');
            $table->foreignId('le_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('ordered_product_name')->nullable();
            $table->string('ordered_product_sku')->nullable();
            $table->string('replacement_product_name')->nullable();
            $table->string('replacement_product_sku')->nullable();
            $table->integer('replacement_qty')->nullable();
            $table->string('replacement_reason')->nullable();
            $table->string('replacement_approved_by')->nullable();
            $table->string('others')->nullable();
            $table->string('status')->default('shipping pending'); // shipping pending, shipping in progress, shipping approved
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_replacements');
    }
};
