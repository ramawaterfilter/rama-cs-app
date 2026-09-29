<?php

namespace Database\Seeders;

use App\Models\CustomerTicket;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TicketSeeder extends Seeder
{
    public function run(): void
    {
        $statuses = DB::table('query_statuses')->pluck('id')->all();
        $channels = DB::table('query_channels')->pluck('id')->all();
        $types = DB::table('query_types')->pluck('id')->all();
        $filters = DB::table('query_filters')->pluck('id')->all();
        $executives = User::whereIn('role', ['cse', 'admin'])->pluck('id')->all();

        $triples = $this->categoryTriples();

        $customers = [
            ['Amit Verma', 'amit.verma@example.com', '+91 98765 43210'],
            ['Priya Nair', 'priya.nair@example.com', '+91 91234 56789'],
            ['Rahul Mehta', 'rahul.mehta@example.com', '+91 99887 76655'],
            ['Sneha Iyer', 'sneha.iyer@example.com', '+91 90011 22334'],
            ['Vikram Singh', 'vikram.singh@example.com', '+91 97654 32109'],
            ['Anjali Rao', 'anjali.rao@example.com', '+91 98111 22446'],
            ['Karan Deshmukh', 'karan.d@example.com', '+91 99009 88776'],
            ['Meera Joshi', 'meera.joshi@example.com', '+91 94455 11223'],
            ['Arjun Patel', 'arjun.patel@example.com', '+91 93322 55667'],
            ['Divya Menon', 'divya.menon@example.com', '+91 96677 88990'],
        ];

        $descriptions = [
            'Product stopped working after two weeks of purchase.',
            'Delivery was delayed and the box arrived damaged.',
            'Need help understanding the warranty coverage.',
            'Filter replacement reminder never received.',
            'Refund has not been credited to my account.',
            'Installation was scheduled but nobody showed up.',
            'Water flow has reduced significantly since installation.',
            'Received the wrong item in my order.',
            'Charged twice for the same subscription renewal.',
            'App is not syncing with the device anymore.',
            'Requesting a copy of the purchase invoice.',
            'Customer wants to change the delivery address.',
        ];

        $actions = [
            null,
            'Asked customer for the invoice copy.',
            'Escalated to the logistics team.',
            'Replacement part shipped.',
            'Refund initiated.',
            'Call back scheduled.',
        ];

        $remarks = [
            null,
            'Customer called twice.',
            'Awaiting engineer visit slot.',
            'Follow up after 48 hours.',
        ];

        $sources = ['Email', 'Call', 'Chat', 'Website Form'];

        foreach (range(1, 425) as $i) {
            $orderId = 'ORD-992' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            if (CustomerTicket::where('order_id', $orderId)->exists()) {
                continue;
            }

            $customer = $customers[$i % count($customers)];
            $triple = $triples[$i % count($triples)];
            $closed = $i % 5 === 0;
            $allocated = $i % 4 !== 0;
            $received = now()->subDays(rand(0, 13))->subHours(rand(0, 20));

            CustomerTicket::create([
                'order_id' => $orderId,
                'received_at' => $received,
                'resolved_at' => $closed ? $received->copy()->addDays(rand(1, 3)) : null,
                'created_at' => $received,
                'customer_name' => $customer[0],
                'customer_email' => $customer[1],
                'email_id' => $customer[1],
                'customer_phone' => $customer[2],
                'mobile_number' => $customer[2],
                'country' => 'India',
                'description' => $descriptions[$i % count($descriptions)],
                'actual_question' => $descriptions[$i % count($descriptions)],
                'action_taken' => $actions[$i % count($actions)],
                'remarks' => $remarks[$i % count($remarks)],
                'query_source' => $sources[$i % count($sources)],
                'agent_name' => 'Super Admin',
                'agent_email' => 'admin@phoenix.com',
                'purchase_store' => ['Amazon.in', 'Flipkart', 'Brand Website'][$i % 3],

                'category_id' => $triple[0],
                'sub_category_id' => $triple[1],
                'child_category_id' => $triple[2],
                'status_id' => $closed ? 2 : ($i % 3 === 0 ? 4 : $statuses[$i % count($statuses)]),
                'executive_id' => $allocated ? $executives[$i % count($executives)] : null,
                'is_allocated' => $allocated,
                'query_channel_id' => $channels[$i % count($channels)],
                'query_type_id' => $types[$i % count($types)],
                'query_filter_id' => $filters[$i % count($filters)],

                'edit_requested' => $i % 6 === 0,
                'edit_approved' => false,
                'profile_edit_requested' => false,
                'profile_edit_approved' => false,
                'has_been_updated' => false,
            ]);
        }
    }

    /**
     * Real category/sub-category/child-category id triples, read from
     * category_relationships so the grid shows a sensible hierarchy.
     */
    private function categoryTriples(): array
    {
        $children = [];
        foreach (DB::table('category_relationships')->get() as $rel) {
            $children[$rel->parent_id][] = $rel->child_id;
        }

        // roots = nodes that are a parent but never a child
        $parents = array_keys($children);
        $childIds = [];
        foreach ($children as $ids) {
            $childIds = array_merge($childIds, $ids);
        }
        $roots = array_diff($parents, $childIds);

        $triples = [];
        foreach ($roots as $root) {
            foreach ($children[$root] ?? [] as $category) {
                foreach ($children[$category] ?? [] as $sub) {
                    foreach ($children[$sub] ?? [] as $child) {
                        $triples[] = [$category, $sub, $child];
                    }
                }
            }
        }

        return $triples;
    }
}
