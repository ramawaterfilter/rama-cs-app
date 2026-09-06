<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('query_categories', function (Blueprint $table) {
            $table->foreignId('query_type_id')->nullable()->constrained('query_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('query_categories', function (Blueprint $table) {
            $table->dropForeign(['query_type_id']);
            $table->dropColumn('query_type_id');
        });
    }
};
