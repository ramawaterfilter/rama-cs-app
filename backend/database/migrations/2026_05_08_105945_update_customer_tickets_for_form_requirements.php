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
            $table->string('agent_name')->nullable()->after('id');
            $table->string('purchase_store')->nullable()->after('customer_name');
            $table->string('customer_email')->nullable()->after('purchase_store');
            $table->string('customer_phone')->nullable()->after('customer_email');
            $table->string('query_source')->nullable()->after('country'); // Email, Call, Chat
            // type_of_query already exists, we will use it for Inquiry/Complaint
            
            $table->foreignId('sub_category_id')->nullable()->after('category_id')->constrained('query_categories')->nullOnDelete();
            $table->foreignId('child_category_id')->nullable()->after('sub_category_id')->constrained('query_categories')->nullOnDelete();
            
            $table->text('action_taken')->nullable()->after('description');
            $table->timestamp('resolved_at')->nullable()->after('received_at');
            $table->string('customer_outreach')->nullable()->after('resolved_at'); // Existing, New
            
            $table->string('purchase_type')->nullable(); // Pre, Post
            $table->string('filters')->nullable(); // 6, 8, 12 Liters
            $table->string('agent_email')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropColumn([
                'agent_name',
                'purchase_store',
                'customer_email',
                'customer_phone',
                'query_source',
                'sub_category_id',
                'child_category_id',
                'action_taken',
                'resolved_at',
                'customer_outreach',
                'purchase_type',
                'filters',
                'agent_email'
            ]);
        });
    }
};
