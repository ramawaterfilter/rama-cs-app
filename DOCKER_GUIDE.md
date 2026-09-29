# Docker Guide for the Phoenix Customer Service Application

This guide explains how the Docker configuration in this repository works. It is written for this project, not as a generic Docker tutorial.

The project consists of:

- An Angular frontend in `frontend/`
- A Laravel API backend in `backend/`
- A SQLite database at `backend/database/database.sqlite`
- Nginx serving the compiled Angular application and forwarding API requests to Laravel
- Docker Compose starting and connecting the frontend and backend containers

The setup is intentionally simple so that it is easy to understand. It is suitable for local learning, demonstrations, and basic deployments. The production considerations section explains what would normally change for a serious public deployment.

## 1. The final architecture

```text
                         Docker host (your computer)

 Browser
    |
    | http://localhost:4200
    v
+--------------------------------------------------------------+
| Docker                                                       |
|                                                              |
|  +-------------------------+                                 |
|  | frontend container      |                                 |
|  |                         |                                 |
|  | Nginx, port 80          |                                 |
|  |                         |                                 |
|  | /          -> Angular   |                                 |
|  | /api/...   -> proxy --------------------------+           |
|  +-------------------------+                     |           |
|                                                  v           |
|                              +-------------------------+     |
|                              | backend container       |     |
|                              |                         |     |
|                              | Laravel, port 8000      |     |
|                              |                         |     |
|                              | SQLite through a        |     |
|                              | bind-mounted directory  |     |
|                              +-------------------------+     |
|                                           |                  |
+-------------------------------------------|------------------+
                                            v
                       backend/database/ on your computer
```

There are two ways to reach the application from your computer:

| Address | Destination | Purpose |
| --- | --- | --- |
| `http://localhost:4200` | Nginx in the frontend container | Normal application access |
| `http://localhost:8000` | Laravel in the backend container | Direct backend access and debugging |

Normally, use `http://localhost:4200`. Nginx forwards requests beginning with `/api/` to Laravel.

## 2. Important Docker terms

Understanding these terms makes the configuration much easier to read.

### Image

An image is an immutable template containing an operating-system filesystem, programs, dependencies, configuration, and default startup instructions.

This project builds two images:

- A backend image containing PHP, PHP extensions, Composer dependencies, and the Laravel source
- A frontend image containing Nginx and the compiled Angular files

### Container

A container is a running instance of an image. Rebuilding an image and restarting a container are different operations.

You can create many containers from the same image. Containers have their own process space, filesystem, and network interface.

### Dockerfile

A Dockerfile describes how to build one image. This project has:

- `backend/Dockerfile`
- `frontend/Dockerfile`

### Build context

The build context is the directory Docker is allowed to read while building an image.

The Compose file sets these contexts:

```yaml
backend:
  build:
    context: ./backend

frontend:
  build:
    context: ./frontend
```

Therefore, `COPY . .` in the backend Dockerfile means “copy files from `backend/`,” while the same instruction in the frontend Dockerfile means “copy files from `frontend/`.”

Dockerfiles cannot normally copy files from outside their build context.

### Layer

Most Dockerfile instructions create cached image layers. If an instruction and all of its inputs remain unchanged, Docker can reuse that layer during the next build.

This is why dependency files are copied before application source files. Source code changes frequently, but dependency definitions change less frequently.

### Docker Compose

Docker Compose describes a group of related services. In this project, `compose.yaml` tells Docker how to build, configure, network, and start the frontend and backend together.

### Service

A service is a Compose definition such as `backend` or `frontend`. Compose normally creates one container for each service.

### Volume and bind mount

A container filesystem is disposable. A mount keeps important data outside the disposable container layer.

This project uses a bind mount:

```yaml
- ./backend/database:/var/www/html/database
```

The directory on the left is on your computer. The directory on the right is inside the backend container.

### Port mapping

A port mapping connects a port on your computer to a port inside a container. Its format is:

```text
HOST_PORT:CONTAINER_PORT
```

For example:

```yaml
- "4200:80"
```

This sends traffic from port `4200` on your computer to port `80` in the frontend container.

