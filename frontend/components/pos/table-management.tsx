"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function TableManagement() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["tables"], queryFn: api.tables });
  const [name, setName] = useState("Table");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.createTables({ prefix: name.trim(), count: Number(quantity), capacity: 4 }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["tables"] });
      setMessage(`${created.length} table${created.length === 1 ? "" : "s"} added.`);
    },
  });
  const createTables = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(quantity);
    if (name.trim() && Number.isInteger(count) && count >= 1 && count <= 100) mutation.mutate();
  };
  const tables = query.data?.filter((table) => table.isActive) ?? [];
  return (
    <div className="table-management">
      <header className="table-management-heading"><div><h1 className="page-title">Tables</h1><p className="muted">Create dining tables for the active cafe.</p></div></header>
      <form className="card table-create-form" onSubmit={createTables}><h2>Create tables</h2><div className="table-create-fields"><label className="field">Table name<input maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="e.g. Table, Patio" required value={name} /></label><label className="field">How many tables?<input max={100} min={1} onChange={(event) => setQuantity(event.target.value)} required type="number" value={quantity} /></label><button className="btn" disabled={mutation.isPending} type="submit">{mutation.isPending ? "Creating…" : "Create tables"}</button></div><p className="muted table-name-hint">Names are numbered automatically, for example “Patio 1”, “Patio 2”.</p>{message && <p aria-live="polite" className="table-create-message">{message}</p>}{mutation.error && <p className="error" role="alert">{mutation.error instanceof Error ? mutation.error.message : "Unable to create tables."}</p>}</form>
      <section aria-labelledby="configured-tables-heading" className="card table-list-card"><div className="table-list-heading"><h2 id="configured-tables-heading">Configured tables</h2><span className="tag">{tables.length} total</span></div>{query.error && <p className="error" role="alert">Unable to load tables.</p>}{tables.length ? <ul className="configured-table-list">{tables.map((table) => <li key={table.id}>{table.tableNumber}</li>)}</ul> : <p className="muted">No tables configured yet.</p>}</section>
    </div>
  );
}
