<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Generate AI recommendations every hour
Schedule::command('ai:generate-recommendations')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

