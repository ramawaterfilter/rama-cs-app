<?php

namespace App\Http\Controllers;

use App\Models\PurchaseStore;
use Illuminate\Http\Request;

class PurchaseStoreController extends Controller
{
    public function index()
    {
        return response()->json(PurchaseStore::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:purchase_stores,name',
            'is_active' => 'boolean'
        ]);

        $store = PurchaseStore::create($validated);
        return response()->json($store, 201);
    }

    public function update(Request $request, PurchaseStore $purchaseStore)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:purchase_stores,name,' . $purchaseStore->id,
            'is_active' => 'boolean'
        ]);

        $purchaseStore->update($validated);
        return response()->json($purchaseStore);
    }

    public function destroy(PurchaseStore $purchaseStore)
    {
        $purchaseStore->delete();
        return response()->json(null, 204);
    }
}
