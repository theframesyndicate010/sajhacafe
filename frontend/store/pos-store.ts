"use client";

import { create } from "zustand";
import type { MenuItem } from "@/lib/api/client";

export type CartLine = {
  /**
   * Unique per cart row. Regular menu items use the menu item id so tapping the
   * same item again bumps its quantity, while each counter item gets its own
   * key so two different "External" lines never merge into one.
   */
  lineId: string;
  /** The real menu row sent to the API; counter items share the external placeholder. */
  menuItemId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  note?: string;
  /** Priced from what the cashier typed rather than from the menu record. */
  isExternal: boolean;
};

type PosState = {
  items: CartLine[];
  table: string;
  customer: string;
  add: (item: MenuItem, overrides?: { lineId?: string; name?: string; price?: number; quantity?: number; isExternal?: boolean }) => void;
  changeQuantity: (lineId: string, delta: number) => void;
  setNote: (lineId: string, note: string) => void;
  clear: () => void;
  setCustomer: (value: string) => void;
  setTable: (value: string) => void;
};

let counterLineSequence = 0;

/** Builds the key for a counter item so each one becomes its own cart row. */
export const nextCounterLineId = () => {
  counterLineSequence += 1;
  return `counter-${Date.now()}-${counterLineSequence}`;
};

export const usePosStore = create<PosState>((set) => ({
  items: [],
  table: "Table 7",
  customer: "",

  setTable: (table) => set({ table }),
  setCustomer: (customer) => set({ customer }),

  add: (item, overrides) =>
    set((state) => {
      const lineId = overrides?.lineId ?? item.id;
      const existingItem = state.items.find((line) => line.lineId === lineId);

      if (existingItem) {
        return {
          items: state.items.map((line) =>
            line.lineId === lineId ? { ...line, quantity: line.quantity + (overrides?.quantity ?? 1) } : line,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            lineId,
            menuItemId: item.id,
            name: overrides?.name ?? item.name,
            category: item.category,
            price: overrides?.price ?? item.price,
            quantity: overrides?.quantity ?? 1,
            isExternal: overrides?.isExternal ?? false,
          },
        ],
      };
    }),

  changeQuantity: (lineId, delta) =>
    set((state) => ({
      items: state.items.flatMap((line) => {
        if (line.lineId !== lineId) return [line];

        const quantity = line.quantity + delta;
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }),
    })),

  setNote: (lineId, note) =>
    set((state) => ({
      items: state.items.map((line) => (line.lineId === lineId ? { ...line, note } : line)),
    })),

  clear: () => set({ items: [], customer: "" }),
}));