## 3. Files used by this setup

```text
CS-application-for-rama/
|-- compose.yaml
|-- DOCKER_GUIDE.md
|-- backend/
|   |-- .dockerignore
|   |-- .env
|   |-- .env.example
|   |-- Dockerfile
|   |-- artisan
|   |-- composer.json
|   |-- composer.lock
|   `-- database/
|       `-- database.sqlite
`-- frontend/
    |-- .dockerignore
    |-- Dockerfile
    |-- nginx.conf
    |-- package.json
    |-- package-lock.json
    `-- src/
```

Do not commit `backend/.env`. It can contain secrets. The repository's backend `.gitignore` already excludes it.

## 4. Backend Dockerfile explained

The file is `backend/Dockerfile`.

### Select the base image

```dockerfile
FROM php:8.3-cli
```

This starts from the official PHP 8.3 command-line image. The `cli` variant can run commands such as:

```text
php artisan migrate
php artisan serve
```

This image does not include every PHP extension, so the extensions required by this project are installed later.

### Copy Composer from another image

```dockerfile
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
```

This copies the Composer executable from the official Composer 2 image into the PHP image.

It is a convenient alternative to downloading and verifying Composer manually. The Composer image is only used as a source; it does not become another running container.

### Install operating-system packages and PHP extensions

```dockerfile
RUN apt-get update \
    && apt-get install -y libsqlite3-dev libzip-dev unzip \
    && docker-php-ext-install pdo_sqlite zip \
    && rm -rf /var/lib/apt/lists/*
```

This is one shell command split across lines for readability.

- `apt-get update` downloads the Debian package index.
- `apt-get install -y` installs packages without asking interactive questions.
- `libsqlite3-dev` provides files needed to compile PHP's SQLite extension.
- `libzip-dev` provides files needed to compile PHP's ZIP extension.
- `unzip` lets Composer extract ZIP distributions.
- `docker-php-ext-install pdo_sqlite zip` compiles and enables the PHP extensions.
- `rm -rf /var/lib/apt/lists/*` removes the downloaded package index to reduce image size.
- `&&` means the next operation runs only if the previous operation succeeded.

The application uses SQLite, so `pdo_sqlite` is essential. Without it, Laravel reports that it cannot find the database driver.

### Set the working directory

```dockerfile
WORKDIR /var/www/html
```

Following `RUN`, `COPY`, and startup commands use `/var/www/html` as their current directory. If the directory does not exist, Docker creates it.

### Copy dependency definitions first

```dockerfile
COPY composer.json composer.lock ./
```

Only the Composer dependency files are copied at this stage.

This enables layer caching. If application code changes but these two files do not, Docker can reuse the cached `composer install` layer.

### Install PHP dependencies

```dockerfile
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist
```

The options mean:

- `--no-dev`: do not install packages from `require-dev`.
- `--no-interaction`: do not ask questions during an automated build.
- `--no-scripts`: delay Composer scripts until all application source files have been copied.
- `--prefer-dist`: prefer packaged release archives over cloning dependency source repositories.

`composer.lock` makes the installed dependency versions reproducible.

### Copy the Laravel project

```dockerfile
COPY . .
```

This copies the backend build context into `/var/www/html`.

Files excluded by `backend/.dockerignore` are not sent to Docker and therefore are not copied.

### Optimize Composer autoloading

```dockerfile
RUN composer dump-autoload --optimize
```

This generates Composer's optimized class map after the application source exists. Laravel's Composer hooks also perform package discovery here.

### Document the application port

```dockerfile
EXPOSE 8000
```

`EXPOSE` documents that the image expects to listen on port 8000. It does not publish the port to your computer. Publishing happens in `compose.yaml`.

### Define the default command

```dockerfile
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
```

This is the default command when a container starts directly from the image.

`--host=0.0.0.0` is important. Binding to `127.0.0.1` inside a container would make the server reachable only from that same container. Binding to `0.0.0.0` accepts traffic through the container network interface.

The Compose `command` currently overrides this `CMD` so that migrations run before the server starts.

## 5. Backend `.dockerignore` explained

The file is `backend/.dockerignore`.

