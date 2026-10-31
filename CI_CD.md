# CI/CD for Hostinger Business Web Hosting

Last updated: 2026-10-30. Keep this file updated whenever the pipeline, deployment
layout, required settings, or verification results change.

## Status

The repository contains the pipeline. Live deployment is **not activated or verified**.
No production secret values were printed, and no application release has been
deployed by this work.

The two original code blockers are resolved locally: all **34 frontend tests** and
**17 Laravel tests** pass, and the updated PHP production dependencies pass the
security audit. See the follow-up change record below for the fixes and versions.

SSH access and the active domain/layout are confirmed. The pipeline now supports
the existing **SQLite** database in private shared state and takes a verified
snapshot before each migration. The local SQLite and deployment-recovery checks
pass. The private deployment folders and an initial verified SQLite snapshot now
exist on Hostinger, with a matching local backup copy. **Deployment is still
disabled:** the live site has not been switched to the new layout, and the shared
working database and production `.env` have not been prepared. Its last inspected cached configuration still has
`APP_ENV=local` and `APP_DEBUG=true`.

GitHub's `production` environment and its `main`-only deployment rule are now
verified. The user reports the five environment secrets, two environment variables,
and repository deployment flag were saved as instructed; their values remain
unverified with the available read-only account. The approved application updates
and CI/CD were published on review branch `replace-application-code` at
`baeac0613198e950eab251c5ab4f9d530c563273`; `main` was not changed. Open its pull
request and require passing GitHub CI before the SQLite-preserving cutover. No live
configuration was changed by this pipeline update.

The approved follow-up updated test setup, the frontend icon registry, and
`backend/composer.lock`. Existing unrelated workspace changes remain the owner's
work. No production database migrations were run locally.

## What happens when code changes

1. Pull requests run deployment-script checks, install locked dependencies, run
   Laravel tests against in-memory SQLite, run Angular tests in headless Chrome,
   audit production dependencies, and build the production frontend.
2. Pushes to `main` run the same checks, then package the built frontend and Laravel
   application with production-only PHP dependencies into one artifact.
3. Once explicitly enabled, the production job downloads that exact artifact,
   skips superseded commits, verifies the SSH host key, and uploads over SSH.
4. Hostinger verifies the archive checksum, production configuration, and shared
   SQLite path, builds Laravel caches, and briefly enables API maintenance mode.
   It takes an integrity-checked SQLite snapshot before running `migrate --force`.
   If the snapshot cannot be created, migrations and activation are skipped.
5. An atomic `current` symlink change activates the release. HTTPS checks confirm
   its commit, Laravel `/up`, and the database-backed `/api/categories/public` API.
   A failed check restores the previous code release and fails the deployment.

CI uses PHP 8.3 and Node 22 on Ubuntu 24.04. Configure **both Hostinger web PHP and
SSH CLI PHP to 8.3**, with the application-required extensions. Node is needed only
in CI; Hostinger serves the compiled frontend. PHP CLI must include both
`pdo_sqlite` and `sqlite3`; the latter provides the SQLite backup API.

## Files maintained by this change

| File | Purpose |
| --- | --- |
| `.github/workflows/hostinger.yml` | CI, release packaging, gated production deployment |
| `.github/dependabot.yml` | Weekly GitHub Actions, npm, and Composer update PRs |
| `deploy/hostinger.sh` | Server validation, migrations, activation, health checks, code recovery |
| `deploy/test-hostinger.sh` | Invalid-input checks and mocked Linux deployment/recovery tests |
| `deploy/sqlite.php` | Production/path validation and verified SQLite snapshots |
| `deploy/test-sqlite.php` | Real temporary SQLite/WAL snapshot and configuration safety tests |
| `deploy/public/index.php` | Laravel entry point with a private application root |
| `deploy/public/.htaccess` | Angular deep links, Laravel API routing, basic security/cache headers |
| `deploy/production.env.example` | Reference for server-only production configuration |
| `.gitattributes` | LF line endings for shell scripts and YAML |
| `.gitignore` | Ignore local deployment archives, environment files, and database backups |
| `CI_CD.md` | Setup, operating instructions, limitations, and change record |

The production artifact uses an explicit source-directory whitelist. It excludes
`.env`, runtime storage, local SQLite databases, tests, development helpers, and
local ZIP archives. The frontend must not contain secrets: its JavaScript is public.
Ignore rules do not remove files already tracked by Git or erase repository history.

## GitHub setup

Repository: `ramawaterfilter/rama-cs-app`. Deployment branch: `main`.
The current local work branch is `replace-application-code`; use a reviewed PR to
merge the intended application and pipeline changes into `main`.

