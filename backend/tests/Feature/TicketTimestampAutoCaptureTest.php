<?php

namespace Tests\Feature;

use App\Models\CustomerTicket;
use App\Models\QueryStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TicketTimestampAutoCaptureTest extends TestCase
{
    use RefreshDatabase;

    private QueryStatus $open;
    private QueryStatus $closed;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->open = QueryStatus::create(['name' => 'Open', 'color' => '#111', 'type' => 'general']);
        $this->closed = QueryStatus::create(['name' => 'Closed', 'color' => '#111', 'type' => 'general']);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'a@example.com', 'password' => 'secret', 'role' => 'admin']);
    }

    public function test_public_create_defaults_received_and_stamps_resolved_when_closed(): void
    {
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/tickets/public', ['status_id' => $this->closed->id])
            ->assertStatus(201);

        $ticket = CustomerTicket::first();
        $this->assertNotNull($ticket->received_at);
        $this->assertNotNull($ticket->resolved_at);
    }

    public function test_open_ticket_gets_received_but_no_resolved(): void
    {
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/tickets/public', ['status_id' => $this->open->id])
            ->assertStatus(201);

        $ticket = CustomerTicket::first();
        $this->assertNotNull($ticket->received_at);
        $this->assertNull($ticket->resolved_at);
    }

    public function test_closing_stamps_resolved_reopening_clears_and_resave_keeps_stamp(): void
    {
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/tickets/public', ['status_id' => $this->open->id])
            ->assertStatus(201);
        $ticket = CustomerTicket::first();

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/tickets/{$ticket->id}", ['status_id' => $this->closed->id])
            ->assertOk();
        $ticket->refresh();
        $this->assertNotNull($ticket->resolved_at);

        $stamp = $ticket->resolved_at;
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/tickets/{$ticket->id}", ['status_id' => $this->closed->id, 'description' => 'still closed'])
            ->assertOk();
        $ticket->refresh();
        $this->assertTrue($ticket->resolved_at->equalTo($stamp), 're-saving a closed ticket must not move resolved_at');

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/tickets/{$ticket->id}", ['status_id' => $this->open->id])
            ->assertOk();
        $this->assertNull($ticket->refresh()->resolved_at, 'reopening must clear resolved_at');
    }

    public function test_manual_resolved_value_is_preserved(): void
    {
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/tickets/public', ['status_id' => $this->open->id])
            ->assertStatus(201);
        $ticket = CustomerTicket::first();

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/tickets/{$ticket->id}", [
                'status_id' => $this->closed->id,
                'resolved_at' => '2026-01-02T03:04',
            ])
            ->assertOk();

        $this->assertSame('2026-01-02 03:04:00', $ticket->refresh()->resolved_at->format('Y-m-d H:i:s'));
    }
}
