export interface CartItem {
  id: string;
  garment: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    thumbnailUrl: string;
  };
  size: string;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  status: string;
  items: CartItem[];
}

export interface Garment {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  sizes: string[];
}

export interface TryOnSession {
  id: string;
  status: string;
  resultImageUrl?: string;
  errorMessage?: string;
  shareUrl?: string;
  garment: Garment;
}

export interface CheckoutData {
  items: {
    garmentId: string;
    size: string;
    quantity: number;
  }[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
}