1. Enable GitHub Actions and create the `production` environment under repository
   Settings → Environments. Restrict deployment branches to `main`. A required
   reviewer is optional; it adds an approval step to each production deployment.
2. Protect `main`: require pull requests, a review, and the
   `Test, audit, and build` status check; block force pushes and branch deletion.
   Run CI once so the check becomes available in repository settings. Configure
   these protections where supported by the repository's GitHub plan.
3. Add the following **environment secrets** to `production`:

| Secret | Value |
| --- | --- |
| `HOSTINGER_SSH_HOST` | `82.112.232.165` |
| `HOSTINGER_SSH_USER` | `u891711850` |
| `HOSTINGER_SSH_PORT` | `65002` |
| `HOSTINGER_SSH_PRIVATE_KEY` | Dedicated deployment private key, including PEM/OpenSSH boundaries |
| `HOSTINGER_SSH_KNOWN_HOSTS` | Verified OpenSSH known_hosts entry for that host and port |

4. Add these **environment variables** to `production`:

| Variable | Example |
| --- | --- |
| `HOSTINGER_DEPLOY_ROOT` | `/home/u891711850/apps/rama-cs` |
| `PRODUCTION_URL` | `https://salmon-mule-212046.hostingersite.com` (no trailing slash or path) |

5. Only after the server cutover is ready, set **repository variable**
   `HOSTINGER_DEPLOY_ENABLED` to `true`. This is a repository-level variable because
   the workflow evaluates it before entering the deployment environment. Until
   enabled, CI runs normally and the production job is skipped.

Generate a dedicated SSH key locally, store its public key in the Hostinger
account's `~/.ssh/authorized_keys`, and keep the private key only in GitHub secrets.
Restrict that authorized key with `restrict` where supported to disable forwarding
and PTY access. Use a dedicated account/site if your plan allows it: a shared-hosting
SSH account may otherwise access the account's other websites too. Rotate or revoke
the key when access changes. Never put passwords or private keys in Git or this file.

Collect the host key using a trusted machine and compare its fingerprint with an
independently trusted Hostinger source/connection before saving the known_hosts
entry. `ssh-keyscan` alone does not authenticate the host. For a nonstandard port,
the entry normally starts with `[hostname]:port`. The pipeline never disables host
key checking or dynamically trusts an unverified key.

## One-time Hostinger setup and cutover

This is a **new deployment layout**, not an in-place ZIP update. Do not enable
automatic deployment against the existing public folders without this cutover.
Confirm SSH access and that Hostinger serves a symlinked `public_html` document
root for this account. Follow Hostinger's symlink requirements if applicable;
if the hosting configuration cannot serve that layout, stop before cutover.

Required SSH commands: Bash, PHP 8.3 with `pdo_sqlite` and `sqlite3`, curl, tar, sha256sum, realpath, flock,
readlink, ln, and GNU-compatible `mv -T`. Enable HTTPS and force HTTPS in hPanel.
Bypass CDN caching for `/api/*`, `/up`, `/release.json`, and `index.html`.

Target layout:

```text
/home/ACCOUNT/apps/rama-cs/
  incoming/                   # uploaded release archives
  releases/RELEASE_ID/         # application and vendor/, public/ contains built UI
  shared/.env                 # existing APP_KEY, database and mail credentials
  shared/storage/             # existing uploads, sessions, logs, framework state
  shared/database/database.sqlite # existing live database, shared by all releases
  shared/backups/RELEASE_ID.sqlite # verified snapshot before each migration
  current -> releases/RELEASE_ID
  previous -> releases/PREVIOUS_ID
/home/ACCOUNT/domains/DOMAIN/public_html -> /home/ACCOUNT/apps/rama-cs/current/public
```

1. Confirm the intended site is `salmon-mule-212046.hostingersite.com`. Read-only
   SSH inspection identified its live Laravel root as
   `/home/u891711850/domains/salmon-mule-212046.hostingersite.com/public_html`,
   with frontend files in `public/` and SQLite in `database/database.sqlite`.
   Recheck these paths at cutover; do not use the separate `rama-app` installation.
2. Take fresh **website files and SQLite** backups and confirm the restore process.
   SQLite is a file-backed database: a MySQL backup does not back it up. Use the
   SQLite backup API for a consistent snapshot, including any committed WAL data;
   do not copy only `database.sqlite` while writers are active. Keep a copy off
   the hosting account. Preserve uploads outside Laravel storage separately.
