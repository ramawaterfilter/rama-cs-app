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
        Schema::create('category_relationships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->constrained('query_categories')->cascadeOnDelete();
            $table->foreignId('child_id')->constrained('query_categories')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('category_relationships');
    }
};
