export interface ProductKeys {
  name: string;
  sku: string;
}

export interface ProductOption {
  value: string;
  label: string;
}

export const ORDERED_PRODUCT_KEYS: ProductKeys = { name: 'ordered_product_name', sku: 'ordered_product_sku' };
export const REPLACEMENT_PRODUCT_KEYS: ProductKeys = { name: 'replacement_product_name', sku: 'replacement_product_sku' };

// Dropdown options for the catalog-backed product fields. The current value is
// always kept as an option so tickets saved before the product catalog existed
// don't silently blank out on save.
export function productNameOptions(products: any[], current: string): ProductOption[] {
  const opts = unique(products.filter(p => p.name).map(p => ({
    value: p.name,
    label: p.sku ? `${p.name} (${p.sku})` : p.name,
  })));
  if (current && !opts.some(o => o.value === current)) {
    opts.unshift({ value: current, label: `${current} (not in catalog)` });
  }
  return opts;
}

export function productSkuOptions(products: any[], current: string): ProductOption[] {
  const opts = unique(products.filter(p => p.sku).map(p => ({ value: p.sku, label: `${p.sku} — ${p.name}` })));
  if (current && !opts.some(o => o.value === current)) {
    opts.unshift({ value: current, label: `${current} (not in catalog)` });
  }
  return opts;
}

// Picking either the name or the SKU keeps both fields on the same catalog product.
export function pickCatalogProduct(products: any[], target: any, keys: ProductKeys, by: 'name' | 'sku', value: string): void {
  if (!value) {
    target[keys.name] = '';
    target[keys.sku] = '';
    return;
  }
  const product = products.find(p => (by === 'name' ? p.name : p.sku) === value);
  if (!product) return; // value isn't in the catalog — leave the other field alone
  target[keys.name] = product.name;
  target[keys.sku] = product.sku || '';
}

function unique(options: ProductOption[]): ProductOption[] {
  const seen = new Set<string>();
  return options.filter(o => {
    if (seen.has(o.value)) return false;
    seen.add(o.value);
    return true;
  });
}
