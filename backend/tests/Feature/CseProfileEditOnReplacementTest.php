<?php

namespace Tests\Feature;

use App\Models\QueryStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CseProfileEditOnReplacementTest extends TestCase
{
    use RefreshDatabase;

    private QueryStatus $open;
    private User $admin;
    private User $cse;
    private User $le;

    protected function setUp(): void
    {
        parent::setUp();
        $this->open = QueryStatus::create(['name' => 'Open', 'color' => '#111', 'type' => 'general']);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'a@example.com', 'password' => 'secret', 'role' => 'admin']);
        $this->cse = User::create(['name' => 'CSE One', 'email' => 'cse@example.com', 'password' => 'secret', 'role' => 'cse']);
        $this->le = User::create(['name' => 'LE One', 'email' => 'le@example.com', 'password' => 'secret', 'role' => 'le']);
    }

    private function newTicket(): int
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/tickets/public', ['status_id' => $this->open->id])
            ->assertStatus(201)
            ->json('ticket.id');
    }

    public function test_cse_still_needs_profile_approval_outside_a_logistics_request(): void
    {
        $id = $this->newTicket();

        $this->actingAs($this->cse, 'sanctum')
            ->putJson("/api/tickets/{$id}", ['address' => 'Should not land', 'customer_name' => 'Nope'])
            ->assertStatus(403);

        $ticket = \App\Models\CustomerTicket::findOrFail($id);
        $this->assertNull($ticket->address, 'unapproved profile edits must not be persisted');
        $this->assertNull($ticket->customer_name, 'unapproved profile edits must not be persisted');
    }

    public function test_cse_can_update_address_and_contact_with_a_replacement_request(): void
    {
        $id = $this->newTicket();

        $this->actingAs($this->cse, 'sanctum')
            ->putJson("/api/tickets/{$id}", [
                'customer_name' => 'Karan Deshmukh',
                'customer_phone' => '+91 99009 88776',
                'customer_email' => 'karan.d@example.com',
                'address' => '12 MG Road, Bengaluru',
                'logistics_type' => 'replacement',
                'replacement_form' => [
                    'le_id' => $this->le->id,
                    'ordered_product_name' => 'Filter',
                    'replacement_product_name' => 'Filter v2',
                    'replacement_qty' => 1,
                ],
            ])
            ->assertOk();

        $ticket = \App\Models\CustomerTicket::with('replacement')->findOrFail($id);
        $this->assertSame('Karan Deshmukh', $ticket->customer_name);
        $this->assertSame('12 MG Road, Bengaluru', $ticket->address);
        $this->assertSame('+91 99009 88776', $ticket->customer_phone);
        $this->assertNotNull($ticket->replacement);
        $this->assertSame($this->le->id, (int) $ticket->replacement->le_id);
    }
}