3. Create private directories over SSH, substituting the actual account path:

   ```bash
   APP_ROOT=/home/u891711850/apps/rama-cs
   mkdir -p "$APP_ROOT/incoming" "$APP_ROOT/releases" "$APP_ROOT/shared/storage" "$APP_ROOT/tools"
   mkdir -p "$APP_ROOT/shared/database" "$APP_ROOT/shared/backups"
   chmod 750 "$APP_ROOT" "$APP_ROOT/incoming" "$APP_ROOT/releases" "$APP_ROOT/shared"
   chmod 700 "$APP_ROOT/shared/database" "$APP_ROOT/shared/backups"
   ```

4. Copy the **existing live** `.env` into `shared/.env` and copy the contents of the
   existing live `storage/` into `shared/storage/`. Preserve existing `APP_KEY`,
   database, mail, and application-specific settings. Review
   `deploy/production.env.example` for production settings; do not replace the
   live configuration with that example. Use `APP_ENV=production`,
   `APP_DEBUG=false`, `DB_CONNECTION=sqlite`, and the absolute path
   `DB_DATABASE=/home/u891711850/apps/rama-cs/shared/database/database.sqlite`.
   Remove/empty `DB_URL` so it cannot override that path. Set `APP_URL` to the
   HTTPS origin. Make `.env` mode `600`. Do not generate a new application key.
5. Ensure `shared/storage/framework/{cache/data,sessions,views}` and
   `shared/storage/logs` exist and are writable by the account's PHP process.
   Use account-appropriate `750`/`640` directory/file permissions; never `777`.
   Keep the storage copy current during the final cutover maintenance window.
   If the current application has public uploads, preserve their URL paths and
   configure a supported `public/storage` link before cutover as required.
6. First get a successful CI run with the updated tests and lockfile. Upload the
   reviewed `deploy/sqlite.php` helper to the private `APP_ROOT/tools/sqlite.php`.
   In a planned maintenance window, put the **original live app** into maintenance,
   pause any queue workers/cron jobs that can write, let in-flight writes finish,
   and take the final consistent snapshot into shared state:

   ```bash
   # Run only during the authorized cutover window, after recording backups.
   APP_ROOT=/home/u891711850/apps/rama-cs
   LIVE_ROOT=/home/u891711850/domains/salmon-mule-212046.hostingersite.com/public_html
   cd "$LIVE_ROOT"
   php artisan down --retry=30
   php -r 'require $argv[1]; \Deployment\backupDatabase($argv[2], $argv[3]);' \
     "$APP_ROOT/tools/sqlite.php" "$LIVE_ROOT/database/database.sqlite" \
     "$APP_ROOT/shared/database/database.sqlite"
   ```

   The destination must not already exist. If it does, stop and reconcile which
   database is current; the helper refuses to overwrite it. Keep writers paused
   and the original app in maintenance until the cutover completes. Finalize the
   storage copy while writes are paused. Preserve the existing `public_html` directory as a backup
   outside the web root, then create `public_html` as a symlink to
   `APP_ROOT/current/public`. **Do not delete or overwrite the existing directory.**
   The link is initially dangling: the site will be unavailable until the first
   deployment succeeds. Keep the original directory path recorded for recovery.
7. Set `HOSTINGER_DEPLOY_ENABLED=true` and run **CI and Hostinger deployment**
   through Actions → Run workflow on `main`. If the first deployment fails,
   remove only the new `public_html` symlink and restore the saved original
   directory before investigating. Before bringing the original code back up,
   assess schema compatibility and point its database configuration at the **same
   shared database**, clearing/rebuilding its configuration cache as appropriate.
   Do not return to the frozen original database and lose writes made after
   activation. Do not automatically restore a pre-migration snapshot.
8. Check `/login` including a hard refresh, sign in with existing roles, and
   verify tickets and uploads. Confirm that `/.env`, `/vendor/`, `/storage/logs/`,
   and Laravel source directories are unavailable publicly. Keep the original
   code/file and database backups until recovery has been rehearsed.

Only `public/` is web-accessible in the target layout. Do not place `.env`, vendor,
database exports, deploy scripts, or application source inside the public directory.

## Routine operation and recovery

Code and data have separate recovery procedures. Once a previous release exists,
failed post-activation health checks automatically restore its code symlink while
keeping the shared database. For the **first cutover**, no previous release exists
in the new layout: failed activation removes the new `current` link, and an
operator must restore the preserved original website with compatible shared
database configuration. Attend that first deployment in a maintenance window.

