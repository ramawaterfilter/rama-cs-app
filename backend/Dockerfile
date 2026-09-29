FROM php:8.3-cli

  COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

  RUN apt-get update \
      && apt-get install -y libsqlite3-dev libzip-dev unzip \
      && docker-php-ext-install pdo_sqlite zip \
      && rm -rf /var/lib/apt/lists/*

  WORKDIR /var/www/html

  COPY composer.json composer.lock ./

  RUN composer install \
      --no-dev \
      --no-interaction \
      --no-scripts \
      --prefer-dist

  COPY . .

  RUN composer dump-autoload --optimize

  EXPOSE 8000

  CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]