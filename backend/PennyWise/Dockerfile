# PennyWise Laravel API, built for Render (free web service).
# Stage 1: install PHP packages (production only)
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --prefer-dist --ignore-platform-reqs

# Stage 2: the web server
FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql bcmath opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# Serve Laravel's public/ folder and honour its .htaccess
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && printf '<Directory ${APACHE_DOCUMENT_ROOT}>\n    AllowOverride All\n    Require all granted\n</Directory>\n' > /etc/apache2/conf-available/laravel.conf \
    && a2enconf laravel

WORKDIR /var/www/html
COPY . .
COPY --from=vendor /app/vendor ./vendor

# Folders Laravel writes to
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Start script (strip Windows line endings in case they slipped in)
COPY docker/start.sh /usr/local/bin/start.sh
RUN sed -i 's/\r$//' /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

EXPOSE 10000
CMD ["start.sh"]
