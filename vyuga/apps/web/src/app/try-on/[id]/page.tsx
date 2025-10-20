'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tryonAPI, cartAPI } from '@/lib/api';
import { Loader2, Download, Share2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { TryOnSession } from '@/lib/types';

export default function TryOnResultPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState('');

  const { data, isLoading, refetch } = useQuery<{ data: TryOnSession }>({
    queryKey: ['tryon', params.id],
    queryFn: () => tryonAPI.getStatus(params.id),
    refetchInterval: (data) => {
      // Poll every 3 seconds until completed
      if (!data?.data || ['QUEUED', 'PROCESSING'].includes(data.data.status)) {
        return 3000;
      }
      return false;
    }
  });

  const session = data?.data;

  useEffect(() => {
    if (session?.garment?.sizes?.[0]) {
      setSelectedSize(session.garment.sizes[0]);
    }
  }, [session]);

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    try {
      await cartAPI.addItem({
        garmentId: session.garment.id,
        size: selectedSize,
        quantity: 1
      });
      toast.success('Added to cart!');
      router.push('/cart');
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  const handleShare = async () => {
    if (navigator.share && session?.shareUrl) {
      try {
        await navigator.share({
          title: 'My Virtual Try-On',
          text: `Check out how I look in ${session.garment.name}!`,
          url: session.shareUrl
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(session.shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  // Loading state
  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  // Processing state
  if (session.status === 'QUEUED' || session.status === 'PROCESSING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Creating Your Try-On</h2>
          <p className="text-gray-600">This usually takes 20-30 seconds...</p>
          <div className="mt-6">
            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (session.status === 'FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold mb-2">Try-On Failed</h2>
          <p className="text-gray-600 mb-6">{session.errorMessage}</p>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Try Another Garment
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Result Image */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="relative aspect-[3/4] mb-4">
              <Image
                src={session.resultImageUrl!}
                alt="Your try-on result"
                fill
                className="object-contain rounded-lg"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
              <a
                href={session.resultImageUrl}
                download
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-5 h-5" />
                Download
              </a>
            </div>
          </div>

          {/* Right: Product Details */}
          <div>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <p className="text-sm text-gray-500 uppercase mb-2">
                {session.garment.category}
              </p>
              <h1 className="text-3xl font-bold mb-4">
                {session.garment.name}
              </h1>

              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-purple-600">
                  ₹{session.garment.price.toLocaleString()}
                </span>
              </div>

              {/* Size Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Select Size
                </label>
                <div className="flex gap-2">
                  {session.garment.sizes.map((size: string) => (
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
                Add to Cart - ₹{session.garment.price.toLocaleString()}
              </button>

              {/* Try Another */}
              <button
                onClick={() => router.push('/shop')}
                className="w-full mt-3 border-2 border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition"
              >
                Try Another Style
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✨ <strong>Love the look?</strong> This is an AI-generated preview.
                Actual garment may vary slightly in draping and fit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
