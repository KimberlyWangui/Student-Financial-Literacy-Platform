#!/bin/sh
set -e

# Render tells us which port to listen on in $PORT
PORT="${PORT:-10000}"
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Register installed packages (skipped during the build because no .env exists there)
php artisan package:discover --ansi || true

exec apache2-foreground
