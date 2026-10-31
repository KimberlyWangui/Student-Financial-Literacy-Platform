<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class GoogleExchangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_valid_code_gives_a_token_only_once(): void
    {
        $user = User::factory()->create(['role' => 'student']);
        Cache::put('google_login:abc123', $user->id, 60);

        $this->postJson('/api/auth/google/exchange', ['code' => 'abc123'])
            ->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure(['token']);

        $this->postJson('/api/auth/google/exchange', ['code' => 'abc123'])->assertStatus(422);
    }

    public function test_an_unknown_code_is_refused(): void
    {
        $this->postJson('/api/auth/google/exchange', ['code' => 'nope'])->assertStatus(422);
    }
}