'use client';

import { use, useEffect, useState } from 'react';
import ProductForm from '@/components/admin/ProductForm';
import { supabase } from '@/lib/supabase';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories(id, name),
            variants(id, sku, price, compare_at_price, stock_quantity, option_values),
            product_images(id, url, sort_order, alt)
          `)
          .eq('id', resolvedParams.id)
          .single();

        if (error) throw error;

        const normalizedVariants = (data?.variants || []).map((variant: any) => {
          const optionValues = Array.isArray(variant.option_values) ? variant.option_values : [];
          const sizeOption = optionValues.find((value: any) => value?.attribute_name === 'Size');
          const colorOption = optionValues.find((value: any) => value?.attribute_name === 'Color');

          return {
            id: variant.id,
            name: sizeOption?.value || '',
            color: colorOption?.value || '',
            sku: variant.sku,
            price: variant.price,
            compare_at_price: variant.compare_at_price,
            quantity: variant.stock_quantity,
            stock: variant.stock_quantity,
          };
        });

        const normalizedImages = (data?.product_images || []).map((image: any) => ({
          id: image.id,
          url: image.url,
          position: image.sort_order ?? 0,
          alt_text: image.alt || '',
        }));

        const firstVariant = normalizedVariants[0];
        setProductData({
          ...data,
          product_variants: normalizedVariants,
          product_images: normalizedImages,
          price: data?.price ?? firstVariant?.price ?? '',
          compare_at_price: data?.compare_at_price ?? firstVariant?.compare_at_price ?? '',
          sku: firstVariant?.sku ?? data?.sku ?? '',
          quantity: normalizedVariants.reduce(
            (sum: number, variant: any) => sum + (Number(variant.quantity) || 0),
            0,
          ),
          featured: data?.is_featured ?? false,
        });
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    }

    if (resolvedParams.id) {
      fetchProduct();
    }
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-rose-700 animate-spin mb-4 block"></i>
          <p className="text-gray-500 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600">The product you are trying to edit does not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return <ProductForm initialData={productData} isEditMode={true} />;
}