Database snapshots are point-in-time recovery copies. Restoring one can discard
records written afterward, so database restoration is never automatic. Shared
storage, pre-migration snapshots, and code rollback reduce deployment risk; they
do not guarantee protection against every application bug, operator error, or
hosting failure. Keep off-host backups and test recovery before cutover.

After activation, merge reviewed changes into `main` to deploy automatically.
Failed checks stop deployment. GitHub and the server serialize deployments; a
superseded commit is skipped before upload. A push arriving during an active
deployment is handled by the next deployment after its CI passes.

Review migration changes before merge. Automatic code recovery assumes migrations
are backward-compatible with the previous release. Prefer additive changes and
separate destructive schema changes into a maintenance procedure with a fresh
database backup. The pipeline never runs seeders, `key:generate`, `migrate:fresh`,
`db:wipe`, or automatic `migrate:rollback`.

For a later problem after a successful deployment, prefer reverting the bad commit
with a reviewed PR to `main`. For emergency manual code rollback, connect over SSH,
take the deployment lock, confirm the recorded previous release still exists and
is compatible with the current database, then atomically switch `current` to that
release using `ln -s` and `mv -Tf`. Check the release marker, `/up`, and the category
API afterward. This changes code only; restore database backups only after assessing
which newer records would be lost. Temporarily disable the deployment repository
variable if automatic deployments would conflict with manual incident work.

On errors, inspect GitHub Actions logs and private
`shared/storage/logs/laravel.log`. A migration failure keeps the old code active;
inspect partially applied schema changes before retrying. Pre-migration snapshots
are stored privately at `shared/backups/RELEASE_ID.sqlite`. They use SQLite's
backup API, are checked with `PRAGMA quick_check`, must contain the Laravel
`migrations` table, are mode `600`, and are never overwritten. A failed backup
prevents migration and activation. Recovery switches code only: database restore
is always a deliberate maintenance operation because it can discard newer writes.
If an interrupted job
leaves maintenance enabled, inspect first, then run `php artisan up` from the
intended release. A hard kill/SSH disconnect is not guaranteed to run shell traps.

Keep at least the current and previous releases. Remove older inactive releases
and failed incoming archives periodically after verifying every resolved path;
never remove `shared/`, `current`, or the target of `previous`. Automatic pruning
is intentionally omitted to preserve recovery options. Monitor hosting disk quota.
Keep SQLite snapshots according to your data-retention needs and copy them off the
account; automatic snapshot deletion is intentionally omitted. Same-account
snapshots do not protect against account loss. Use hPanel file backups as another
layer, confirming they include the private shared database and snapshots.

No persistent queue worker or scheduler is installed by this pipeline. Preserve
your existing configuration; use `QUEUE_CONNECTION=sync` if no worker exists.
If workers or cron jobs are used, point them at `current/artisan` and arrange worker
restarts during deployment. Existing browser tabs may need a refresh after a release
because lazy-loaded frontend assets belong to the prior release.

## Security controls

- Full commit SHA pins for workflow actions, weekly update PRs, read-only GitHub
  token permissions, and no persisted checkout credentials.
- PR jobs never receive deployment secrets; only `main` enters production.
- Explicit deployment enable switch, production environment restrictions, and
  branch protection configured in GitHub.
- Lockfile installs, PHP/frontend audits, tests, and production bundle budgets.
- SSH key authentication, strict verified host-key checking, input validation,
  transfer checksum verification, and runner credential cleanup.
- Private production `.env` and shared state, production debug-mode validation,
  an exact shared SQLite path with URL overrides refused, verified pre-migration
  database snapshots, release isolation, maintenance during migration, and code
  recovery on failed post-activation checks.

This secures the delivery path; it is not a full audit of application authorization
or dependencies. Dependency advisories are package findings, not proof that every
issue is exploitable in this application.

## Verification and change record

### 2026-10-28 — Initial pipeline implementation

- Added the files listed above; extended `.gitignore` without reverting the
  owner's existing changes. No application source or dependency versions changed.
- Angular production build: **passed**, initial bundle 976.58 kB.
- Laravel suite: **17 passed, 349 assertions**, using local in-memory SQLite.
- `composer validate --strict --no-check-publish`: **passed**.
- Frontend suite: **blocked by existing guard import compilation error**.
- `composer audit --no-dev`: **failed**, 41 advisories across 11 packages.
- `npm audit --registry=https://registry.npmjs.org --omit=dev --audit-level=high`:
  **passed**, reported zero vulnerabilities for this local check. CI reruns it.
- Bash syntax, deployment input rejection checks, PHP entry-point syntax, and
  workflow/Dependabot YAML parsing: **passed**.
