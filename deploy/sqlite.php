<?php

declare(strict_types=1);

namespace Deployment;

use RuntimeException;
use SQLite3;
use Throwable;

function databasePath(string $root, array $config): string
{
    if (($config['app']['env'] ?? null) !== 'production'
        || ($config['app']['debug'] ?? true) !== false
        || empty($config['app']['key'])
        || ($config['database']['default'] ?? null) !== 'sqlite'
        || !empty($config['database']['connections']['sqlite']['url'])) {
        throw new RuntimeException('Production mode, APP_DEBUG=false, existing APP_KEY, SQLite, and no DB_URL override are required.');
    }

    $expected = $root.'/shared/database/database.sqlite';
    if (($config['database']['connections']['sqlite']['database'] ?? null) !== $expected
        || str_replace('\\', '/', (string) realpath($expected)) !== $expected || is_link($expected)
        || !is_file($expected) || filesize($expected) === 0) {
        throw new RuntimeException('DB_DATABASE must point to the existing, nonempty shared/database/database.sqlite file; symlinks and release-local databases are refused.');
    }

    return $expected;
}

function backupDatabase(string $source, string $destination): void
{
    // Read-only opening must not create an empty database if the source is missing.
    $database = new SQLite3($source, SQLITE3_OPEN_READONLY);
    $database->enableExceptions(true);
    $database->busyTimeout(10000);
    $backup = null;
    $reserved = @fopen($destination, 'x');
    if ($reserved === false) {
        $database->close();
        throw new RuntimeException('Cannot create a new backup; existing backups are never overwritten.');
    }
    fclose($reserved);

    try {
        if (!chmod($destination, 0600)) {
            throw new RuntimeException('Cannot restrict backup permissions.');
        }
        $backup = new SQLite3($destination, SQLITE3_OPEN_READWRITE);
        $backup->enableExceptions(true);
        $backup->busyTimeout(10000);
        // SQLite's backup API includes committed WAL data; a plain file copy may not.
        if (!$database->backup($backup)
            || $backup->querySingle('PRAGMA quick_check') !== 'ok'
            || (int) $backup->querySingle("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migrations'") !== 1) {
            throw new RuntimeException('SQLite snapshot failed integrity or Laravel schema validation.');
        }
    } catch (Throwable $error) {
        $backup?->close();
        $backup = null;
        unlink($destination);
        throw $error;
    } finally {
        $backup?->close();
        $database->close();
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}

umask(0077);
try {
    if (!in_array($argv[1] ?? '', ['validate', 'backup'], true) || $argc < 3) {
        throw new RuntimeException('Usage: php deploy/sqlite.php validate|backup ROOT [RELEASE_ID]');
    }
    $root = $argv[2];
    require dirname(__DIR__).'/vendor/autoload.php';
    $app = require dirname(__DIR__).'/bootstrap/app.php';
    $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $database = databasePath($root, $app['config']->all());
    if ($argv[1] === 'backup') {
        $id = $argv[3] ?? '';
        if (!preg_match('/\A[a-f0-9]{40}-[0-9]+-[0-9]+\z/', $id)
            || realpath($root.'/shared/backups') !== $root.'/shared/backups'
            || is_link($root.'/shared/backups')) {
            throw new RuntimeException('Invalid backup directory or release ID.');
        }
        $destination = $root.'/shared/backups/'.$id.'.sqlite';
        backupDatabase($database, $destination);
        fwrite(STDOUT, 'Verified pre-migration SQLite backup: '.$destination.PHP_EOL);
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Deployment refused: '.$error->getMessage().PHP_EOL);
    exit(1);
}
