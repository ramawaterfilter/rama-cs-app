<?php
 
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
 
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->foreignId('customer_outreach_id')->nullable()->constrained('customer_outreaches')->nullOnDelete();
            $table->foreignId('purchase_type_id')->nullable()->constrained('purchase_types')->nullOnDelete();
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
        });
    }
 
    public function down(): void
    {
        Schema::table('customer_tickets', function (Blueprint $table) {
            $table->dropForeign(['customer_outreach_id']);
            $table->dropForeign(['purchase_type_id']);
            $table->dropForeign(['country_id']);
            $table->dropColumn(['customer_outreach_id', 'purchase_type_id', 'country_id']);
        });
    }
};
