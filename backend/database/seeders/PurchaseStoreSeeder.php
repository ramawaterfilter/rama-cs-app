<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PurchaseStore;

class PurchaseStoreSeeder extends Seeder
{
    public function run(): void
    {
        $stores = ['Amazon', 'Shopify', 'Walmart', 'e-Bay', 'Others'];
        foreach ($stores as $store) {
            PurchaseStore::firstOrCreate(['name' => $store]);
        }
    }
}
