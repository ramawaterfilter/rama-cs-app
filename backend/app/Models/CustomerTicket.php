<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerTicket extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'received_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(QueryCategory::class, 'category_id');
    }

    public function subCategory()
    {
        return $this->belongsTo(QueryCategory::class, 'sub_category_id');
    }

    public function childCategory()
    {
        return $this->belongsTo(QueryCategory::class, 'child_category_id');
    }

    public function status()
    {
        return $this->belongsTo(QueryStatus::class);
    }

    public function queryChannel()
    {
        return $this->belongsTo(QueryChannel::class, 'query_channel_id');
    }

    public function queryType()
    {
        return $this->belongsTo(QueryType::class, 'query_type_id');
    }

    public function executive()
    {
        return $this->belongsTo(User::class, 'executive_id');
    }

    public function queryFilter()
    {
        return $this->belongsTo(QueryFilter::class, 'query_filter_id');
    }
 
    public function outreach()
    {
        return $this->belongsTo(CustomerOutreach::class, 'customer_outreach_id');
    }
 

 
    public function countryDynamic()
    {
        return $this->belongsTo(Country::class, 'country_id');
    }


    public function replacement()
    {
        return $this->hasOne(TicketReplacement::class, 'ticket_id');
    }

    public function ticketReturn()
    {
        return $this->hasOne(TicketReturn::class, 'ticket_id');
    }

    public function activities()
    {
        return $this->hasMany(TicketActivityLog::class, 'ticket_id');
    }
}
