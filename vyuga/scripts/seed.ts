import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleGarments = [
  {
    name: 'Kanjivaram Silk Saree - Red & Gold',
    description: 'Traditional Kanjivaram silk saree with intricate zari work',
    category: 'SAREE',
    region: 'SOUTH_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300',
    price: 15999,
    colors: ['red', 'gold'],
    sizes: ['Free Size'],
    inStock: true,
    stockCount: 10
  },
  {
    name: 'Banarasi Silk Lehenga',
    description: 'Elegant Banarasi lehenga perfect for weddings',
    category: 'LEHENGA',
    region: 'NORTH_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=300',
    price: 28999,
    colors: ['maroon', 'gold'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    stockCount: 15
  },
  {
    name: 'Anarkali Kurta Set',
    description: 'Flowing anarkali with embroidered dupatta',
    category: 'ANARKALI',
    region: 'PAN_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1583391733981-5aca39a06e83?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1583391733981-5aca39a06e83?w=300',
    price: 4999,
    colors: ['pink', 'white'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    inStock: true,
    stockCount: 25
  }
];

async function main() {
  console.log('Seeding database...');

  for (const garment of sampleGarments) {
    await prisma.garment.create({ data: garment });
  }

  console.log(`✅ Created ${sampleGarments.length} garments`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
