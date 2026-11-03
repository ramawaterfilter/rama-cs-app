<?php

namespace Tests\Feature;

use App\Models\QueryCategory;
use App\Models\QueryType;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CategoryBulkTest extends TestCase
{
    use RefreshDatabase;

    private function upload(string $rows, bool $apply = false)
    {
        return $this->postJson('/api/categories/bulk', [
            'file' => UploadedFile::fake()->createWithContent('categories.csv', "id,name,type,query_type_id,parent_ids\n".$rows),
            'apply' => $apply ? '1' : '0',
        ]);
    }

    private function category(): QueryCategory
    {
        $this->actingAs(User::factory()->create());
        $type = QueryType::create(['name' => 'Support']);
        return QueryCategory::create(['name' => 'Original', 'type' => 'category', 'query_type_id' => $type->id]);
    }

    public function test_preview_does_not_write_and_apply_updates_and_creates_with_parents(): void
    {
        $category = $this->category();
        $rows = "$category->id,Renamed,category,$category->query_type_id,\n,Delivery,subcategory,$category->query_type_id,$category->id\n";
        $this->upload($rows)->assertOk()->assertJsonPath('rows.1.action', 'Create');
        $this->assertDatabaseCount('query_categories', 1);
        $this->assertSame('Original', $category->fresh()->name);
        $this->assertDatabaseCount('user_activities', 0);
        $this->upload($rows, true)->assertOk();
        $this->assertSame('Renamed', $category->fresh()->name);
        $this->assertDatabaseCount('query_categories', 2);
        $this->assertDatabaseHas('category_relationships', ['parent_id' => $category->id,
            'child_id' => QueryCategory::where('name', 'Delivery')->value('id')]);
        $this->assertDatabaseCount('user_activities', 2);
    }

    public function test_invalid_later_row_prevents_all_writes(): void
    {
        $category = $this->category();
        $this->upload("$category->id,Changed,category,$category->query_type_id,\n,Invalid,child,999999,\n", true)
            ->assertUnprocessable()->assertJsonValidationErrors('row.3');
        $this->assertSame('Original', $category->fresh()->name);
        $this->assertDatabaseCount('query_categories', 1);
        $this->assertDatabaseCount('user_activities', 0);
    }

    public function test_save_exception_rolls_back_categories_links_and_audit(): void
    {
        $category = $this->category();
        $writes = 0;
        UserActivity::creating(function () use (&$writes) {
            if (++$writes === 2) {
                throw new \RuntimeException('Simulated audit failure');
            }
        });
        try {
            $this->upload("$category->id,Changed,category,$category->query_type_id,\n,Delivery,subcategory,$category->query_type_id,$category->id\n", true)
                ->assertStatus(500);
            $this->assertSame('Original', $category->fresh()->name);
            $this->assertDatabaseCount('query_categories', 1);
            $this->assertDatabaseCount('category_relationships', 0);
            $this->assertDatabaseCount('user_activities', 0);
        } finally {
            UserActivity::flushEventListeners();
        }
    }

    public function test_rejects_duplicates_unknown_ids_and_invalid_parent_changes(): void
    {
        $category = $this->category();
        $child = QueryCategory::create(['name' => 'Delivery', 'type' => 'subcategory', 'query_type_id' => $category->query_type_id]);
        $child->parents()->attach($category->id);
        foreach ([
            ",Original,category,$category->query_type_id,\n",
            "999999,Unknown,category,$category->query_type_id,\n",
            "$category->id,Original,child,$category->query_type_id,\n",
            "$child->id,Delivery,subcategory,$category->query_type_id,$child->id\n",
            "$category->id,Original,category,$category->query_type_id,\n$category->id,Other,category,$category->query_type_id,\n",
        ] as $rows) {
            $this->upload($rows, true)->assertUnprocessable();
        }
        $this->assertSame('category', $category->fresh()->type);
        $this->assertDatabaseCount('user_activities', 0);
    }

    public function test_rejects_bad_headers_empty_files_and_malformed_quoting(): void
    {
        $category = $this->category();
        $this->upload('')->assertUnprocessable();
        $this->upload(",\"Unclosed,category,$category->query_type_id,\n")->assertUnprocessable();
        $this->postJson('/api/categories/bulk', ['file' => UploadedFile::fake()->createWithContent('bad.csv', "wrong,headers\n")])
            ->assertUnprocessable();
        $this->assertDatabaseCount('query_categories', 1);
    }

    public function test_template_round_trips_quoted_names_and_multiple_parents(): void
    {
        $category = $this->category();
        $category->update(['name' => "Returns, \"repairs\"\nand help"]);
        $other = QueryCategory::create(['name' => 'Warranty', 'type' => 'category', 'query_type_id' => $category->query_type_id]);
        $child = QueryCategory::create(['name' => 'Inspection', 'type' => 'subcategory', 'query_type_id' => $category->query_type_id]);
        $child->parents()->attach([$category->id, $other->id]);
        $response = $this->get('/api/categories/bulk-template?format=legacy')->assertOk();
        $csv = $response->streamedContent();
        $this->postJson('/api/categories/bulk', ['file' => UploadedFile::fake()->createWithContent('template.csv', $csv)])
            ->assertOk()->assertJsonCount(0, 'rows');
        $this->upload("$child->id,Inspection,subcategory,$category->query_type_id,$category->id;$other->id\n")
            ->assertOk()->assertJsonCount(0, 'rows');
    }

    public function test_only_name_is_required_for_creation_and_optional_fields_are_preserved(): void
    {
        $category = $this->category();
        $this->postJson('/api/categories/bulk', [
            'file' => UploadedFile::fake()->createWithContent('minimal.csv', "id,name\n$category->id,Renamed\n,New entry\n"),
            'apply' => '1',
        ])->assertOk();
        $this->assertSame($category->query_type_id, $category->fresh()->query_type_id);
        $this->assertDatabaseHas('query_categories', ['name' => 'New entry', 'type' => 'category', 'query_type_id' => null]);
        $this->postJson('/api/categories/bulk', [
            'file' => UploadedFile::fake()->createWithContent('names.csv', "name\nAnother topic\n"),
            'apply' => '1',
        ])->assertOk();
        $this->assertDatabaseHas('query_categories', ['name' => 'Another topic']);
    }

    public function test_legacy_rows_are_skipped_and_new_rows_allow_blank_query_types(): void
    {
        $category = $this->category();
        $category->update(['query_type_id' => null]);
        $parent = QueryCategory::create(['name' => 'Legacy parent', 'type' => 'category']);
        $category->parents()->attach($parent->id);
        $rows = "$category->id,Original,category,,$parent->id\n,New entry,category,,\n";
        $this->upload($rows)->assertOk()->assertJsonCount(1, 'rows')->assertJsonPath('rows.0.action', 'Create');
        $this->upload($rows, true)->assertOk();
        $this->assertDatabaseCount('user_activities', 1);
        $this->assertDatabaseHas('category_relationships', ['parent_id' => $parent->id, 'child_id' => $category->id]);
        $this->assertNull($category->fresh()->query_type_id);
        $this->upload("$category->id,Renamed,category,,\n", true)->assertOk();
        $this->assertDatabaseHas('category_relationships', ['parent_id' => $parent->id, 'child_id' => $category->id]);
        $this->upload("$category->id,Renamed,category,,-\n", true)->assertOk();
        $this->assertDatabaseCount('category_relationships', 0);
    }

    public function test_bulk_endpoints_require_authentication(): void
    {
        $this->getJson('/api/categories/bulk-template')->assertUnauthorized();
        $this->upload(',Test,category,1,')->assertUnauthorized();
    }

    private function uploadSheet(string $csv, bool $apply = false)
    {
        return $this->postJson('/api/categories/bulk', [
            'file' => UploadedFile::fake()->createWithContent('sheet.csv', $csv),
            'apply' => $apply ? '1' : '0',
        ]);
    }

    public function test_rama_sheet_previews_without_writes_and_imports_all_paths_idempotently(): void
    {
        $this->actingAs(User::factory()->create());
        $csv = file_get_contents(database_path('data/customer-categories.csv'));
        $this->uploadSheet($csv)->assertOk()->assertJsonPath('format', 'hierarchy')->assertJsonCount(124, 'rows');
        $this->assertDatabaseCount('query_types', 0);
        $this->assertDatabaseCount('query_categories', 0);
        $this->assertDatabaseCount('category_relationships', 0);
        $this->assertDatabaseCount('user_activities', 0);
        $this->uploadSheet($csv, true)->assertOk();
        $this->assertDatabaseCount('query_types', 3);
        $this->assertDatabaseCount('query_categories', 197);
        $this->assertDatabaseCount('category_relationships', 192);

        $stream = fopen(database_path('data/customer-categories.csv'), 'r');
        fgetcsv($stream, null, ',', '"', '');
        while (($row = fgetcsv($stream, null, ',', '"', '')) !== false) {
            [$typeName, $category, $subcategory, $child] = array_map('trim', $row);
            $typeId = QueryType::where('name', $typeName)->value('id');
            $parent = null;
            foreach (['category' => $category, 'subcategory' => $subcategory, 'child' => $child] as $level => $name) {
                $node = QueryCategory::where(['query_type_id' => $typeId, 'type' => $level, 'name' => $name])->firstOrFail();
                if ($parent) {
                    $this->assertTrue($node->parents()->whereKey($parent->id)->exists());
                }
                $parent = $node;
            }
        }
        fclose($stream);
        $audits = UserActivity::count();
        $this->uploadSheet($csv)->assertOk()->assertJsonPath('rows.0.action', 'Unchanged');
        $this->uploadSheet($csv, true)->assertOk();
        $this->assertDatabaseCount('query_categories', 197);
        $this->assertDatabaseCount('category_relationships', 192);
        $this->assertDatabaseCount('user_activities', $audits);
    }

    public function test_sample_download_has_sheet_headers_and_can_be_uploaded(): void
    {
        $this->actingAs(User::factory()->create());
        $csv = $this->get('/api/categories/bulk-template')->assertOk()->streamedContent();
        $this->assertStringContainsString('"Type of Query","Query Category","Sub Category","Child Category"', $csv);
        $this->uploadSheet($csv)->assertOk()->assertJsonCount(3, 'rows');
        $this->uploadSheet($csv, true)->assertOk();
        $this->assertDatabaseCount('query_types', 2);
        $this->assertDatabaseCount('query_categories', 7);
        $this->assertDatabaseCount('category_relationships', 5);
    }

    public function test_sheet_rejects_incomplete_later_rows_before_writing(): void
    {
        $this->actingAs(User::factory()->create());
        $csv = "Type of Query,Query Category,Sub Category,Child Category\nSupport,Returns,Status,Check\nSupport,Shipping,,Tracking\n";
        $this->uploadSheet($csv, true)->assertUnprocessable()->assertJsonValidationErrors('row.3');
        $this->assertDatabaseCount('query_types', 0);
        $this->assertDatabaseCount('query_categories', 0);
        $this->assertDatabaseCount('user_activities', 0);
    }

    public function test_sheet_adds_links_to_existing_nodes_and_preserves_other_parents(): void
    {
        $root = $this->category();
        $subcategory = QueryCategory::create(['name' => 'Status', 'type' => 'subcategory', 'query_type_id' => $root->query_type_id]);
        $subcategory->parents()->attach($root->id);
        $csv = "Type of Query,Query Category,Sub Category,Child Category\nSupport,Returns,Status,Check\n";
        $this->uploadSheet($csv)->assertOk()->assertJsonPath('rows.0.action', 'Create / Link');
        $this->assertDatabaseCount('category_relationships', 1);
        $this->uploadSheet($csv, true)->assertOk();
        $this->assertCount(2, $subcategory->fresh()->parents);
        $this->assertDatabaseHas('category_relationships', ['parent_id' => $root->id, 'child_id' => $subcategory->id]);
    }

    public function test_sheet_save_failure_rolls_back_types_categories_links_and_audit(): void
    {
        $this->actingAs(User::factory()->create());
        UserActivity::creating(function () {
            throw new \RuntimeException('Simulated audit failure');
        });
        try {
            $this->uploadSheet("Type of Query,Query Category,Sub Category,Child Category\nSupport,Returns,Status,Check\n", true)
                ->assertStatus(500);
            $this->assertDatabaseCount('query_types', 0);
            $this->assertDatabaseCount('query_categories', 0);
            $this->assertDatabaseCount('category_relationships', 0);
            $this->assertDatabaseCount('user_activities', 0);
        } finally {
            UserActivity::flushEventListeners();
        }
    }
}
