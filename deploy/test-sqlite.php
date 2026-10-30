<?php

declare(strict_types=1);

require __DIR__.'/sqlite.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function refuses(callable $operation): void
{
    try {
        $operation();
    } catch (Throwable) {
        return;
    }
    throw new RuntimeException('Unsafe operation was accepted.');
}

umask(0077);
$fixture = sys_get_temp_dir().'/rama-deploy-sqlite-'.bin2hex(random_bytes(8));
mkdir($fixture.'/shared/database', 0700, true);
mkdir($fixture.'/shared/backups', 0700, true);
$root = str_replace('\\', '/', (string) realpath($fixture));
$source = $root.'/shared/database/database.sqlite';
$destination = $root.'/shared/backups/release.sqlite';
$database = null;
$snapshot = null;
try {
    $database = new SQLite3($source);
    $database->enableExceptions(true);
    $database->exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0');
    $database->exec('CREATE TABLE migrations (id INTEGER); CREATE TABLE tickets (id INTEGER, title TEXT)');
    $database->exec("INSERT INTO tickets VALUES (1, 'preserve existing ticket')");
    check(is_file($source.'-wal') && filesize($source.'-wal') > 0, 'Expected committed data in WAL.');

    $config = [
        'app' => ['env' => 'production', 'debug' => false, 'key' => 'test-only-key'],
        'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['database' => $source, 'url' => null]]],
    ];
    check(Deployment\databasePath($root, $config) === $source, 'Valid shared database rejected.');
    foreach ([':memory:', 'database/database.sqlite', $root.'/releases/new/database.sqlite', $source.'-missing'] as $badPath) {
        $bad = $config;
        $bad['database']['connections']['sqlite']['database'] = $badPath;
        refuses(fn () => Deployment\databasePath($root, $bad));
    }
    foreach ([['app', 'debug', true], ['app', 'env', 'local'], ['app', 'key', ''], ['database', 'default', 'mysql']] as [$section, $key, $value]) {
        $bad = $config;
        $bad[$section][$key] = $value;
        refuses(fn () => Deployment\databasePath($root, $bad));
    }
    $bad = $config;
    $bad['database']['connections']['sqlite']['url'] = 'sqlite:///other.sqlite';
    refuses(fn () => Deployment\databasePath($root, $bad));
    touch($root.'/empty.sqlite');
    $badRoot = $root.'/empty-root';
    mkdir($badRoot.'/shared/database', 0700, true);
    touch($badRoot.'/shared/database/database.sqlite');
    $bad = $config;
    $bad['database']['connections']['sqlite']['database'] = $badRoot.'/shared/database/database.sqlite';
    refuses(fn () => Deployment\databasePath($badRoot, $bad));
    if (PHP_OS_FAMILY !== 'Windows') {
        $linkRoot = $root.'/linked-root';
        mkdir($linkRoot.'/shared/database', 0700, true);
        symlink($source, $linkRoot.'/shared/database/database.sqlite');
        $bad['database']['connections']['sqlite']['database'] = $linkRoot.'/shared/database/database.sqlite';
        refuses(fn () => Deployment\databasePath($linkRoot, $bad));
    }
    echo "PASS: production configuration and shared SQLite path validation\n";

    $database->exec("BEGIN IMMEDIATE; INSERT INTO tickets VALUES (99, 'uncommitted')");
    Deployment\backupDatabase($source, $destination);
    $snapshot = new SQLite3($destination, SQLITE3_OPEN_READONLY);
    check($snapshot->querySingle('SELECT title FROM tickets WHERE id = 1') === 'preserve existing ticket', 'Backup lost WAL data.');
    check((int) $snapshot->querySingle('SELECT COUNT(*) FROM tickets') === 1, 'Backup included uncommitted data.');
    check($snapshot->querySingle('PRAGMA quick_check') === 'ok', 'Backup is not valid SQLite.');
    $database->exec('ROLLBACK');
    $database->exec("INSERT INTO tickets VALUES (2, 'newer ticket')");
    check((int) $snapshot->querySingle('SELECT COUNT(*) FROM tickets') === 1, 'Backup changed after source write.');
    check((int) $database->querySingle('SELECT COUNT(*) FROM tickets') === 2, 'Source database was damaged.');
    refuses(fn () => Deployment\backupDatabase($source, $destination));
    if (PHP_OS_FAMILY !== 'Windows') {
        check((fileperms($destination) & 0777) === 0600, 'Backup permissions are too broad.');
    }
    echo "PASS: WAL snapshot preserves committed data, stays independent, and cannot be overwritten\n";

    refuses(fn () => Deployment\backupDatabase($source.'-missing', $destination.'-missing'));
    check(!file_exists($source.'-missing'), 'Missing source was silently created.');
    $empty = new SQLite3($root.'/empty.sqlite');
    $empty->exec('CREATE TABLE unrelated (id INTEGER)');
    $empty->close();
    refuses(fn () => Deployment\backupDatabase($root.'/empty.sqlite', $destination.'-invalid'));
    check(!file_exists($destination.'-invalid'), 'Invalid snapshot was retained.');
    echo "PASS: missing source and non-Laravel database rejected\n";
} finally {
    $snapshot?->close();
    $database?->close();
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fixture, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        $file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    }
    rmdir($fixture);
}
