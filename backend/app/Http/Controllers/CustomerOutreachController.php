<?php
 
namespace App\Http\Controllers;
 
use App\Models\CustomerOutreach;
use Illuminate\Http\Request;
 
class CustomerOutreachController extends Controller
{
    public function index()
    {
        return response()->json(CustomerOutreach::all());
    }
 
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:customer_outreaches',
            'is_active' => 'boolean'
        ]);
        $res = CustomerOutreach::create($validated);
        return response()->json($res, 201);
    }
 
    public function show(CustomerOutreach $customerOutreach)
    {
        return response()->json($customerOutreach);
    }
 
    public function update(Request $request, CustomerOutreach $customerOutreach)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|unique:customer_outreaches,name,' . $customerOutreach->id,
            'is_active' => 'boolean'
        ]);
        $customerOutreach->update($validated);
        return response()->json($customerOutreach);
    }
 
    public function destroy(CustomerOutreach $customerOutreach)
    {
        $customerOutreach->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
