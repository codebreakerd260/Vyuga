'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { garmentAPI } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { Search } from 'lucide-react';
import { Garment } from '@/lib/types';

export default function ShopPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['garments', { search, category, page }],
    queryFn: () => garmentAPI.list({ search, category, page })
  });

  const categories = ['SAREE', 'LEHENGA', 'KURTA', 'SALWAR_KAMEEZ', 'ANARKALI'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Shop Ethnic Wear</h1>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search garments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg animate-pulse">
                <div className="aspect-[3/4] bg-gray-200" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {data?.data.data.map((garment: Garment) => (
                <ProductCard key={garment.id} garment={garment} />
              ))}
            </div>

            {/* Pagination */}
            {data?.data.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {data?.data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === data?.data.pagination.totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
