<?php
 
namespace Database\Seeders;
 
use App\Models\CustomerOutreach;
use App\Models\PurchaseType;
use App\Models\Country;
use Illuminate\Database\Seeder;
 
class DynamicListSeeder extends Seeder
{
    public function run(): void
    {
        $outreaches = ['Existing Customer', 'New Customer'];
        foreach ($outreaches as $name) {
            CustomerOutreach::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
 
        $purchaseTypes = ['Pre Purchase', 'Post Purchase'];
        foreach ($purchaseTypes as $name) {
            PurchaseType::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
 
        $countries = ['India', 'United Arab Emirates', 'Saudi Arabia', 'Oman', 'Qatar', 'Kuwait', 'Bahrain'];
        foreach ($countries as $name) {
            Country::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
