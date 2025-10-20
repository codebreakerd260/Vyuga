'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cartAPI } from '@/lib/api';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem } from '@/lib/types';

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartAPI.get()
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => cartAPI.removeItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Item removed from cart');
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading cart...</div>;
  }

  const items = cart?.data.items || [];
  const total = cart?.data.total || 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6">
            Start shopping to add items to your cart
          </p>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart ({items.length})</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {items.map((item: CartItem) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-6 border-b last:border-b-0"
                >
                  {/* Image */}
                  <div className="relative w-24 h-32 flex-shrink-0">
                    <Image
                      src={item.garment.thumbnailUrl || item.garment.imageUrl}
                      alt={item.garment.name}
                      fill
                      className="object-cover rounded"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {item.garment.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Size: {item.size}
                    </p>
                    <p className="text-lg font-bold text-purple-600">
                      ₹{item.garment.price.toLocaleString()}
                    </p>
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex flex-col justify-between items-end">
                    <button
                      onClick={() => removeItemMutation.mutate(item.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 border rounded-lg">
                      <button
                        className="p-2 hover:bg-gray-100"
                        disabled
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-3 font-medium">{item.quantity}</span>
                      <button
                        className="p-2 hover:bg-gray-100"
                        disabled
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">₹100</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-purple-600">
                    ₹{(total + 100).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push('/checkout')}
                className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Proceed to Checkout
              </button>

              <button
                onClick={() => router.push('/shop')}
                className="w-full mt-3 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
