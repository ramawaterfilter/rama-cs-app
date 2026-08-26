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
        Schema::create('ticket_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('customer_tickets')->onDelete('cascade');
            $table->foreignId('le_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('marketplace_channel')->nullable();
            $table->foreignId('country_id')->nullable()->constrained('countries')->onDelete('set null');
            $table->string('ordered_product_name')->nullable();
            $table->string('ordered_product_sku')->nullable();
            $table->string('return_reasons')->nullable();
            $table->date('return_date')->nullable();
            $table->string('courier_name')->nullable();
            $table->string('tracking_id')->nullable();
            $table->integer('no_of_boxes')->nullable();
            $table->string('inbound_ref_no')->nullable();
            $table->date('inbound_ref_date')->nullable();
            $table->string('status')->default('shipping pending');
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_returns');
    }
};
