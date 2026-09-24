"use client";

import { create } from "zustand";
import type { MenuItem } from "@/lib/api/client";

export type CartLine = MenuItem & {
  quantity: number;
  note?: string;
};

type PosState = {
  items: CartLine[];
  table: string;
  customer: string;
  add: (item: MenuItem) => void;
  changeQuantity: (id: string, delta: number) => void;
  clear: () => void;
  setCustomer: (value: string) => void;
  setTable: (value: string) => void;
};

export const usePosStore = create<PosState>((set) => ({
  items: [],
  table: "Table 7",
  customer: "",

  setTable: (table) => set({ table }),
  setCustomer: (customer) => set({ customer }),

  add: (item) =>
    set((state) => {
      const existingItem = state.items.find((line) => line.id === item.id);

      if (existingItem) {
        return {
          items: state.items.map((line) =>
            line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        };
      }

      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),

  changeQuantity: (id, delta) =>
    set((state) => ({
      items: state.items.flatMap((line) => {
        if (line.id !== id) return [line];

        const quantity = line.quantity + delta;
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }),
    })),

  clear: () => set({ items: [], customer: "" }),
}));