```text
vendor
node_modules
.git
.env
storage/logs/*
storage/framework/cache/*
storage/framework/sessions/*
storage/framework/views/*
```

Docker applies these patterns before sending the build context to the Docker engine.

- `vendor`: dependencies are installed inside the image with Composer.
- `node_modules`: host JavaScript dependencies are unnecessary in this backend image.
- `.git`: Git history is unnecessary at runtime.
- `.env`: prevents local secrets from becoming part of the image.
- Laravel-generated logs, cache, sessions, and compiled views are excluded because they are runtime data.

`.dockerignore` has two major benefits:

1. Smaller, faster build contexts
2. Lower risk of copying secrets or host-specific generated files into an image

It is different from `.gitignore`: `.gitignore` controls Git, while `.dockerignore` controls Docker build contexts.

## 6. Frontend Dockerfile explained

The file is `frontend/Dockerfile` and uses a multi-stage build.

### Stage 1: build Angular

```dockerfile
FROM node:20-alpine AS build
```

This creates a build stage named `build` using Node.js 20 on Alpine Linux.

Node is needed to compile Angular, but it is not needed to serve already-compiled HTML, JavaScript, and CSS.

```dockerfile
WORKDIR /app
```

This sets the working directory for the Angular build stage.

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
```

The dependency definitions are copied before the source to improve caching.

`npm ci` means clean, reproducible installation:

- It installs the exact versions in `package-lock.json`.
- It fails if `package.json` and `package-lock.json` disagree.
- It does not update the lock file.
- It is preferred for automated builds.

```dockerfile
COPY . .
RUN npm run build
```

The frontend source is copied, and the `build` script from `frontend/package.json` runs Angular's production build.

The output for this project is:

```text
/app/dist/frontend/browser
```

This path comes from the Angular build configuration and output structure.

### Stage 2: serve the compiled files

```dockerfile
FROM nginx:alpine
```

This starts a new stage based on Nginx. The final image does not inherit Node, `node_modules`, TypeScript source, or the first stage's filesystem.

```dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

This replaces the default Nginx virtual-host configuration with the project's configuration.

```dockerfile
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
```

This copies only the compiled Angular output from the `build` stage into Nginx's web root.

```dockerfile
EXPOSE 80
```

This documents that Nginx listens on container port 80.

Nginx's base image already has a default startup command, so this Dockerfile does not need its own `CMD`.

### Why use two stages?

A single Node-based image could run `ng serve`, but that is a development server. The multi-stage design provides:

- A smaller final image
- Fewer runtime programs and packages
- No frontend source or `node_modules` in the runtime image
- Nginx, which is designed to serve static content efficiently

## 7. Frontend `.dockerignore` explained

The file is `frontend/.dockerignore`.

```text
node_modules
dist
.angular
.git
.gitignore
README.md
```

- `node_modules`: dependencies must be installed for the container's Linux environment.
- `dist`: Angular output is rebuilt inside Docker.
- `.angular`: local Angular cache should not be copied.
- `.git`: Git metadata is not needed.
- `.gitignore` and `README.md`: these files are not needed to build or serve the application.

Copying Windows `node_modules` into a Linux container can cause incompatibilities, especially for packages containing native binaries. Installing dependencies inside the Linux build stage avoids that problem.

## 8. Nginx configuration explained

The file is `frontend/nginx.conf`.

```nginx
server {
    listen 80;
    server_name localhost;
```

This defines an HTTP virtual server listening on port 80. `server_name localhost` is appropriate for this local setup.

```nginx
    root /usr/share/nginx/html;
    index index.html;
```

- `root` is where the Dockerfile copied Angular's compiled files.
- `index index.html` makes Nginx return `index.html` for a directory request.

### Angular client-side routing

```nginx
    location / {
        try_files $uri $uri/ /index.html;
    }
```

Nginx tries these options in order:

1. An exact file matching the request path
2. A directory matching the request path
3. Angular's `index.html`

The fallback is required for client-side routes. For example, refreshing `/dashboard` would otherwise make Nginx search for a physical `dashboard` file and return 404. Returning `index.html` lets Angular Router interpret `/dashboard`.

