<?php
// backend/migrate_data.php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Schema;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// 1. Force the SQLite connection to point to the correct file
$sqlitePath = database_path('database.sqlite');
Config::set('database.connections.sqlite.database', $sqlitePath);

// List of tables to skip (Laravel internal tables)
$skipTables = ['migrations', 'personal_access_tokens', 'sessions', 'cache', 'cache_locks'];

// Get all tables from SQLite
try {
    $tables = DB::connection('sqlite')->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
} catch (\Exception $e) {
    die("Error: Could not connect to SQLite at $sqlitePath. " . $e->getMessage());
}

// 2. Disable Foreign Key Checks in MySQL
DB::connection('mysql')->statement('SET FOREIGN_KEY_CHECKS=0;');

foreach ($tables as $table) {
    $tableName = $table->name;
    if (in_array($tableName, $skipTables))
        continue;

    // Check if MySQL table exists
    if (!Schema::connection('mysql')->hasTable($tableName)) {
        echo "Skipping table: $tableName (does not exist in MySQL)\n";
        continue;
    }

    echo "Migrating table: $tableName... ";

    // Get data from SQLite
    $rows = DB::connection('sqlite')->table($tableName)->get();

    if ($rows->count() > 0) {
        // Get columns that actually exist in MySQL for this table
        $mysqlColumns = Schema::connection('mysql')->getColumnListing($tableName);

        // Clear MySQL table
        DB::connection('mysql')->table($tableName)->truncate();

        // Filter each row to only include columns that exist in MySQL
        $data = collect(json_decode(json_encode($rows), true))->map(function ($row) use ($mysqlColumns) {
            return array_intersect_key($row, array_flip($mysqlColumns));
        })->toArray();

        DB::connection('mysql')->table($tableName)->insert($data);
        echo "Done (" . $rows->count() . " rows)\n";
    } else {
        echo "Empty, skipped.\n";
    }
}

// 3. Re-enable Foreign Key Checks
DB::connection('mysql')->statement('SET FOREIGN_KEY_CHECKS=1;');

echo "\nMigration Complete! Your data is now in MySQL.\n";
echo "Remember to delete this file after you are done!\n";
