"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function MenuManagement() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const itemsQuery = useQuery({ queryKey: ["menu-items"], queryFn: api.menuItems });
  const inventoryQuery = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.list });
  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [formError, setFormError] = useState("");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
    void queryClient.invalidateQueries({ queryKey: ["menu-items"] });
  };
  const categoryMutation = useMutation({
    mutationFn: () => api.createCategory({ name: categoryName.trim() }),
    onSuccess: () => { refresh(); setCategoryName(""); setFormError(""); },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to create category."),
  });
  const itemMutation = useMutation({
    mutationFn: () => api.createMenuItem({ categoryId: itemCategory, name: itemName.trim(), price: Number(itemPrice), ...(inventoryItemId ? { inventoryItemId } : {}) }),
    onSuccess: () => { refresh(); void queryClient.invalidateQueries({ queryKey: ["inventory"] }); setItemName(""); setItemPrice(""); setInventoryItemId(""); setFormError(""); },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to create menu item."),
  });
  const addCategory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categoryName.trim()) categoryMutation.mutate();
  };
  const addItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(itemPrice);
    if (itemName.trim() && itemCategory && Number.isFinite(price) && price > 0) itemMutation.mutate();
  };

  return (
    <section className="menu-manager">
      <header className="menu-manager-heading"><div><h1 className="page-title">Menu</h1><p className="muted">Create categories and menu items for the active cafe.</p></div></header>
      <div className="menu-manager-forms">
        <form className="card menu-manager-form" onSubmit={addCategory}>
          <h2>Add category</h2><p className="muted">Create a category to organize your menu items.</p>
          <label className="field">Category name<input autoComplete="off" onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Breakfast" required value={categoryName} /></label>
          <button className="btn" disabled={categoryMutation.isPending} type="submit">{categoryMutation.isPending ? "Adding…" : "Add category"}</button>
        </form>
        <form className="card menu-manager-form" onSubmit={addItem}>
          <h2>Add menu item</h2><p className="muted">Choose a category for every item you add.</p>
          <label className="field">Item name<input autoComplete="off" onChange={(event) => setItemName(event.target.value)} placeholder="e.g. Veg momo" required value={itemName} /></label>
          <div className="menu-item-form-fields">
            <label className="field">Category<select onChange={(event) => setItemCategory(event.target.value)} required value={itemCategory}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="field">Price (NPR)<input min="0.01" onChange={(event) => setItemPrice(event.target.value)} placeholder="0.00" required step="0.01" type="number" value={itemPrice} /></label>
          </div>
          <label className="field">Inventory product <span className="muted">(optional; sales deduct one unit from stock)</span><select onChange={(event) => setInventoryItemId(event.target.value)} value={inventoryItemId}><option value="">No direct inventory link</option>{(inventoryQuery.data ?? []).filter((item) => item.isActive && !items.some((menuItem) => menuItem.inventoryItemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label>
          <button className="btn" disabled={!categories.length || itemMutation.isPending} type="submit">{itemMutation.isPending ? "Adding…" : "Add menu item"}</button>
          {!categories.length && <small className="muted">Add a category before creating menu items.</small>}
        </form>
      </div>
      {formError && <p className="error" role="alert">{formError}</p>}
      {(categoriesQuery.error || itemsQuery.error) && <p className="error" role="alert">Unable to load the active cafe menu.</p>}
      <section className="card menu-manager-list">
        <div className="menu-manager-list-heading"><div><h2>Menu items</h2><p className="muted">{items.length} {items.length === 1 ? "item" : "items"} across {categories.length} {categories.length === 1 ? "category" : "categories"}</p></div></div>
        {items.length ? <div className="menu-manager-table-wrap"><table className="table"><thead><tr><th>Item</th><th>Category</th><th>Price</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td><span className="tag">{item.category}</span></td><td>NPR {item.price}</td></tr>)}</tbody></table></div> : <p className="empty">No menu items yet. Add a category, then create your first menu item.</p>}
      </section>
    </section>
  );
}