- Ubuntu mocked lifecycle checks: **passed** for successful activation, shared
  storage preservation, code recovery after a failed health check, maintenance
  cleanup after a failed migration, and checksum rejection before extraction.
- Linux release lifecycle tests use mocked PHP/HTTP commands; they validate
  orchestration only. They do not prove Hostinger web routing or real migrations.
- Live Hostinger access, server PHP/extensions, document-root symlink behavior,
  GitHub settings, production MySQL, and end-to-end deployment: **not verified**.

### 2026-10-28 — Approved blocker fixes

**Why deployment was blocked:** the guard test used an obsolete export name, and
the dependency lockfile pinned versions covered by current security advisories.
Once the guard test compiled, running the full suite exposed incomplete component
test providers and an obsolete Angular starter-template assertion. These failures
were previously hidden behind the compilation error.

Changes:

- Corrected the guard import and replaced its creation-only check with six checks
  covering unauthenticated access, accepted roles, and role-mismatch redirects.
- Added HTTP testing and router providers to affected component/service specs.
  HTTP calls stay inside Angular's testing backend; no live API is contacted.
- Updated the root component assertion to check the actual router outlet.
- Moved existing icon registrations into `frontend/src/app/app.icons.ts`, reused
  by the application and component tests. Registered four icons already referenced
  by templates: `FolderTree`, `PieChart`, `Tag`, and `TrendingUp`. The shared registry
  lets tests detect missing production registrations instead of masking them.
- Updated 13 PHP packages within existing version constraints using
  `composer update --with-all-dependencies --minimal-changes --no-scripts --no-interaction`.
  No package constraints or framework major versions changed. Composer also
  refreshed lockfile metadata. Local Composer lifecycle scripts were skipped to
  avoid running unrelated application hooks against the developer environment.

| Package | Before | After |
| --- | --- | --- |
| `laravel/framework` | 12.56.0 | 12.70.2 |
| `guzzlehttp/guzzle` | 7.10.0 | 7.16.1 |
| `guzzlehttp/promises` | 2.3.0 | 2.6.0 |
| `guzzlehttp/psr7` | 2.9.0 | 2.13.2 |
| `league/commonmark` | 2.8.2 | 2.10.4 |
| `league/flysystem` | 3.33.0 | 3.36.0 |
| `symfony/http-foundation` | 7.4.8 | 7.4.21 |
| `symfony/http-kernel` | 7.4.8 | 7.4.21 |
| `symfony/mailer` | 7.4.8 | 7.4.19 |
| `symfony/mime` | 7.4.8 | 7.4.19 |
| `symfony/polyfill-intl-idn` | 1.36.0 | 1.43.0 |
| `symfony/routing` | 7.4.8 | 7.4.21 |
| `symfony/yaml` | 7.4.8 | 7.4.21 |

Final local verification:

- Frontend suite: **34 passed**, using installed Edge in headless mode through
  Karma's `ChromeHeadless` launcher. CI uses Chrome on Ubuntu and still needs its
  first remote run. The local Playwright Chromium binary did not connect to Karma;
  switching the verification browser to Edge resolved that local launcher issue.
- Laravel suite after dependency updates: **17 passed, 349 assertions**, in-memory
  SQLite; production MySQL behavior remains unverified.
- Production Angular build: **passed**, initial bundle **977.66 kB**.
- `composer audit --no-dev`: **passed**, no vulnerability advisories reported for
  the installed production packages at verification time. The locked production
  dependency audit also passed.
- `composer validate --strict --no-check-publish` and
  `composer check-platform-reqs --no-dev`: **passed** on local PHP 8.3.33.
- Targeted whitespace checks on the edited tracked files: **passed**.

The pipeline still enforces tests and audits. It remains disabled pending the
Hostinger/GitHub setup; no commits, pushes, live deployments, or live database
changes were made by this work.

### 2026-10-29 — SSH connection setup

- User supplied SSH host `82.112.232.165`, port `65002`, and username `u891711850`.
  The application domain and live folder layout are still unconfirmed.
- A read-only SSH connection with batch authentication and strict host-key checking
  reached the SSH service but was refused with `Permission denied (publickey,password)`.
  No remote commands ran and no live files changed.
- Existing local known_hosts entries were accepted; their fingerprints were read
  locally. Their original provenance was not independently verified in this task.
- Created a dedicated local Ed25519 deployment key at
  `C:\Users\Rama-office\.ssh\id_ed25519_rama_hostinger`, outside the repository.
  Its public key is in the adjacent `.pub` file. The private key was not printed
  or committed. Public-key fingerprint:
  `SHA256:EvDRDIn46MBWt00I+HGYENfKhwXeHy1p8WokR/TtKog`.
