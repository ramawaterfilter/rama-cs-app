<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DeploymentSafetyTest extends TestCase
{
    public function test_database_maintenance_is_not_exposed_as_a_web_route(): void
    {
        $uris = collect(Route::getRoutes())->map(fn ($route) => $route->uri())->all();

        $this->assertNotContains('api/run-migration', $uris);
        $this->assertNotContains('api/clear-cache', $uris);
    }
}
