#!/usr/bin/env bash
# Run over SSH: bash hostinger.sh ROOT RELEASE_ID HTTPS_URL ARCHIVE_SHA256
set -euo pipefail
# The web process runs as a different OS user with no shared group and no ACLs on
# this host, so runtime files must be world-readable; HOME's mode gates everyone else.
umask 022

fail() { printf 'Deployment refused: %s\n' "$*" >&2; exit 1; }
[[ $# == 4 ]] || fail 'expected root, release ID, HTTPS URL, and SHA-256'
root=$1
release_id=$2
site_url=$3
checksum=$4
[[ "$root" =~ ^/home/[a-zA-Z0-9_./-]+$ ]] || fail 'invalid deployment root'
[[ "/$root/" != *'/../'* && "/$root/" != *'/./'* ]] || fail 'relative path segments'
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || fail 'invalid release ID'
[[ "$site_url" =~ ^https://[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || fail 'expected HTTPS origin without trailing slash'
[[ "$checksum" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid checksum'
[[ -d "$root" && ! -L "$root" ]] || fail 'deployment root must be a real directory'
root=$(realpath "$root")
[[ "$root" == "$HOME/"* && "$root" != *'/public_html'* ]] || fail 'root must be private and inside the SSH home'
for command in php curl tar sha256sum flock ln mv; do
    command -v "$command" >/dev/null || fail "missing command: $command"
done
[[ -d "$root/releases" && -d "$root/shared/storage" && -d "$root/shared/backups" && -f "$root/shared/.env" ]] || fail 'complete the one-time server setup first'
[[ ! -L "$root/releases" && ! -L "$root/shared" ]] || fail 'shared and releases must be real directories'
exec 9>"$root/deploy.lock"
flock -n 9 || fail 'another deployment is running'

previous=''
if [[ -e "$root/current" || -L "$root/current" ]]; then
    [[ -L "$root/current" ]] || fail 'current must be a symlink'
    previous=$(readlink -f "$root/current")
    [[ "$previous" == "$root/releases/"* && -f "$previous/artisan" ]] || fail 'invalid current release'
    [[ ! -f "$root/shared/storage/framework/down" ]] || fail 'site is already in maintenance mode'
fi
archive="$root/incoming/$release_id.tar.gz"
release="$root/releases/$release_id"
[[ -f "$archive" && ! -e "$release" ]] || fail 'archive missing or release already exists'
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status || fail 'archive checksum mismatch'
mkdir "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
[[ -f "$release/artisan" && -f "$release/public/index.html" && -f "$release/vendor/autoload.php" && -f "$release/deploy/sqlite.php" ]] || fail 'incomplete release'
[[ ! -e "$release/.env" && ! -e "$release/storage" && ! -e "$release/public/storage" ]] || fail 'archive contains runtime state'
ln -s "$root/shared/.env" "$release/.env"
ln -s "$root/shared/storage" "$release/storage"
# A fresh release has no public/storage link, so uploads would 404 after activation.
mkdir -p "$release/storage/app/public"
ln -s "$root/shared/storage/app/public" "$release/public/storage"
mkdir -p "$release/bootstrap/cache"
# Same constraint: the web process must read .env, and only it can traverse HOME.
chmod 644 "$root/shared/.env"
cd "$release"
php deploy/sqlite.php validate "$root"
php artisan config:cache
php artisan view:cache

activated=false
maintenance=false
finish() {
    status=$?
    trap - EXIT
    if (( status != 0 )); then
        if $activated; then
            if [[ -n "$previous" ]]; then
                ln -s "$previous" "$root/current.restore"
                mv -Tf "$root/current.restore" "$root/current"
                printf 'Restored previous code release. Database changes were NOT reversed.\n' >&2
            else
                rm -f "$root/current"
                printf 'First activation failed; current link removed.\n' >&2
            fi
        fi
    fi
    if $maintenance; then
        if ! php artisan up; then
            printf 'Could not exit maintenance mode; run artisan up after inspection.\n' >&2
            status=1
        fi
    fi
    exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Shared storage makes the maintenance flag visible to both releases.
maintenance=true
php artisan down --retry=30
# Fail before migrations if a consistent, verified snapshot cannot be created.
php deploy/sqlite.php backup "$root" "$release_id"
# Never seed, regenerate APP_KEY, reset tables, or automatically reverse migrations.
php artisan migrate --force
ln -s "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
activated=true
php artisan up
maintenance=false

# Verify the actual release through HTTPS, then exercise Laravel and a DB-backed API.
curl --fail --silent --show-error --retry 3 --retry-delay 3 --max-time 30 \
    "$site_url/release.json?release=$release_id" | \
    php -r '$data=json_decode(stream_get_contents(STDIN), true); exit(($data["commit"] ?? "") === $argv[1] ? 0 : 1);' "${release_id:0:40}"
curl --fail --silent --show-error --retry 3 --retry-delay 3 --max-time 30 "$site_url/up" -o /dev/null
curl --fail --silent --show-error --retry 3 --retry-delay 3 --max-time 30 \
    -H 'Accept: application/json' "$site_url/api/categories/public" | \
    php -r 'json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);'
if [[ -n "$previous" ]]; then
    ln -s "$previous" "$root/previous.next"
    mv -Tf "$root/previous.next" "$root/previous"
fi
rm -f "$archive"
printf 'Deployment healthy: %s\n' "$release_id"
