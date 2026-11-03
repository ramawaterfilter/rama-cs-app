<?php

namespace Database\Seeders;

use App\Models\QueryCategory;
use App\Models\QueryType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Imports database/data/customer-categories.csv (RAMA Customer Category Sheet).
 * Columns: Type of Query, Query Category, Sub Category, Child Category.
 * Merges into existing data (tickets keep their category references); re-runnable.
 */
class CustomerCategoryCsvSeeder extends Seeder
{
    /** @var array<string, QueryCategory> */
    private array $nodes = [];

    public function run(): void
    {
        $stream = fopen(database_path('data/customer-categories.csv'), 'r');
        if (!$stream) {
            $this->command->error('database/data/customer-categories.csv not found.');
            return;
        }

        $rows = [];
        try {
            fgetcsv($stream, null, ',', '"', ''); // header
            while (($fields = fgetcsv($stream, null, ',', '"', '')) !== false) {
                if (count($fields) < 4) {
                    continue;
                }
                [$typeName, $catName, $subName, $childName] = array_map('trim', $fields);
                if ($typeName === '' || $catName === '' || $subName === '' || $childName === '') {
                    continue;
                }
                $rows[] = [$typeName, $catName, $subName, $childName];
            }
        } finally {
            fclose($stream);
        }

        $created = 0;
        DB::transaction(function () use ($rows, &$created) {
            foreach ($rows as [$typeName, $catName, $subName, $childName]) {
                $type = QueryType::firstOrCreate(['name' => $typeName], ['is_active' => true]);
                $category = $this->node($type, 'category', $catName, $created);
                $subcategory = $this->node($type, 'subcategory', $subName, $created);
                $child = $this->node($type, 'child', $childName, $created);
                $subcategory->parents()->syncWithoutDetaching([$category->id]);
                $child->parents()->syncWithoutDetaching([$subcategory->id]);
            }
        });

        $this->command->info(count($rows)." CSV rows imported ($created categories created).");
    }

    /**
     * One node per (query type, level, name) — same name under different parents
     * becomes a single row with multiple parents, matching the app's uniqueness rule.
     */
    private function node(QueryType $type, string $level, string $name, int &$created): QueryCategory
    {
        $key = "{$type->id}:{$level}:{$name}";
        if (isset($this->nodes[$key])) {
            return $this->nodes[$key];
        }
        $node = QueryCategory::firstOrCreate([
            'name' => $name,
            'type' => $level,
            'query_type_id' => $type->id,
        ]);
        if ($node->wasRecentlyCreated) {
            $created++;
        }
        return $this->nodes[$key] = $node;
    }
}
