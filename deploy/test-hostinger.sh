#!/usr/bin/env bash
# No network or production credentials: exercise refusal paths and Linux release recovery.
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/hostinger.sh
commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
release_id="$commit-100-1"
checksum=$(printf x | sha256sum | cut -d ' ' -f 1)
reject() {
    if bash "$script" "$@" >/dev/null 2>&1; then
        printf 'FAIL: unsafe arguments accepted\n' >&2
        exit 1
    fi
}
reject
reject /home/account/../other "$release_id" https://example.test "$checksum"
reject /home/account/app 'bad;id' https://example.test "$checksum"
reject /home/account/app "$release_id" http://example.test "$checksum"
reject /home/account/app "$release_id" 'https://example.test/;id' "$checksum"
reject /home/account/app "$release_id" https://example.test not-a-checksum
printf 'PASS: invalid deployment input rejected\n'

# Hostinger and the GitHub runner use Linux homes. Other systems run syntax/input checks.
if [[ "$HOME" != /home/* ]]; then
    printf 'SKIP: release lifecycle fixtures require a Linux /home account\n'
    exit 0
fi
fixture=$(mktemp -d "$HOME/hostinger-test.XXXXXX")
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/app/"{incoming,releases/old,shared/storage/framework,shared/database,shared/backups}
root="$fixture/app"
touch "$root/shared/.env" "$root/releases/old/artisan"
printf 'existing database contents' > "$root/shared/database/database.sqlite"
ln -s "$root/releases/old" "$root/current"
mkdir -p "$fixture/payload/"{public,vendor,bootstrap/cache,deploy}
touch "$fixture/payload/artisan" "$fixture/payload/public/index.html" "$fixture/payload/vendor/autoload.php"
touch "$fixture/payload/deploy/sqlite.php"
cat > "$fixture/bin/php" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ "$1" == artisan ]]; then
    case "$2" in
        down) touch storage/framework/down ;;
        up) rm -f storage/framework/down ;;
        migrate) printf 'migrate\n' >> "$MOCK_LOG"; [[ "${FAIL_MIGRATION:-0}" != 1 ]] ;;
    esac
elif [[ "$1" == deploy/sqlite.php ]]; then
    [[ -s "$3/shared/database/database.sqlite" ]] || exit 1
    [[ "${FAIL_VALIDATION:-0}" != 1 ]] || exit 1
    if [[ "$2" == backup ]]; then
        [[ "${FAIL_BACKUP:-0}" != 1 ]] || exit 1
        cp "$3/shared/database/database.sqlite" "$3/shared/backups/$4.sqlite"
        printf 'backup\n' >> "$MOCK_LOG"
    fi
elif [[ "$1" == -r && "$2" == *stream_get_contents* ]]; then
    cat >/dev/null
fi
MOCK
cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
[[ "${FAIL_HEALTH:-0}" != 1 ]] || exit 22
printf '{}'
MOCK
chmod +x "$fixture/bin/"*
export PATH="$fixture/bin:$PATH"
export MOCK_LOG="$fixture/actions.log"
# Normalized so the extracted-mode assertions below test hostinger.sh's umask,
# not whatever umask the runner happened to have.
chmod 755 "$fixture/payload/public"
chmod 644 "$fixture/payload/public/index.html"
package() {
    tar -czf "$root/incoming/$release_id.tar.gz" -C "$fixture/payload" .
    checksum=$(sha256sum "$root/incoming/$release_id.tar.gz" | cut -d ' ' -f 1)
}
package
bash "$script" "$root" "$release_id" https://example.test "$checksum"
[[ "$(readlink -f "$root/current")" == "$root/releases/$release_id" ]]
[[ "$(readlink -f "$root/previous")" == "$root/releases/old" ]]
[[ "$(readlink -f "$root/releases/$release_id/storage")" == "$root/shared/storage" ]]
[[ "$(readlink -f "$root/releases/$release_id/public/storage")" == "$root/shared/storage/app/public" ]]
[[ -d "$root/shared/storage/app/public" ]]
[[ "$(stat -c %a "$root/releases/$release_id/public")" == 755 ]]
[[ "$(stat -c %a "$root/releases/$release_id/public/index.html")" == 644 ]]
[[ "$(stat -c %a "$root/shared/.env")" == 644 ]]
[[ ! -e "$root/shared/storage/framework/down" ]]
[[ "$(cat "$MOCK_LOG")" == $'backup\nmigrate' ]]
cmp "$root/shared/database/database.sqlite" "$root/shared/backups/$release_id.sqlite"
printf 'PASS: successful deployment preserves shared state and backs up before migration\n'

healthy="$root/releases/$release_id"
release_id="$commit-101-1"
package
if FAIL_HEALTH=1 bash "$script" "$root" "$release_id" https://example.test "$checksum"; then
    printf 'FAIL: unhealthy deployment succeeded\n' >&2; exit 1
fi
[[ "$(readlink -f "$root/current")" == "$healthy" ]]
[[ ! -e "$root/shared/storage/framework/down" ]]
printf 'PASS: failed health check restores previous code\n'

release_id="$commit-102-1"
package
if FAIL_MIGRATION=1 bash "$script" "$root" "$release_id" https://example.test "$checksum"; then
    printf 'FAIL: failed migration succeeded\n' >&2; exit 1
fi
[[ "$(readlink -f "$root/current")" == "$healthy" ]]
[[ ! -e "$root/shared/storage/framework/down" ]]
printf 'PASS: failed migration leaves previous code active and exits maintenance\n'

release_id="$commit-103-1"
package
reject "$root" "$release_id" https://example.test "${checksum//?/0}"
[[ ! -e "$root/releases/$release_id" ]]
printf 'PASS: corrupt archive refused before extraction\n'

release_id="$commit-104-1"
package
: > "$MOCK_LOG"
if FAIL_BACKUP=1 bash "$script" "$root" "$release_id" https://example.test "$checksum"; then
    printf 'FAIL: deployment continued after backup failure\n' >&2; exit 1
fi
[[ ! -s "$MOCK_LOG" ]]
[[ "$(readlink -f "$root/current")" == "$healthy" ]]
[[ ! -e "$root/shared/storage/framework/down" ]]
printf 'PASS: failed backup prevents migration and activation and exits maintenance\n'

release_id="$commit-105-1"
package
if FAIL_VALIDATION=1 bash "$script" "$root" "$release_id" https://example.test "$checksum"; then
    printf 'FAIL: invalid production configuration accepted\n' >&2; exit 1
fi
[[ ! -s "$MOCK_LOG" ]]
[[ "$(readlink -f "$root/current")" == "$healthy" ]]
[[ ! -e "$root/shared/storage/framework/down" ]]
printf 'PASS: configuration refusal leaves the current site untouched\n'
