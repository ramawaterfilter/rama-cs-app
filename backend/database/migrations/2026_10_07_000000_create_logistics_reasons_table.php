<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('logistics_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('reason');
            $table->enum('type', ['return', 'replacement']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['reason', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_reasons');
    }
};
