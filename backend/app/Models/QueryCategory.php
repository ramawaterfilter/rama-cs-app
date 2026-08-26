<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QueryCategory extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function children()
    {
        return $this->belongsToMany(QueryCategory::class, 'category_relationships', 'parent_id', 'child_id');
    }

    public function parents()
    {
        return $this->belongsToMany(QueryCategory::class, 'category_relationships', 'child_id', 'parent_id');
    }
}
