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
        Schema::create('customer_tickets', function (Blueprint $table) {
            $table->id();
            $table->timestamp('received_at')->useCurrent();
            $table->string('customer_name')->nullable();
            $table->string('mobile_number')->nullable();
            $table->string('email_id')->nullable();
            $table->string('country')->nullable();
            $table->string('type_of_query')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('query_categories')->nullOnDelete();
            $table->text('description')->nullable();
            $table->string('actual_question')->nullable();
            $table->string('order_id')->nullable();
            $table->foreignId('status_id')->nullable()->constrained('query_statuses')->nullOnDelete();
            $table->foreignId('executive_id')->nullable()->constrained('users')->nullOnDelete(); // Assigned to
            $table->text('remarks')->nullable(); // From CSE
            $table->boolean('is_allocated')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_tickets');
    }
};
