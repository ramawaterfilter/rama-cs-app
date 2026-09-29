# Hostinger Deployment Guide

This guide deploys the Angular frontend and Laravel API on one Hostinger domain.

## Architecture (ng-Ukz6FjLDIRu58wNTPVtkCgoaxrOoAwUM)

The repository contains two applications:

- `frontend/` — Angular application
- `backend/` — Laravel API

For production, Angular is compiled into static HTML, CSS, and JavaScript files. Those generated files are copied into `backend/public/`. Laravel then:

- serves the Angular application for browser routes such as `/`, `/login`, and `/dashboard`;
- serves API requests under `/api`;
- connects to the Hostinger MySQL database.

Keeping both applications on the same domain means the existing Angular `/api` URLs continue to work without CORS or API-domain changes.

## Requirements

- A Hostinger Custom PHP/HTML website, not a Node.js Web App
- PHP 8.2 or newer (Laravel 12 requires PHP 8.2+)
- A Hostinger MySQL database
- SSH access (Premium Web Hosting or higher)
- Node.js and npm on the development computer

## 1. Configure Laravel to serve Angular

The file `backend/routes/web.php` should contain:

```php
<?php

use Illuminate\Support\Facades\Route;

Route::get('/{path?}', function () {
    return response()->file(public_path('index.html'));
})->where('path', '^(?!api(?:/|$)|up$).*$');
```

Why: Angular handles browser-side routes. Without this fallback, directly opening or refreshing `/login` or another Angular route would produce a Laravel 404. The regular expression excludes `/api` and Laravel's `/up` health endpoint.

Do not expose deployment or maintenance operations as public HTTP routes. In particular, `backend/routes/api.php` must not contain unauthenticated `/run-migration` or `/clear-cache` endpoints. Run maintenance commands through SSH instead.

## 2. Add the Hostinger root rewrite

Hostinger normally fixes the website document root at `public_html`. Because the Laravel application is installed directly in `public_html` while its safe web root is `public_html/public`, create `backend/.htaccess` with:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On

    RewriteCond %{REQUEST_URI} !^/public/
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

Why: this sends public web requests into Laravel's `public` directory. Laravel source files, configuration, and storage should not be served as normal website content.

Keep the standard Laravel file at `backend/public/.htaccess`; both `.htaccess` files are required.

## 3. Build Angular locally

Open PowerShell on the development computer:

```powershell
cd "C:\Users\Rama-office\Downloads\CS-application-for-rama\frontend"
npm ci
npm run build
```

What the commands do:

- `npm ci` installs the exact dependency versions recorded in `package-lock.json`.
- `npm run build` creates an optimized production Angular bundle.

The build output is created at:

```text
frontend\dist\frontend\browser
```

Copy the generated files into Laravel's public directory:

```powershell
Copy-Item `
  ".\dist\frontend\browser\*" `
  "..\backend\public\" `
  -Recurse -Force
```

Why: Hostinger will run Laravel/PHP, while Apache serves the compiled Angular files directly from Laravel's public directory.

After copying, `backend/public` should contain at least:

```text
.htaccess
index.php
index.html
main-....js
styles-....css
```

Do not delete Laravel's `public/index.php` or `public/.htaccess`.

## 4. Create a small deployment ZIP

Do not ZIP the complete repository. Exclude `.git`, `frontend`, `node_modules`, `vendor`, local `.env` files, Docker files, tests, and other development files. Large archives with thousands of entries can make Hostinger File Manager return HTTP 500 while extracting.

From the repository's `backend` directory, create the deployment archive:

```powershell
cd "C:\Users\Rama-office\Downloads\CS-application-for-rama\backend"

tar -a -cf ..\hostinger-upload.zip `
  --exclude=public/symlink.php `
  app bootstrap config database public resources routes storage `
  artisan composer.json composer.lock .htaccess
```

Why:

- The archive contains only the Laravel runtime and compiled Angular application.
- `vendor` is excluded because Composer should install packages for Hostinger's PHP environment.
- `public/symlink.php` is excluded because public scripts that create filesystem links are unsafe and unnecessary.
- Files are stored at the archive root, so `artisan`, `app`, and `public` extract directly into `public_html`.

The prepared archive in this repository is:

```text
C:\Users\Rama-office\Downloads\CS-application-for-rama\hostinger-upload.zip
```

## 5. Create the correct Hostinger website

In hPanel:

1. Open **Websites**.
2. Select **Add Website**.
3. Choose **Custom PHP/HTML website** or **Empty PHP website**.
4. Connect the production domain.
5. Set PHP to version 8.2 or newer.

Do not select **Deploy Web App**, Vite, or Angular. Those options deploy only a Node/static application and cannot execute the Laravel PHP backend.

