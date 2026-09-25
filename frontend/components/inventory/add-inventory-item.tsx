"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export function AddInventoryItem() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("0");
  const [minimumLevel, setMinimumLevel] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const mutation = useMutation({
    mutationFn: async () => {
      return api.inventory.create({ name: name.trim(), unit: unit.trim(), initialQuantity: Number(quantity), minimumQuantity: Number(minimumLevel), costPrice: Number(costPrice) });
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["inventory"] }); router.push("/inventory"); },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !unit.trim() || ![quantity, minimumLevel, costPrice].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) return;
    mutation.mutate();
  };
  return (
    <section className="inventory-form-page">
      <header><h1 className="page-title">Add inventory item</h1><p className="muted">Enter an item and its opening stock for the active cafe.</p></header>
      <form className="card inventory-item-form" onSubmit={submit}>
        <label className="field">Item name<input autoComplete="off" onChange={(event) => setName(event.target.value)} placeholder="e.g. Coffee beans" required value={name} /></label>
        <div className="inventory-form-row"><label className="field">SKU<span className="muted">Generated automatically</span><input aria-readonly="true" readOnly value="Generated when saved" /></label><label className="field">Unit of measure<input autoComplete="off" onChange={(event) => setUnit(event.target.value)} placeholder="e.g. kg, L, or pcs" required value={unit} /></label></div>
        <div className="inventory-form-row"><label className="field">Opening quantity<input min="0" onChange={(event) => setQuantity(event.target.value)} required step="any" type="number" value={quantity} /></label><label className="field">Minimum stock level<input min="0" onChange={(event) => setMinimumLevel(event.target.value)} required step="any" type="number" value={minimumLevel} /></label></div>
        <label className="field">Cost price per unit<input min="0" onChange={(event) => setCostPrice(event.target.value)} required step="any" type="number" value={costPrice} /></label>
        {mutation.error && <p className="error" role="alert">{mutation.error instanceof Error ? mutation.error.message : "Unable to save inventory item."}</p>}
        <div className="inventory-form-actions"><button className="btn" disabled={mutation.isPending} type="submit">{mutation.isPending ? "Saving…" : "Add item / stock"}</button><Link className="btn secondary" href="/inventory">Cancel</Link></div>
      </form>
    </section>
  );
}
