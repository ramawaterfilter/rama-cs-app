<?php

namespace Database\Seeders;

use App\Models\QueryChannel;
use App\Models\QueryType;
use Illuminate\Database\Seeder;

class QueryChannelTypeSeeder extends Seeder
{
    public function run(): void
    {
        $channels = ['Email', 'Call', 'Chat'];
        foreach ($channels as $name) {
            QueryChannel::firstOrCreate(['name' => $name], ['is_active' => true]);
        }

        $types = ['Inquiry', 'Complaint'];
        foreach ($types as $name) {
            QueryType::firstOrCreate(['name' => $name], ['is_active' => true]);
        }

        $filters = ['6 Liters', '8 Liters', '12 Liters'];
        foreach ($filters as $name) {
            \App\Models\QueryFilter::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