### Reverse proxy for the Laravel API

```nginx
    location /api/ {
        proxy_pass http://backend:8000;
```

Requests beginning with `/api/` are not handled as Angular files. Nginx sends them to port 8000 of the Compose service named `backend`.

For example:

```text
Browser request:  http://localhost:4200/api/categories/public
Internal target:  http://backend:8000/api/categories/public
```

`backend` is resolved by Docker's internal DNS. It is not a public internet hostname and is normally not resolvable from your Windows host.

There is no trailing path component in `proxy_pass http://backend:8000;`, so Nginx forwards the original `/api/...` URI unchanged.

```nginx
        proxy_set_header Host $host;
```

This forwards the original HTTP host header.

```nginx
        proxy_set_header X-Real-IP $remote_addr;
```

This tells the backend the direct client's IP address as observed by Nginx.

```nginx
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

This preserves and extends the standard chain of proxy/client IP addresses.

```nginx
        proxy_set_header X-Forwarded-Proto $scheme;
```

This tells the backend whether the original request used HTTP or HTTPS.

Because the browser calls the API through the same `localhost:4200` origin, this reverse proxy also avoids many browser cross-origin (CORS) complications.

## 9. Compose configuration explained

The root `compose.yaml` coordinates the complete application.

### The services section

```yaml
services:
```

Every child entry under `services` defines a component managed by Compose.

### Backend service

```yaml
backend:
  build:
    context: ./backend
```

Compose builds the backend image using `backend/Dockerfile` and sends `backend/` as the build context.

```yaml
  env_file:
    - ./backend/.env
```

Variables from `backend/.env` are passed into the container at runtime.

The `.env` file is not copied into the image because `.dockerignore` excludes it. Supplying secrets at runtime is safer than embedding them in an image layer.

```yaml
  environment:
    APP_ENV: local
    APP_DEBUG: "true"
    APP_URL: http://localhost:8000
    DB_CONNECTION: sqlite
    DB_DATABASE: /var/www/html/database/database.sqlite
```

These variables configure Laravel inside the container.

- `APP_ENV=local` selects the local environment.
- `APP_DEBUG=true` enables detailed errors. Never use this on a public production service.
- `APP_URL` describes Laravel's externally reachable backend URL.
- `DB_CONNECTION=sqlite` selects Laravel's SQLite connection.
- `DB_DATABASE` uses an absolute path inside the container.

Values under `environment` override values with the same names from `env_file`.

`APP_KEY` is not declared here, so it comes from `backend/.env`.

```yaml
  volumes:
    - ./backend/database:/var/www/html/database
```

This bind-mounts the host's `backend/database` directory over the container's `/var/www/html/database` directory.

Consequences:

- Laravel reads and writes the host's SQLite file.
- Database data survives container deletion and image rebuilds.
- Host files at that path hide any files that the image originally had at the container path.
- File permissions must allow the container process to write to the database and directory.

```yaml
  ports:
    - "8000:8000"
```

Host port 8000 is mapped to backend container port 8000.

Publishing this port is useful for learning and direct API debugging. It is not required for frontend-to-backend communication because both services share a Docker network.

```yaml
  command: >
    sh -c "php artisan migrate --force &&
           php artisan serve --host=0.0.0.0 --port=8000"
```

Compose's `command` overrides the Dockerfile's `CMD`.

The YAML `>` style folds the following lines into one string. `sh -c` asks a shell to interpret `&&`.

At every backend container start:

1. `php artisan migrate --force` applies migrations that have not run.
2. Only if migration succeeds, `php artisan serve` starts Laravel.
3. If migration fails, `&&` prevents the server from starting and the container exits.

`--force` allows migrations to run without an interactive production-environment confirmation.

Seeding is deliberately not part of every startup. This project's category seeder truncates and rebuilds category tables, so automatically running it on every restart could unexpectedly alter existing data.

### Frontend service

```yaml
frontend:
  build:
    context: ./frontend
```

Compose builds the frontend image from `frontend/Dockerfile` using `frontend/` as its context.

```yaml
  depends_on:
    - backend