- Next: add only that public key through Hostinger's SSH Access page, confirm the
  domain, then retry read-only SSH using the dedicated identity. The private key
  will later be entered directly into the GitHub production environment secret.
  Deployment remains disabled.

### 2026-10-29 — Dedicated-key access and live layout verified

- User confirmed the public key was added and supplied the application domain:
  `salmon-mule-212046.hostingersite.com`.
- Dedicated-key SSH authentication succeeded with strict host-key checking.
  Read-only inspection confirmed account home `/home/u891711850` and PHP CLI
  **8.3.36**, including PDO SQLite/MySQL, mbstring, XML/DOM, curl, zip, and fileinfo.
  Bash, curl, tar, sha256sum, realpath, flock, readlink, ln, and mv are available.
- Confirmed active Laravel root:
  `/home/u891711850/domains/salmon-mule-212046.hostingersite.com/public_html`.
  The root `.htaccess` rewrites requests into `public/`, and `public/index.php`
  loads the application from its parent directory. The nested public backend
  fallback does not exist. The separate `rama-app/artisan` is not selected by
  this entry point.
- Frontend assets are under `public_html/public`. `public_html` is currently a
  real directory, not the release symlink expected by the proposed layout.
  `/home/u891711850/apps/rama-cs` does not exist yet.
- Inspected only whitelisted non-secret configuration fields. The cached effective
  configuration confirms **SQLite**, **APP_ENV=local**, and **APP_DEBUG=true**.
  The database exists at
  `/home/u891711850/domains/salmon-mule-212046.hostingersite.com/public_html/database/database.sqlite`
  and was 339,968 bytes at inspection. No database contents were read or modified.
- Existing runtime/public directories have broad permissions (including 777), and
  `.env` is 644. Production preparation needs account-appropriate permissions
  after confirming the web PHP process ownership. No chmod was performed.
- The initial MySQL-only deployment plan does not match this live application.
  Recommended adjustment: preserve SQLite in private shared state, validate its
  absolute path, and use consistent SQLite backups before migrations. Do not switch
  database engines or copy an empty local database over the live file.
- Pending approval, adapt and test the pipeline for the existing database and
  document production-mode settings for cutover. Server filesystem changes,
  backups, migrations, GitHub secrets, symlink serving, web PHP settings, and
  end-to-end deployment remain pending. Inspection did not change live files.

### 2026-10-29 — Approved SQLite deployment adaptation

- Replaced the MySQL-only deployment guard with `deploy/sqlite.php`. It validates
  production mode, debug disabled, an existing application key, the SQLite driver,
  no `DB_URL` override, and the exact existing database at
  `/home/u891711850/apps/rama-cs/shared/database/database.sqlite`. A missing,
  zero-length, symlinked, relative, or release-local database is refused.
- Added a private `shared/backups` prerequisite. Deployment takes a new snapshot
  named after the release, using SQLite's backup API, before every migration.
  It checks integrity and the Laravel migrations table, applies mode `600`, and
  never overwrites a prior backup. Failed backup checks stop migration/activation
  and restore availability by leaving maintenance mode.
- Both first activation and later deployments enter maintenance before snapshots
  and migration. A failed health check still restores the previous **code** only;
  the shared database is never replaced during automatic code recovery.
- Added `sqlite3` to CI PHP extensions, packaged only the runtime SQLite helper
  outside the public directory, and added real SQLite tests to the existing CI
  checks. Updated the production environment example, actual GitHub connection
  settings, and the initial cutover instructions to preserve the live database.
- Actual temporary SQLite tests on local PHP: **passed** for production/path
  rejection, committed WAL data preservation, exclusion of uncommitted writes,
  snapshot independence, overwrite refusal, missing-source refusal, and rejection
  of a database without Laravel's migrations table. Linux-specific file-mode and
  symlink assertions are included for CI; local PHP runs on Windows.
- Ubuntu mocked release-lifecycle tests: **passed** for backup-before-migration
  ordering, shared data preservation, health-check code recovery, failed-migration
  maintenance cleanup, checksum rejection, backup-failure refusal, and invalid
  configuration refusal. These mocks exercise shell orchestration; the separate
  PHP tests exercise actual SQLite snapshot behavior.
- PHP/Bash syntax checks: **passed**. Workflow YAML and shell-block parsing:
  **passed**; the deployment enable gate remains intact.
