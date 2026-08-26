<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketReturn extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function le()
    {
        return $this->belongsTo(User::class, 'le_id');
    }
}
