<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserProfileRequest extends Model
{
    protected $fillable = ['email', 'user_id', 'status'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
