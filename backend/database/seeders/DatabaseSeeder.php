<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@phoenix.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ]
        );

        User::firstOrCreate(
            ['email' => 'cse@phoenix.com'],
            [
                'name' => 'Service Executive One',
                'password' => Hash::make('password'),
                'role' => 'cse',
            ]
        );
        
        \App\Models\QueryStatus::firstOrCreate(['name' => 'Open'], ['color' => '#2563eb', 'is_default' => false]);
        \App\Models\QueryStatus::firstOrCreate(['name' => 'Closed'], ['color' => '#10b981', 'is_default' => false]);
        \App\Models\QueryStatus::firstOrCreate(['name' => 'Pending Review'], ['color' => '#f59e0b', 'is_default' => true]);
        \App\Models\QueryStatus::firstOrCreate(['name' => 'Checking Internally'], ['color' => '#8b5cf6', 'is_default' => false]);

        $this->call([
            QueryChannelTypeSeeder::class,
            QueryCategorySeeder::class,
            TicketSeeder::class,
        ]);
    }
}