```

Compose starts the backend service before the frontend service.

Important: basic `depends_on` controls startup order, but it does not guarantee that Laravel is ready to accept requests. For stronger readiness behavior, add a backend health check and use a health-based dependency condition.

```yaml
  ports:
    - "4200:80"
```

This maps host port 4200 to Nginx port 80 inside the frontend container.

The browser therefore uses `http://localhost:4200`, even though Nginx itself listens on port 80 inside Docker.

## 10. Automatic Docker networking

Compose creates a private bridge network for the project unless another network is specified.

Both services join that network. Docker provides DNS records based on service names:

```text
frontend container -> backend:8000 -> backend container
```

Important address rules:

- From your Windows computer, use `localhost:8000`.
- From the frontend container, use `backend:8000`.
- Inside a container, `localhost` refers to that same container, not your computer and not another container.

This is why Nginx uses:

```nginx
proxy_pass http://backend:8000;
```

Using `http://localhost:8000` there would make Nginx look for Laravel inside the frontend container.

## 11. Environment variables and Laravel

Create the backend environment file once:

```powershell
cd backend
Copy-Item .env.example .env
php artisan key:generate
cd ..
```

`php artisan key:generate` writes a random `APP_KEY` into `backend/.env`. Laravel uses this key for encryption, signed data, and cookies.

Do not regenerate `APP_KEY` every time a container starts. Changing it makes data encrypted with the old key unreadable and invalidates existing encrypted cookies or sessions.

Runtime variable precedence relevant to this setup is:

```text
compose.yaml environment values
        override
compose.yaml env_file values
```

You can inspect the variables visible inside the backend container:

```powershell
docker compose exec backend printenv
```

Avoid sharing this output publicly because it can include secrets.

## 12. First-time setup

Run these commands from the repository root.

### Check Docker

Start Docker Desktop, then run:

```powershell
docker --version
docker compose version
docker info
```

`docker --version` only proves that the client is installed. `docker info` also checks that the Docker engine is running.

### Create Laravel's environment file

```powershell
cd backend
Copy-Item .env.example .env
php artisan key:generate
cd ..
```

Skip the copy if `.env` already exists and contains a valid `APP_KEY`.

### Build and start the application

```powershell
docker compose up --build
```

- `up` creates and starts the services.
- `--build` builds images before starting.
- Without `-d`, logs stay attached to the terminal.
- Press `Ctrl+C` to stop attached containers.

To run in the background:

```powershell
docker compose up --build -d
```

### Seed initial data

For a new, empty database, run:

```powershell
docker compose exec backend php artisan db:seed --force
```

Do this intentionally rather than at every startup. The current database has already been seeded.

### Open the application

Open:

```text
http://localhost:4200
```

Seeded test accounts are:

```text
Admin: admin@phoenix.com / password
CSE:   cse@phoenix.com / password
```

These simple passwords are for local learning only.

## 13. What happens during `docker compose up --build`

The high-level sequence is:

1. Compose reads `compose.yaml`.
2. Compose reads both Dockerfiles and `.dockerignore` files.
3. Docker builds the backend image.
4. Docker builds Angular in the Node stage.
5. Docker builds the final frontend image with Nginx and compiled Angular files.
6. Compose creates its default private network.
7. Compose creates the backend container.
8. Compose attaches `backend/database` to the backend container.
9. Laravel runs pending migrations and starts on `0.0.0.0:8000`.
10. Compose creates and starts the frontend container.
11. Nginx starts on container port 80.
12. Host port 4200 forwards to Nginx.
13. Host port 8000 forwards directly to Laravel.

## 14. What happens during a browser request

### Angular page request

For this request:

```text
GET http://localhost:4200/dashboard
```

The flow is:

1. Docker forwards host port 4200 to frontend container port 80.
2. Nginx receives `/dashboard`.
3. No physical `/dashboard` file exists.
4. `try_files` returns `index.html`.
5. Angular starts in the browser.
6. Angular Router renders the dashboard route.

### API request

For this request:

```text
GET http://localhost:4200/api/categories/public
```

The flow is:

