export type ApiEnvelope<T> = { success: true; data: T; message?: string };
export type Tenant = { id: string; name: string; slug: string };
export type User = { id: string; name: string; email: string; phone?: string | null; role: string; permissions: string[]; tenant: Tenant; memberships?: { tenant: Tenant; role: string }[] };
export type Category = { id: string; name: string; description?: string | null; displayOrder: number; isActive: boolean };
export type MenuItem = { id: string; categoryId?: string; category: string; name: string; description?: string | null; price: number; imageUrl?: string | null; isActive?: boolean };
export type RestaurantTable = { id: string; tableNumber: string; capacity: number; status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "OUT_OF_SERVICE"; isActive: boolean; orders?: { id: string; orderNumber: string; status: string }[] };
export type OrderItem = { id: string; menuItemId: string; itemName: string; quantity: number | string; unitPrice: number | string; totalAmount: number | string; notes?: string | null };
export type OrderPayment = { id: string; method: PaymentMethod; amount: number | string; referenceNumber?: string | null };
export type Order = { id: string; orderNumber: string; orderType: "DINE_IN" | "TAKEAWAY"; status: string; paymentStatus: string; subtotal: number | string; discountAmount: number | string; taxAmount: number | string; totalAmount: number | string; createdAt?: string; table?: RestaurantTable | null; customer?: { name: string } | null; items: OrderItem[]; payments?: OrderPayment[] };
export type KitchenOrder = { id: string; kotNumber: string; status: "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED"; order: { table?: RestaurantTable | null }; items: { quantity: number | string; orderItem: { itemName: string } }[]; createdAt: string };
export type InventoryItem = { id: string; name: string; sku?: string | null; unit: string; currentQuantity: number | string; minimumQuantity: number | string; costPrice: number | string; isActive: boolean };
export type DashboardSummary = { sales: number | string; orders: number; pendingKot: number; preparingKot: number; readyKot: number; occupiedTables: number; availableTables: number; lowStockItems: number };
export type RestaurantSettings = { id: string; businessName: string; address?: string | null; phone?: string | null; email?: string | null; currency: string; timezone: string; taxEnabled: boolean; taxRate: number | string; taxInclusive: boolean };
export type LoginInput = { email: string; password: string; tenantId?: string };
export type CreateOrderInput = { orderType: "DINE_IN" | "TAKEAWAY"; tableId?: string; customerId?: string; items: { menuItemId: string; quantity: number; notes?: string }[]; notes?: string; discountAmount?: number };
export type PaymentMethod = "CASH" | "CARD" | "ESEWA" | "KHALTI" | "BANK_TRANSFER" | "OTHER";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | { success: false; error?: { message?: string } } | null;
  if (!response.ok || !body?.success) throw new Error(body && "error" in body ? body.error?.message : "Request failed");
  return body.data;
}

export const api = {
  auth: { login: (input: LoginInput) => request<User>("/auth/login", { method: "POST", body: JSON.stringify(input) }), logout: () => request<null>("/auth/logout", { method: "POST" }), me: () => request<User>("/auth/me"), tenants: () => request<{ tenant: Tenant; role: { name: string } }[]>("/auth/tenants"), switchTenant: (tenantId: string) => request<User>("/auth/switch-tenant", { method: "POST", body: JSON.stringify({ tenantId }) }) },
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  categories: () => request<Category[]>("/categories?activeOnly=true"),
  createCategory: (body: { name: string }) => request<Category>("/categories", { method: "POST", body: JSON.stringify(body) }),
  menuItems: async () => (await request<Array<Omit<MenuItem, "category" | "price"> & { category?: Category | string; price: number | string }>>("/menu-items?activeOnly=true")).map((item) => ({ ...item, category: typeof item.category === "string" ? item.category : item.category?.name ?? "Uncategorized", price: Number(item.price) })),
  createMenuItem: (body: { categoryId: string; name: string; price: number }) => request<MenuItem>("/menu-items", { method: "POST", body: JSON.stringify(body) }),
  tables: () => request<RestaurantTable[]>("/tables"),
  createTable: (body: { tableNumber: string; capacity: number }) => request<RestaurantTable>("/tables", { method: "POST", body: JSON.stringify(body) }),
  orders: (status?: string) => request<Order[]>(status ? `/orders?status=${encodeURIComponent(status)}` : "/orders"),
  order: (id: string) => request<Order>(`/orders/${id}`),
  createOrder: (body: CreateOrderInput) => request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  createPayment: (orderId: string, body: { method: PaymentMethod; amount: number; referenceNumber?: string }) => request(`/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(body) }),
  createSplitPayment: (orderId: string, payments: { method: PaymentMethod; amount: number; referenceNumber?: string }[]) => request(`/orders/${orderId}/payments/split`, { method: "POST", body: JSON.stringify({ payments }) }),
  sendOrderToKitchen: (id: string) => request(`/orders/${id}/send-to-kitchen`, { method: "POST" }),
  updateOrderStatus: (id: string, status: "PREPARING" | "READY" | "SERVED") => request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  kots: () => request<KitchenOrder[]>("/kots"),
  startKot: (id: string) => request(`/kots/${id}/start`, { method: "POST" }),
  readyKot: (id: string) => request(`/kots/${id}/ready`, { method: "POST" }),
  completeKot: (id: string) => request(`/kots/${id}/complete`, { method: "POST" }),
  settings: { get: () => request<RestaurantSettings>("/settings"), update: (body: Partial<Pick<RestaurantSettings, "businessName" | "address" | "phone" | "email" | "taxEnabled" | "taxRate" | "taxInclusive" | "timezone">>) => request<RestaurantSettings>("/settings", { method: "PATCH", body: JSON.stringify(body) }) },
  inventory: { list: () => request<InventoryItem[]>("/inventory"), create: (body: { name: string; sku?: string; unit: string; minimumQuantity: number; costPrice: number }) => request<InventoryItem>("/inventory", { method: "POST", body: JSON.stringify(body) }), adjust: (id: string, quantity: number, reason: string) => request(`/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify({ quantity, reason }) }) },
};

export const sampleMenu: MenuItem[] = [
  { id: "momo", name: "Chicken Momo", category: "Food", price: 260 },
  { id: "burger", name: "Classic Burger", category: "Food", price: 340 },
  { id: "cappuccino", name: "Cappuccino", category: "Coffee", price: 190 },
  { id: "americano", name: "Americano", category: "Coffee", price: 150 },
  { id: "milk-tea", name: "Masala Tea", category: "Tea", price: 80 },
  { id: "coke", name: "Coke", category: "Cold drinks", price: 100 },
];
