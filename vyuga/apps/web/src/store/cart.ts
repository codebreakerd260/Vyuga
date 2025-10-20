import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  garment: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  };
  size: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  total: number;
  count: number;

  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;

  // Sync with server
  syncWithServer: (serverItems: CartItem[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      count: 0,

      addItem: (item) => {
        const items = get().items;
        const existing = items.find(
          i => i.garment.id === item.garment.id && i.size === item.size
        );

        if (existing) {
          set({
            items: items.map(i =>
              i.id === existing.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          });
        } else {
          set({
            items: [...items, { ...item, id: Math.random().toString() }]
          });
        }

        // Recalculate total
        const newItems = get().items;
        const total = newItems.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ total, count: newItems.length });
      },

      removeItem: (id) => {
        const items = get().items.filter(i => i.id !== id);
        const total = items.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items, total, count: items.length });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const items = get().items.map(i =>
          i.id === id ? { ...i, quantity } : i
        );
        const total = items.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items, total, count: items.length });
      },

      clearCart: () => {
        set({ items: [], total: 0, count: 0 });
      },

      syncWithServer: (serverItems) => {
        const total = serverItems.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items: serverItems, total, count: serverItems.length });
      }
    }),
    {
      name: 'vyuga-cart'
    }
  )
);
