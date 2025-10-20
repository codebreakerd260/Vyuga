import Link from 'next/link';
import { garmentAPI } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { Garment } from '@/lib/types';

export default async function HomePage() {
  const { data } = await garmentAPI.list({ page: 1 });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Try Before You Buy
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            See how ethnic wear looks on you with AI-powered virtual try-on
          </p>
          <Link
            href="/shop"
            className="bg-white text-purple-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition inline-block"
          >
            Start Shopping
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Trending Now</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.data.slice(0, 8).map((garment: Garment) => (
              <ProductCard key={garment.id} garment={garment} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-semibold mb-2">Choose Garment</h3>
              <p className="text-gray-600">Browse our collection of ethnic wear</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📸</span>
              </div>
              <h3 className="font-semibold mb-2">Upload Photo</h3>
              <p className="text-gray-600">Take or upload a clear photo</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="font-semibold mb-2">See Result</h3>
              <p className="text-gray-600">AI generates your try-on in seconds</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
