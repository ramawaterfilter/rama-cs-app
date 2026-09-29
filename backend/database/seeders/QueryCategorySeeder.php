<?php

namespace Database\Seeders;

use App\Models\QueryCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QueryCategorySeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing categories and relationships
        Schema::disableForeignKeyConstraints();

        try {
            DB::table('category_relationships')->truncate();
            QueryCategory::truncate();
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        $inquiry = QueryCategory::create(['name' => 'Inquiry']);
        $complaint = QueryCategory::create(['name' => 'Complaint']);

        $inquiryData = [
            ['Cancellation', 'Order Cancel', 'Cancel request'],
            ['Customer Info', 'Address', 'Address change'],
            ['Lab report', 'Filters/Cartridges/POSTreat', 'Requesting Lab report'],
            ['Chat Enquiry', 'Talk to a person', 'Talk to a person'],
            ['Subscription', 'Recurring subscription charges', 'Subscription Charges'],
            ['Limescale enquiry', 'Limescale in filter unit', 'Limescale sediment'],
            ['Shipping', 'Collection Point', 'Collection Point Address'],
            ['Product Description', 'Filter Unit/POSTreat/Cartridge/Accessories', 'Product Dimensions'],
            ['Product Availability', 'Stock Availability', 'In-stock/ Out of stock'],
            ['Return Instruction', 'Order Status', 'Return process'],
            ['Order Enquiry', 'Shipping Status', 'Tracking Details'],
            ['Product Price', 'Filter Unit', 'Cost per Product'],
            ['Filters/Cartridges', 'Defective Product', 'Product Replacement'],
            ['Cancellation', 'Order Cancellation', 'Refund Status'],
            ['Order Enquiry', 'Order Status', 'Return Tracking'],
            ['Product Purchase', 'Product Price', 'Purchase Link'],
            ['Customer Info', 'Address', 'Address confirmation'],
            ['Return Instruction', 'Order Status', 'Return'],
        ];

        $complaintData = [
            ['Brand Store', 'Subscription', 'Recurring Charges'],
            ['Brand Store', 'Discounts', 'Discounts Not Working'],
            ['MFGD Defect', 'Carbon Filters', 'Broken Cartridges'],
            ['Design Improvisation', 'Carbon Filters', 'TDS'],
            ['Shipping', 'Delay in Delivery', 'Out of stock'],
            ['Brand Store', 'Email Flow Issue', 'Incorrect Communication'],
            ['MFGD Defect', 'Filter System', 'Rusting issues'],
            ['Out of Stock', 'Filter System', 'Out of stock'],
            ['MFGD Defect', 'FlouRid Media', 'Torn Packaging'],
            ['Shipping', 'Out of Stock', 'Delay in delivery'],
            ['Packaging Defect', 'Filter System', 'Broken Seal'],
            ['Assembly', 'Fitment Issues', 'Tap'],
            ['Functionality', 'Carbon Filters', 'Slow Filtration'],
            ['Missing Parts', 'Tap', 'Tap Missing'],
            ['Brand Store', 'Return & Refunds', 'Refund'],
        ];

        $this->seedHierarchy($inquiry, $inquiryData);
        $this->seedHierarchy($complaint, $complaintData);
    }

    private function seedHierarchy($root, $data)
    {
        foreach ($data as $row) {
            $catName = $row[0];
            $subName = $row[1];
            $childName = $row[2];

            // Create or find Category (Level 1 under Root)
            $category = QueryCategory::firstOrCreate(['name' => $catName]);
            if (!$root->children()->where('child_id', $category->id)->exists()) {
                $root->children()->attach($category->id);
            }

            // Create or find Sub Category (Level 2 under Root)
            $subCategory = QueryCategory::firstOrCreate(['name' => $subName]);
            if (!$category->children()->where('child_id', $subCategory->id)->exists()) {
                $category->children()->attach($subCategory->id);
            }

            // Create or find Child Category (Level 3 under Root)
            $childCategory = QueryCategory::firstOrCreate(['name' => $childName]);
            if (!$subCategory->children()->where('child_id', $childCategory->id)->exists()) {
                $subCategory->children()->attach($childCategory->id);
            }
        }
    }
}
