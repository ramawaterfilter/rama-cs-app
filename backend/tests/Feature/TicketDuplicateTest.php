<?php

namespace Tests\Feature;

use App\Models\CustomerTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketDuplicateTest extends TestCase
{
    use RefreshDatabase;

    private function openTicket(array $overrides = []): CustomerTicket
    {
        return CustomerTicket::create(array_merge([
            'customer_name' => 'Rama',
            'customer_email' => 'john@example.com',
            'customer_phone' => '9999999999',
        ], $overrides));
    }

    private function postNew(array $overrides = [])
    {
        return $this->postJson('/api/tickets/public', array_merge([
            'customer_name' => 'Someone Else',
            'customer_email' => 'new@example.com',
            'customer_phone' => '1111111111',
        ], $overrides));
    }

    public function test_blocks_open_ticket_with_same_email_case_insensitive_and_trimmed(): void
    {
        $this->openTicket();
        Sanctum::actingAs(User::factory()->create());

        $this->postNew(['customer_email' => '  JOHN@EXAMPLE.COM '])->assertStatus(409);

        $this->assertSame(1, CustomerTicket::count());
    }

    public function test_blocks_open_ticket_with_same_phone(): void
    {
        $this->openTicket();
        Sanctum::actingAs(User::factory()->create());

        $this->postNew([
            'customer_email' => 'other@example.com',
            'customer_phone' => '9999999999',
        ])->assertStatus(409);
    }

    public function test_reports_existing_ticket_id(): void
    {
        $ticket = $this->openTicket();
        Sanctum::actingAs(User::factory()->create());

        $this->postNew(['customer_email' => 'john@example.com'])
            ->assertStatus(409)
            ->assertJsonPath('existing_ticket_id', $ticket->id);
    }

    public function test_allows_new_ticket_once_previous_is_resolved(): void
    {
        $this->openTicket(['resolved_at' => now()]);
        Sanctum::actingAs(User::factory()->create());

        $this->postNew(['customer_email' => 'john@example.com'])->assertStatus(201);
    }

    public function test_allows_unrelated_customer(): void
    {
        $this->openTicket();
        Sanctum::actingAs(User::factory()->create());

        $this->postNew()->assertStatus(201);
    }
}