## 6. Upload and extract the application

Open **Website Dashboard → Files → File Manager → public_html**. Upload `hostinger-upload.zip`, select it, and choose **Extract**.

The result must look like:

```text
public_html/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/
├── resources/
├── routes/
├── storage/
├── artisan
├── composer.json
├── composer.lock
└── .htaccess
```

There must not be an additional `backend/` or `hostinger-upload/` directory around these files.

If File Manager returns HTTP 500 while extracting, reconnect to File Manager first because sessions expire. If it still fails, enable SSH and extract the small archive through SSH:

```bash
cd ~/domains/your-domain.com/public_html
unzip hostinger-upload.zip
```

Replace `your-domain.com` with the actual domain. The exact home path is displayed in Hostinger's FTP/SSH settings.

## 7. Enable and connect through SSH

In hPanel, open **Websites → Dashboard → Advanced → SSH Access**, then select **Enable**. Copy the SSH command supplied by Hostinger. It normally resembles:

```powershell
ssh -p 65002 u123456789@123.123.123.123
```

Paste that command into Windows PowerShell. On the first connection, enter `yes` to trust the server. Enter the SSH password when prompted; no characters are displayed while typing the password.

Why: Hostinger Web/Cloud hosting does not provide a terminal inside File Manager. SSH is required to run Composer and Laravel Artisan securely. The browser Web Console is a VPS-only feature.

## 8. Create the MySQL database

In hPanel, open **Databases → Management** and create:

- a database;
- a database user;
- a strong password.

Record the exact database name, username, hostname, and password. Hostinger normally prefixes database names and usernames with the account identifier.

For a new installation, no `.sql` database backup is required. Laravel migrations create the schema. Hostinger's **Migrate Website** workflow asks for an `.sql` file because it is intended to move an existing website; do not use that workflow for this fresh deployment.

## 9. Create the production `.env`

Create `public_html/.env` using File Manager's **New File** action and enter values similar to:

```dotenv
APP_NAME="Customer Service"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://your-domain.com

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=u123456789_database
DB_USERNAME=u123456789_user
DB_PASSWORD=replace-with-the-real-password

SESSION_DRIVER=database
SESSION_LIFETIME=120
CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=local
```

Use the database host shown by Hostinger if it is not `localhost`.

Why:

- `.env` stores server-specific and secret configuration outside the source code.
- `APP_DEBUG=false` prevents sensitive stack traces and configuration from being shown publicly.
- `APP_URL` is used when Laravel generates absolute URLs.
- The `DB_*` values connect Laravel to Hostinger MySQL.

Never commit or distribute the production `.env` file.

## 10. Install PHP dependencies

From the SSH session:

```bash
cd ~/domains/your-domain.com/public_html
composer install --no-dev --optimize-autoloader
```

Why:

- `composer install` installs the versions locked in `composer.lock`.
- `--no-dev` excludes development-only testing and debugging packages.
- `--optimize-autoloader` creates a faster production class map.

If Composer reports a PHP version or missing-extension error, confirm that the website uses PHP 8.2+ and enable the required PHP extensions in hPanel.

## 11. Generate the Laravel application key

Run:

```bash
php artisan key:generate --force
```

Why: `APP_KEY` encrypts cookies and other Laravel-managed encrypted values. Every production installation requires a secure key.

Do not regenerate this key after users or encrypted production data exist unless the consequences are understood.

## 12. Run database migrations

Run:

```bash
php artisan config:clear
php artisan migrate --force
php artisan migrate:status
```

Why:

- `config:clear` ensures Laravel reads the current `.env` database settings.
- `migrate --force` creates or updates production database tables; `--force` explicitly permits a production operation.
- `migrate:status` shows which migrations have run.

`INFO Nothing to migrate` is successful when every row in `migrate:status` is marked as run. If a newly created database unexpectedly says nothing needs migration, verify the `.env` database name and run `php artisan config:clear` again.

### Optional database seeding

For a new database only:

```bash
php artisan db:seed --force
```

Before running it, change the insecure sample account passwords in `backend/database/seeders/DatabaseSeeder.php`. The repository's sample seeder creates predictable credentials and must not expose those credentials on a public production website.

Do not seed an existing production database unless the operation is intentional and understood.

## 13. Create the public storage link

Laravel normally uses:

```bash
php artisan storage:link
```

On this Hostinger environment, that command fails with:

```text
Call to undefined function Illuminate\Filesystem\exec()
```

Why it fails: Hostinger disables PHP functions such as `exec()` on shared hosting. Laravel tries to use `exec()` as a fallback when PHP's `symlink()` function is unavailable.

Create the same relative symbolic link directly through SSH:

```bash
mkdir -p storage/app/public
ln -s ../storage/app/public public/storage
ls -la public/storage
```

