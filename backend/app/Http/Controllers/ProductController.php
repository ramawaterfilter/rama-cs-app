<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\UserActivity;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(Product::with('categories.parents')->orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'sku'          => 'nullable|string|unique:products,sku',
            'brand'        => 'nullable|string',
            'model'        => 'nullable|string',
            'description'  => 'nullable|string',
            'category_ids' => 'nullable|array',
            'category_ids.*'=> 'exists:query_categories,id',
            'service_type' => 'nullable|string',
            'is_active'    => 'boolean',
        ]);
        
        $productData = $validated;
        unset($productData['category_ids']);
        
        $product = Product::create($productData);
        if (!empty($validated['category_ids'])) {
            $product->categories()->attach($validated['category_ids']);
        }

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Created Product',
            'description' => 'Created product: ' . $product->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($product->load('categories.parents'), 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load('categories.parents'));
    }

    public function update(Request $request, Product $product)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validated = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'sku'          => 'nullable|string',
            'brand'        => 'nullable|string',
            'model'        => 'nullable|string',
            'description'  => 'nullable|string',
            'category_ids' => 'nullable|array',
            'category_ids.*'=> 'exists:query_categories,id',
            'service_type' => 'nullable|string',
            'is_active'    => 'boolean',
        ]);
        
        $productData = $validated;
        unset($productData['category_ids']);
        
        $product->update($productData);
        if (array_key_exists('category_ids', $validated)) {
            $product->categories()->sync($validated['category_ids'] ?? []);
        }

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Updated Product',
            'description' => 'Updated product: ' . $product->name,
            'ip_address' => $request->ip()
        ]);

        return response()->json($product->load('categories.parents'));
    }

    public function destroy(Request $request, Product $product)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $name = $product->name;
        $product->delete();

        UserActivity::create([
            'user_id' => $request->user()->id,
            'action' => 'Deleted Product',
            'description' => 'Deleted product: ' . $name,
            'ip_address' => $request->ip()
        ]);

        return response()->json(['message' => 'Product deleted']);
    }
}
