'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { garmentAPI, cartAPI } from '@/lib/api';
import { Loader2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState('');

  const { data: garment, isLoading } = useQuery({
    queryKey: ['garment', params.id],
    queryFn: () => garmentAPI.get(params.id)
  });

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    try {
      await cartAPI.addItem({
        garmentId: garment.data.id,
        size: selectedSize,
        quantity: 1
      });
      toast.success('Added to cart!');
      router.push('/cart');
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!garment) {
    return <div>Product not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Image */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="relative aspect-[3/4]">
              <Image
                src={garment.data.imageUrl}
                alt={garment.data.name}
                fill
                className="object-contain rounded-lg"
              />
            </div>
          </div>

          {/* Right: Product Details */}
          <div>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <p className="text-sm text-gray-500 uppercase mb-2">
                {garment.data.category}
              </p>
              <h1 className="text-3xl font-bold mb-4">
                {garment.data.name}
              </h1>

              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-purple-600">
                  ₹{garment.data.price.toLocaleString()}
                </span>
              </div>

              {/* Size Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Select Size
                </label>
                <div className="flex gap-2">
                  {garment.data.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 border-2 rounded-lg transition ${
                        selectedSize === size
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className="w-full bg-purple-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
