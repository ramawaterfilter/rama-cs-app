import { productNameOptions, productSkuOptions, pickCatalogProduct, ORDERED_PRODUCT_KEYS } from './product-options';

describe('product-options', () => {
  const products = [
    { name: 'RO Filter', sku: 'RTZ-1' },
    { name: 'RO Filter', sku: 'RTZ-1' }, // duplicate catalog row must not duplicate options
    { name: 'UV Lamp', sku: '' },
  ];
  const form: any = { ordered_product_name: '', ordered_product_sku: '' };

  it('lists each product once with its SKU in the label', () => {
    const opts = productNameOptions(products, '');
    expect(opts.length).toBe(2);
    expect(opts[0]).toEqual({ value: 'RO Filter', label: 'RO Filter (RTZ-1)' });
    expect(opts[1]).toEqual({ value: 'UV Lamp', label: 'UV Lamp' });
  });

  it('keeps a saved value that is not in the catalog visible', () => {
    const opts = productNameOptions(products, 'Legacy Filter');
    expect(opts[0]).toEqual({ value: 'Legacy Filter', label: 'Legacy Filter (not in catalog)' });
    expect(productSkuOptions(products, 'OLD-SKU')[0].label).toBe('OLD-SKU (not in catalog)');
  });

  it('keeps name and SKU on the same product when either is picked', () => {
    pickCatalogProduct(products, form, ORDERED_PRODUCT_KEYS, 'name', 'UV Lamp');
    expect(form.ordered_product_name).toBe('UV Lamp');
    expect(form.ordered_product_sku).toBe('');

    pickCatalogProduct(products, form, ORDERED_PRODUCT_KEYS, 'sku', 'RTZ-1');
    expect(form.ordered_product_name).toBe('RO Filter');
    expect(form.ordered_product_sku).toBe('RTZ-1');
  });

  it('clearing the selection clears the pair and unknown values leave the other field alone', () => {
    pickCatalogProduct(products, form, ORDERED_PRODUCT_KEYS, 'name', 'RO Filter');
    pickCatalogProduct(products, form, ORDERED_PRODUCT_KEYS, 'sku', 'not-a-sku');
    expect(form.ordered_product_name).toBe('RO Filter');

    pickCatalogProduct(products, form, ORDERED_PRODUCT_KEYS, 'name', '');
    expect(form.ordered_product_name).toBe('');
    expect(form.ordered_product_sku).toBe('');
  });
});