1. Docker forwards host port 4200 to Nginx.
2. Nginx matches `location /api/`.
3. Docker DNS resolves `backend` to the backend container.
4. Nginx proxies the original URI to `http://backend:8000/api/categories/public`.
5. Laravel matches the route in `backend/routes/api.php`.
6. Laravel queries SQLite.
7. The response travels back through Nginx to the browser.

## 15. Daily commands

Run commands from the repository root unless stated otherwise.

### Start existing containers

```powershell
docker compose up -d
```

### Start and show logs in the terminal

```powershell
docker compose up
```

### Stop and remove the containers and Compose network

```powershell
docker compose down
```

This does not delete the bind-mounted SQLite database.

### Restart services

```powershell
docker compose restart
```

Restart does not rebuild images and does not apply source changes copied into images.

### See service state

```powershell
docker compose ps
docker compose ps -a
```

`-a` also shows stopped containers.

### Follow all logs

```powershell
docker compose logs -f
```

### Follow one service

```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

Press `Ctrl+C` to stop following logs; this does not stop detached containers.

### Open a shell inside a container

```powershell
docker compose exec backend sh
docker compose exec frontend sh
```

Type `exit` to leave the shell.

### Run Laravel commands

```powershell
docker compose exec backend php artisan about
docker compose exec backend php artisan route:list
docker compose exec backend php artisan migrate:status
docker compose exec backend php artisan optimize:clear
```

### Validate Compose syntax

```powershell
docker compose config
docker compose config --quiet
```

The first command prints the normalized, merged configuration. The second returns success silently when the configuration is valid.

## 16. When a rebuild is required

The application source is copied into the images; it is not live-mounted. Therefore, code changes require an image rebuild.

| Change | Command |
| --- | --- |
| Backend PHP source | `docker compose up --build -d backend` |
| `composer.json` or `composer.lock` | `docker compose up --build -d backend` |
| Frontend Angular source | `docker compose up --build -d frontend` |
| `package.json` or `package-lock.json` | `docker compose up --build -d frontend` |
| `nginx.conf` | `docker compose up --build -d frontend` |
| Either Dockerfile | `docker compose up --build -d` |
| `compose.yaml` runtime settings | Usually `docker compose up -d` |
| SQLite data | No rebuild; it is bind-mounted |

Force a completely uncached rebuild with:

```powershell
docker compose build --no-cache
docker compose up -d
```

Use `--no-cache` for debugging stale build concerns, not as the normal workflow.

## 17. Understanding logs

Compose prefixes each line with its service/container name:

```text
backend-1  | ...
frontend-1 | ...
```

Normal backend startup includes messages similar to:

```text
INFO  Nothing to migrate.
INFO  Server running on [http://0.0.0.0:8000].
```

Normal frontend startup includes:

```text
Configuration complete; ready for start up
start worker processes
```

Nginx entrypoint messages about `/docker-entrypoint.d/` are normal behavior from the official Nginx image.

## 18. The SQLite seeder error that was fixed

The original category seeder contained:

```php
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
```

That statement belongs to MySQL. SQLite reported:

```text
SQLSTATE[HY000]: General error: 1 near "SET": syntax error
```

The seeder now uses Laravel's database-independent schema API:

```php
Schema::disableForeignKeyConstraints();

try {
    DB::table('category_relationships')->truncate();
    QueryCategory::truncate();
} finally {
    Schema::enableForeignKeyConstraints();
}
```

The `finally` block ensures Laravel attempts to restore constraints even if truncation throws an exception.

The earlier Nginx error:

```text
host not found in upstream "backend"
```

was a downstream symptom. The seeder failure caused the backend startup command to exit before Laravel started. Once the backend remained healthy, Nginx resolved the service and started normally.

## 19. Troubleshooting checklist

### Docker engine is unavailable

Symptom:

```text
Cannot connect to the Docker daemon
```

or a Windows named-pipe permission/connection error.

Checks:

```powershell
docker info
docker context show
```

Start Docker Desktop and wait until its engine is ready.

### A container exits immediately

```powershell
docker compose ps -a
docker compose logs backend
docker compose logs frontend
```

The first real application error is usually more useful than later cascading errors.

### Port already in use

Symptom:

```text
port is already allocated
```

Either stop the program using the port or change the host side of the mapping:

```yaml
ports:
  - "4300:80"
```

The application would then be available at `http://localhost:4300`. The container port remains 80.

### Frontend returns 502 Bad Gateway for API calls

Check the backend:

```powershell
docker compose ps -a
docker compose logs backend
docker compose exec frontend wget -qO- http://backend:8000/api/categories/public
```

A 502 usually means Nginx is running but cannot get a valid response from Laravel.

### `host not found in upstream "backend"`

Confirm:

- The Compose service is named exactly `backend`.
- Both containers belong to the same Compose project/network.
- The backend container has not failed.
- Nginx uses `backend:8000`, not `localhost:8000`.

Then recreate both services together:

```powershell
docker compose down
docker compose up --build -d
```

### Laravel says `No application encryption key has been specified`

Generate the key in the host `.env`:

```powershell
cd backend
php artisan key:generate
cd ..
docker compose up -d --force-recreate backend
```

### Laravel cannot open SQLite

Check that the file exists:

```powershell
Test-Path .\backend\database\database.sqlite
```

Create it if this is a fresh repository:

```powershell
New-Item .\backend\database\database.sqlite -ItemType File
```

Check the path inside the container:

```powershell
docker compose exec backend ls -la /var/www/html/database
docker compose exec backend php -m
```

The PHP module list should contain `pdo_sqlite`.

### Angular source changes do not appear

This is an image-based frontend, not a live development mount. Rebuild it:

```powershell
docker compose up --build -d frontend
```

Then hard-refresh the browser. If necessary, inspect the build without cache:

```powershell
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Inspect an HTTP response from PowerShell

```powershell
curl.exe -i http://localhost:4200/
curl.exe -i http://localhost:4200/api/categories/public
curl.exe -i http://localhost:8000/api/categories/public
```

The first URL tests Nginx and Angular. The second tests Nginx plus Docker networking plus Laravel. The third bypasses Nginx and tests Laravel directly.

## 20. Data persistence and reset behavior

The SQLite file is stored on the host because of this bind mount:

```yaml
- ./backend/database:/var/www/html/database
```

These commands do not delete the host database:

```powershell
docker compose stop
docker compose down
docker compose down -v
```

`down -v` deletes Docker-managed named volumes, but this database is a host bind mount, not a named volume.

Do not delete `backend/database/database.sqlite` unless you intentionally want to lose local database data.

To rebuild a development database intentionally, first make a backup. Then Laravel provides commands such as:

```powershell
docker compose exec backend php artisan migrate:fresh --seed
```

Warning: `migrate:fresh --seed` drops all database tables and destroys their data. It should only be used when that data is disposable.

## 21. Image and container inspection

List Compose containers:

```powershell
docker compose ps -a
```

List images:

```powershell
docker image ls
```

Inspect the backend container:

```powershell
docker inspect cs-application-for-rama-backend-1
```

Names can vary according to the repository directory and Compose project name, so obtain the exact name with `docker compose ps` first.

View image layers:

```powershell
docker history cs-application-for-rama-backend
docker history cs-application-for-rama-frontend
```

See processes inside containers:

```powershell
docker compose top
```

See live resource use:

```powershell
docker stats
```

## 22. Development setup versus this built-image setup

This configuration compiles source into images. That is useful for learning deployment concepts, but every source edit requires a rebuild.

A Docker development setup often does the following instead:

- Mounts source directories into containers
- Runs Angular's development server with file watching
- Installs dependencies in Docker-managed volumes
- Enables Laravel development tooling
- Uses development-specific Dockerfiles or Compose overrides

Keeping development and deployment configurations separate avoids filling a runtime image with development tools. The current setup is closer to a simple deployable image than a hot-reloading development environment.

## 23. Current security and production limitations

Before exposing this application publicly, address at least the following:

1. Set `APP_ENV=production`.
2. Set `APP_DEBUG=false` so exceptions and configuration are not exposed.
3. Replace seeded default passwords.
4. Store secrets in an appropriate secret manager or deployment environment.
5. Put the application behind HTTPS.
6. Do not publish backend port 8000 unless direct access is required.
7. Replace `php artisan serve` with a production architecture, commonly Nginx plus PHP-FPM.
8. Run containers as a non-root user where practical.
9. Define health checks and restart policies.
10. Decide whether SQLite is suitable for the expected concurrency, backup, and availability requirements.
11. Pin base images more strictly and regularly rebuild them for security updates.
12. Add automated tests and image vulnerability scanning.
13. Back up persistent database data.

The current configuration deliberately uses Laravel's built-in server to keep the backend container understandable. It is not intended to be a complete production platform.

## 24. Suggested learning exercises

Use these exercises in order.

### Exercise 1: Observe normal startup

```powershell
docker compose down
docker compose up --build
```

Identify which log lines come from image building, migrations, Laravel, the Nginx entrypoint, and Nginx workers.

### Exercise 2: Explore container networking

```powershell
docker compose exec frontend wget -qO- http://backend:8000/api/categories/public
```

Then try `http://localhost:8000` from inside the frontend container and explain why it does not point to the backend.

### Exercise 3: Explore the filesystems

```powershell
docker compose exec frontend ls -la /usr/share/nginx/html
docker compose exec backend ls -la /var/www/html
docker compose exec backend ls -la /var/www/html/database
```

Compare those paths with the Dockerfile `COPY` instructions and Compose mount.

### Exercise 4: Observe layer caching

Run twice:

```powershell
docker compose build frontend
```

The second build should reuse cached layers. Change one frontend source file and build again. Notice that dependency installation can remain cached while the source-copy and build steps rerun.

### Exercise 5: Change a host port

Change:

```yaml
- "4200:80"
```

to:

```yaml
- "4300:80"
```

Run `docker compose up -d` and access `http://localhost:4300`. This demonstrates that host and container ports do not need to match.

### Exercise 6: Inspect environment precedence

Temporarily change `APP_DEBUG` in `backend/.env`, while leaving the Compose `environment` value unchanged. Recreate the backend and inspect its environment. The Compose `environment` value wins.

Restore the original configuration afterward.

### Exercise 7: Test persistence

Create or update a record through the application, run:

```powershell
docker compose down
docker compose up -d
```

Verify that the record remains. The bind-mounted SQLite file persisted outside the deleted container.

## 25. Command cheat sheet

```powershell
# Build and start in the foreground
docker compose up --build

# Build and start in the background
docker compose up --build -d

# Start without rebuilding
docker compose up -d

# Show container state
docker compose ps -a

# Follow all logs
docker compose logs -f

# Follow backend logs
docker compose logs -f backend

# Stop and remove Compose containers/network
docker compose down

# Rebuild only the frontend
docker compose up --build -d frontend

# Rebuild only the backend
docker compose up --build -d backend

# Run an Artisan command
docker compose exec backend php artisan about

# Run pending migrations
docker compose exec backend php artisan migrate --force

# Intentionally seed the database
docker compose exec backend php artisan db:seed --force

# Validate Compose configuration
docker compose config --quiet

# Open a backend shell
docker compose exec backend sh

# Test the frontend
curl.exe -i http://localhost:4200/

# Test API proxying
curl.exe -i http://localhost:4200/api/categories/public
```

## 26. The most important ideas to remember

1. A Dockerfile builds an image; Compose runs related containers.
2. The build context controls which files a Dockerfile can copy.
3. `.dockerignore` keeps unnecessary and sensitive files out of builds.
4. A multi-stage build lets Node compile Angular without putting Node in the final Nginx image.
5. Host ports and container ports are different namespaces.
6. Containers reach each other by Compose service name, not by `localhost`.
7. Container filesystems are disposable; the SQLite bind mount provides persistence.
8. Compose runtime environment values can override values from `.env`.
9. `depends_on` controls basic order, not application readiness.
10. Rebuilding is required because application source is copied into the images.
11. Migrations can safely run at startup, but destructive seeders should be explicit.
12. Logs and `docker compose ps -a` are the first places to look when a service fails.

