'use client';

import { useQuery } from '@tanstack/react-query';
import { orderAPI } from '@/lib/api';
import { Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Order, CartItem } from '@/lib/types';

export default function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderAPI.list()
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading orders...</div>;
  }

  const orderList = orders?.data || [];

  if (orderList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
          <p className="text-gray-600 mb-6">
            Start shopping to place your first order
          </p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 inline-block"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'CONFIRMED':
      case 'SHIPPED':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        <div className="space-y-4">
          {orderList.map((order: Order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(order.status)}
                    <span className="font-semibold">{order.orderNumber}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">
                    ₹{order.total.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {order.items.length} item{order.items.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="flex gap-2 overflow-x-auto">
                {order.items.slice(0, 4).map((item: CartItem) => (
                  <img
                    key={item.id}
                    src={item.garment.thumbnailUrl || item.garment.imageUrl}
                    alt={item.garment.name}
                    className="w-16 h-20 object-cover rounded"
                  />
                ))}
                {order.items.length > 4 && (
                  <div className="w-16 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-4">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'DELIVERED'
                    ? 'bg-green-100 text-green-800'
                    : order.status === 'SHIPPED'
                    ? 'bg-blue-100 text-blue-800'
                    : order.status === 'CONFIRMED'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {order.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