The result should resemble:

```text
public/storage -> ../storage/app/public
```

Do not run `php artisan storage:link` again on this server. If `ln` reports that `public/storage` already exists, inspect it with `ls -la public/storage`; do not create a second link.

## 14. Set writable directory permissions

Run only if Laravel reports permission errors:

```bash
chmod -R 775 storage bootstrap/cache
```

Why: Laravel must be able to write logs, sessions, compiled views, and cache files. Never use `chmod -R 777` on the application.

## 15. Build production caches

Run:

```bash
php artisan config:cache
php artisan view:cache
```

Why: these commands reduce repeated configuration and Blade view processing in production.

Do not use `php artisan route:cache` for the current project because `routes/web.php` contains an Angular fallback closure. Route caching may reject closure-based routes.

After changing `.env`, clear and rebuild the configuration cache:

```bash
php artisan config:clear
php artisan config:cache
```

## 16. Verify the deployment

Open these URLs:

```text
https://your-domain.com/
https://your-domain.com/login
https://your-domain.com/api/categories/public
https://your-domain.com/up
```

Verification checklist:

- The home page loads Angular.
- Directly opening and refreshing `/login` does not return 404.
- `/api/categories/public` returns JSON rather than Angular HTML.
- `/up` reports that Laravel is healthy.
- Login and authenticated API operations work.
- The browser developer console has no missing JavaScript or CSS errors.

## 17. Deploy future updates

For frontend changes:

1. Run `npm ci` when dependencies change.
2. Run `npm run build` in `frontend`.
3. Copy `frontend/dist/frontend/browser/*` into `backend/public`.
4. Recreate `hostinger-upload.zip`.
5. Upload and extract it over the application files.

For backend changes, recreate the same deployment ZIP and extract it. Then run:

```bash
cd ~/domains/your-domain.com/public_html
composer install --no-dev --optimize-autoloader
php artisan config:clear
php artisan migrate --force
php artisan config:cache
php artisan view:cache
```

Do not overwrite the production `.env` or delete `storage/app` during updates. Take a website and database backup before a significant production update.

## Troubleshooting

### Hostinger says “No output directory found after build”

Cause: the project was uploaded through the Node.js Web App workflow, which detected `backend/package.json` and ran Vite. Laravel is not a Node.js backend.

Fix: create a Custom PHP/HTML website and manually upload the prepared deployment ZIP to `public_html`.

### Hostinger asks for a database file

Cause: the **Migrate Website** workflow requires a `.sql` export from an existing website.

Fix: create an empty PHP website, upload through File Manager, create an empty MySQL database, and run Laravel migrations.

### File Manager returns HTTP 500 during extraction

Common causes include an expired File Manager session, an archive containing thousands of `vendor`, `node_modules`, or `.git` entries, or an oversized archive.

Fixes:

1. Close other File Manager tabs and reopen File Manager from hPanel.
2. Use the small `hostinger-upload.zip` produced by this guide.
3. Extract it over SSH with `unzip hostinger-upload.zip`.

### Website returns HTTP 500

Inspect Laravel's log:

```bash
cd ~/domains/your-domain.com/public_html
tail -n 100 storage/logs/laravel.log
```

Clear stale caches:

```bash
php artisan optimize:clear
php artisan config:cache
php artisan view:cache
```

Also verify PHP 8.2+, `.env`, database credentials, `APP_KEY`, and permissions for `storage` and `bootstrap/cache`.

### Database connection error

Run:

```bash
php artisan config:clear
php artisan migrate:status
```

Verify `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` against **hPanel → Databases → Management**. Hostinger may prefix the database and username.

### Angular route returns 404 after refresh

Verify:

- `public/index.html` exists;
- `routes/web.php` contains the Angular fallback;
- the root `.htaccess` forwards requests to `public/`;
- Laravel's standard `public/.htaccess` is present.

### API request returns Angular HTML

The Angular fallback is capturing API paths. Confirm its constraint is exactly:

```php
->where('path', '^(?!api(?:/|$)|up$).*$');
```

Then run:

```bash
php artisan optimize:clear
php artisan config:cache
php artisan view:cache
```

### Storage link command fails with disabled `exec()`

Use the SSH link command instead:

```bash
ln -s ../storage/app/public public/storage
```

## Production security checklist

- `APP_ENV=production`
- `APP_DEBUG=false`
- HTTPS enabled
- Production `.env` is not committed or included in a public archive
- `/run-migration` and `/clear-cache` HTTP routes removed
- Sample/default account passwords changed
- Database user has a strong unique password
- `storage` and `bootstrap/cache` are writable without using permission `777`
- Regular Hostinger file and database backups enabled
- Deployment ZIP deleted from `public_html` after successful extraction