- No live folders, configuration, permissions, databases, or application code were
  changed. No live backups, migrations, commits, pushes, or deployments ran. Server
  provisioning, a consistent initial database snapshot, GitHub setup, symlink
  serving verification, and the first end-to-end deployment remain pending.

### 2026-10-29 — Approved private folders and initial SQLite snapshot

- Created `/home/u891711850/apps/rama-cs` with private `incoming`, `releases`,
  `tools`, `shared/database`, `shared/backups`, and empty Laravel runtime storage
  directories. New deployment directories are mode `750`; database/backup
  directories are mode `700`. Existing public directories and permissions were
  not changed.
- Uploaded the reviewed SQLite helper to private `tools/sqlite.php`, verified its
  SHA-256 against the local source, and set mode `640`. It is outside the website's
  document root.
- Created the initial snapshot using SQLite's backup API, reading the **existing
  live database** and writing a new file without overwriting any database:
  `/home/u891711850/apps/rama-cs/shared/backups/initial-20261029T072455Z.sqlite`.
  It is **339,968 bytes**, mode **600**, passes `PRAGMA quick_check`, and contains
  the Laravel migrations table. No customer/ticket records were printed.
- Downloaded an off-host copy to the Git-ignored local path
  `.tmp/hostinger-deployment-backups/initial-20261029T072455Z.sqlite`. Its SHA-256
  matches the server snapshot and its local integrity check passes:
  `a6fe02864dfd3f2e512f3f9f062edb669ddb005d321f889d6ba121b5be26ca2a`.
- The live application remains on its original folders, database, and cached
  configuration. No maintenance mode, migrations, production configuration edits,
  document-root changes, commits, pushes, or release deployments were performed.
- **This initial snapshot is not the final cutover database.** The site can keep
  accepting writes after the snapshot. `shared/database/database.sqlite` remains
  absent intentionally; create it from a fresh snapshot only after pausing writes
  during the approved cutover window. Do not deploy using today's stale backup.
- Pending: reviewed changes in GitHub with passing CI, production environment and
  secrets, web PHP/symlink serving verification, production `.env` preparation,
  final storage/database transfer, and the first controlled deployment. GitHub
  account administration is not available through a connected tool in this
  session, and the GitHub CLI is not installed locally.

### 2026-10-29 — GitHub production environment setup started

- User authorized configuration of GitHub's `production` environment.
- Verified repository `ramawaterfilter/rama-cs-app` is public and its default branch
  is `main`. The locally saved GitHub credential has pull access only and no admin
  permission, so it cannot configure environments or secrets.
- Opened the repository environment settings in the connected browser. The browser
  is signed out; repository admin authentication is required to continue. No
  environment, secret, variable, or branch policy has been created yet.
- Prepared `.tmp/hostinger-deploy-known_hosts` from the pre-existing local trusted
  SSH host entries. The file is Git-ignored; live SSH checks already matched those
  entries with strict host-key checking. Independent fingerprint provenance is
  still as recorded in the earlier SSH setup notes.
- Intended configuration: environment `production`, only branch `main` allowed,
  the five `HOSTINGER_SSH_*` environment secrets and two environment variables
  listed above, and repository variable `HOSTINGER_DEPLOY_ENABLED=false` until
  cutover. Do not enable live deployment as part of environment configuration.
- Private key values have not been displayed, placed in documentation, or sent to
  GitHub during this authentication check. No live application files changed.
- User chose to configure GitHub manually with guidance. The admin sign-in request
  is no longer needed for agent-driven setup. Completion remains unverified until
  the user confirms the environment, branch rule, secrets, and variables are saved.
  To paste sensitive material without displaying it in chat, run locally:

  ```powershell
  # Paste into HOSTINGER_SSH_PRIVATE_KEY in GitHub only.
  Get-Content -Raw "$env:USERPROFILE\.ssh\id_ed25519_rama_hostinger" | Set-Clipboard

  # Paste into HOSTINGER_SSH_KNOWN_HOSTS in GitHub.
  Get-Content -Raw "C:\Users\Rama-office\Downloads\nice code\CS-application-for-rama\.tmp\hostinger-deploy-known_hosts" | Set-Clipboard
  ```

  Run these commands separately, pasting/saving the matching secret after each.
  The clipboard command does not send private key contents to the assistant.

### 2026-10-30 — GitHub environment confirmed; first CI publication pending

- User confirmed completion of the manual GitHub configuration instructions,
  including the requested `HOSTINGER_DEPLOY_ENABLED=false` repository variable.
  Secret/variable values are user-reported, not independently verified; secret
  values are never readable back from GitHub.
