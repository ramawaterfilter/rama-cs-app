<?php
 
namespace App\Http\Controllers;
 
use App\Models\Country;
use Illuminate\Http\Request;
 
class CountryController extends Controller
{
    public function index()
    {
        return response()->json(Country::all());
    }
 
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:countries',
            'is_active' => 'boolean'
        ]);
        $res = Country::create($validated);
        return response()->json($res, 201);
    }
 
    public function show(Country $country)
    {
        return response()->json($country);
    }
 
    public function update(Request $request, Country $country)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|unique:countries,name,' . $country->id,
            'is_active' => 'boolean'
        ]);
        $country->update($validated);
        return response()->json($country);
    }
 
    public function destroy(Country $country)
    {
        $country->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
