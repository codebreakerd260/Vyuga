export interface Garment {
  id: string;
  name: string;
  description: string | null;
  category: string;
  region: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  price: number;
  colors: string[];
  sizes: string[];
  inStock: boolean;
  stockCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TryOnSession {
  id: string;
  userId: string | null;
  garmentId: string;
  garment: Garment;
  inputImageUrl: string;
  resultImageUrl: string | null;
  status: string;
  errorMessage: string | null;
  shareToken: string | null;
  createdAt: string;
  expiresAt: string;
  shareUrl: string;
}

export interface CartItem {
  id: string;
  userId: string | null;
  sessionId: string | null;
  garmentId: string;
  garment: Garment;
  size: string;
  quantity: number;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: CartItem[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shippingCost: number;
  total: number;
  status: string;
  paymentId: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}
