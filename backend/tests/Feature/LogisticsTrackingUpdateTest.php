<?php

namespace Tests\Feature;

use App\Models\QueryStatus;
use App\Models\TicketReturn;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogisticsTrackingUpdateTest extends TestCase
{
    use RefreshDatabase;

    private QueryStatus $open;
    private User $admin;
    private User $le;
    private User $otherLe;
    private int $ticketId;
    private TicketReturn $return;

    protected function setUp(): void
    {
        parent::setUp();
        $this->open = QueryStatus::create(['name' => 'Open', 'color' => '#111', 'type' => 'general']);
        $this->admin = User::create(['name' => 'Admin', 'email' => 'a@example.com', 'password' => 'secret', 'role' => 'admin']);
        $this->le = User::create(['name' => 'LE One', 'email' => 'le@example.com', 'password' => 'secret', 'role' => 'le']);
        $this->otherLe = User::create(['name' => 'LE Two', 'email' => 'le2@example.com', 'password' => 'secret', 'role' => 'le']);

        $this->ticketId = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/tickets/public', ['status_id' => $this->open->id])
            ->assertStatus(201)
            ->json('ticket.id');

        $this->return = TicketReturn::create([
            'ticket_id' => $this->ticketId,
            'le_id' => $this->le->id,
            'tracking_id' => 'OLD-123',
            'status' => 'shipping pending',
        ]);
    }

    public function test_le_can_update_tracking_id_on_own_return(): void
    {
        $this->actingAs($this->le, 'sanctum')
            ->putJson("/api/logistics/returns/{$this->return->id}", [
                'status' => 'shipping pending',
                'remarks' => 'Dropped at hub',
                'tracking_id' => 'NEW-456',
            ])
            ->assertOk();

        $this->assertSame('NEW-456', $this->return->fresh()->tracking_id);
        $this->assertSame('Dropped at hub', $this->return->fresh()->remarks);
    }

    public function test_le_cannot_update_tracking_id_on_someone_elses_return(): void
    {
        $this->actingAs($this->otherLe, 'sanctum')
            ->putJson("/api/logistics/returns/{$this->return->id}", ['tracking_id' => 'HIJACKED'])
            ->assertStatus(403);

        $this->assertSame('OLD-123', $this->return->fresh()->tracking_id);
    }

    public function test_admin_can_update_tracking_id(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/logistics/returns/{$this->return->id}", ['tracking_id' => 'ADMIN-789'])
            ->assertOk();

        $this->assertSame('ADMIN-789', $this->return->fresh()->tracking_id);
    }
}