- Public GitHub API checks verified environment `production`, custom deployment
  branch policies enabled, and exactly one allowed rule: branch `main`.
- GitHub reports **zero registered workflows**. Remote `main` remains at
  `6a286263623225530e68e23b87aa16b6efd33937`; the local working branch
  `replace-application-code` has not been published.
- The working folder contains substantial pre-existing application edits and
  deletions as well as this task's CI/CD changes. Asked the user whether the first
  reviewed publication should include the current application updates or isolate
  CI/CD changes. Do not silently include unrelated owner changes in a commit.
- No files were staged or committed, no branch was pushed, no Actions run was
  triggered, and the live site was not changed during this check.

### 2026-10-30 — Application publication scope and data-preservation review

- User approved including **current application updates plus CI/CD**, while asking
  explicitly about reverting releases and protecting database data. Publication
  is intended for the review branch, not a live deployment or merge to `main`.
- Read-only inspection of the live SQLite migration metadata found 38 applied
  migrations and two pending local migrations: creating `logistics_reasons` and
  adding nullable `last_updated_by` to `customer_tickets`. The live database
  passed `PRAGMA quick_check`; no live migrations were run.
- Rehearsed those two migrations on a **disposable copy** of the verified
  `initial-20261029T072455Z.sqlite` snapshot. Both completed, the clone passed its
  integrity check, and fingerprints of all original columns confirmed that all
  **1,119 existing rows across 26 tables** were preserved. The original snapshot
  checksum stayed unchanged. This validates yesterday's snapshot, not future
  production writes or every application workflow.
- The `last_updated_by` migration has an empty `down()` method. Reverting code or
  calling `migrate:rollback` does not remove that column; do not rely on automatic
  schema rollback. Current pending migrations are additive. A fresh backup and
  paused writes are still required for the actual cutover.
- Prepared `.tmp/publication-review.json`: include tracked application changes
  and 29 new source/configuration files; exclude 18 local helper/reference files.
  Git-ignored private keys, databases, backups, logs, and deployment archives are
  not publication inputs. A bounded private-key/token marker check passed; it is
  not a complete repository security audit.
- Refreshed frontend checks: **34 tests passed** and production build passed at
  **977.66 kB**. Backend checks after the final dependency refresh: **17 tests,
  349 assertions passed**; real SQLite deployment tests and mocked Ubuntu recovery
  checks passed. Composer manifest validation passed.
- A refreshed Composer audit identified revised coverage for
  [CVE-2026-45070](https://symfony.com/cve-2026-45070). Updated `symfony/mime` from
  `7.4.19` to compatible fixed version `7.4.22`, with no application lifecycle
  scripts. The final Composer update reported no advisories; npm's production
  audit also reported zero vulnerabilities. Staged files were checked to exclude
  private runtime files and local helpers. Production gates remain intact: the
  deploy job requires `main`, a non-PR event, and the explicit enable variable.
- Publication target: `replace-application-code` for review, with **no merge to
  main or Hostinger switch**. Open a pull request into `main` to trigger CI before
  any deployment preparation proceeds. No live database changes were performed
  during migration review, dependency updates, or local verification.
- Published application/CI/CD commit
  `baeac0613198e950eab251c5ab4f9d530c563273` to `origin/replace-application-code`.
  The existing `main` commit remains unchanged. A pull request and the first
  observed GitHub CI run are still pending. Create the review pull request at
  <https://github.com/ramawaterfilter/rama-cs-app/pull/new/replace-application-code>.
  Deployment remains gated; this branch publication did not alter the live site
  or database. Local helper/reference files remain untracked and were not pushed.

## References

- [Hostinger SSH access](https://www.hostinger.com/support/1583645-how-to-enable-ssh-access-in-hostinger/)
- [Hostinger symlink requirements](https://www.hostinger.com/support/1583694-how-to-create-a-symlink-at-hostinger/)
- [GitHub secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [PHP SQLite3 backup API](https://www.php.net/manual/en/sqlite3.backup.php)
- [SQLite snapshot/backup behavior](https://www.sqlite.org/backup.html)

## Frontend security update — 2026-10-31
- Upgraded Angular from 18 through 19 and 20 to 21.
- Updated vulnerable dependencies, including SheetJS from its official distribution.
- Fixed date fallback expressions and loaded Excel export dynamically.
- Validation: production build passed; 34 tests passed; production npm audit reported 0 vulnerabilities.
- User confirmed Excel and PDF exports work.
- Remaining warning: unused RouterLink in LoginComponent.
