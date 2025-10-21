'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { toast } from 'sonner';
import { Garment } from '@/lib/types';

interface ProductCardProps {
  garment: Garment;
}

export function ProductCard({ garment }: ProductCardProps) {
  const router = useRouter();
  const addItem = useCartStore(state => state.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      garment: {
        id: garment.id,
        name: garment.name,
        price: garment.price,
        imageUrl: garment.imageUrl
      },
      size: garment.sizes[0], // Default to first size
      quantity: 1
    });

    toast.success('Added to cart!');
  };

  const handleTryOn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/try-on?garmentId=${garment.id}`);
  };

  return (
    <Link href={`/product/${garment.id}`}>
      <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          <Image
            src={garment.imageUrl}
            alt={garment.name}
            fill
            className="object-cover group-hover:scale-105 transition duration-300"
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
            <button
              onClick={handleTryOn}
              className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Try On
            </button>
            <button
              onClick={handleAddToCart}
              className="bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">
            {garment.category}
          </p>
          <h3 className="font-medium mb-2 line-clamp-1">
            {garment.name}
          </h3>
          <p className="text-lg font-bold text-purple-600">
            ₹{garment.price.toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}
