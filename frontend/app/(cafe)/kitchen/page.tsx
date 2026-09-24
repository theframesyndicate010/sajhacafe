"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type KitchenOrder } from "@/lib/api/client";

const statuses: KitchenOrder["status"][] = ["PENDING", "PREPARING", "READY", "COMPLETED"];

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ["kots"], queryFn: api.kots, refetchInterval: 15_000 });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: KitchenOrder["status"] }) => status === "PENDING" ? api.startKot(id) : status === "PREPARING" ? api.readyKot(id) : api.completeKot(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kots"] }),
  });

  if (isLoading) return <p className="muted">Loading kitchen orders…</p>;
  if (error) return <p className="error">{error.message}</p>;

  return <>
    <div><h1 className="page-title">Kitchen display</h1><p className="muted">Live KOT queue from the backend.</p></div>
    <section className="grid kitchen" style={{ marginTop: 20 }}>
      {statuses.map((status) => <div className="column" key={status}>
        <strong>{status} ({orders.filter((order) => order.status === status).length})</strong>
        {orders.filter((order) => order.status === status).map((order) => <article className="card kot" key={order.id}>
          <strong>KOT #{order.kotNumber}</strong><span className="muted" style={{ float: "right" }}>{order.order.table?.tableNumber || "Takeaway"}</span>
          <div style={{ margin: "14px 0" }}>{order.items.map((item) => <div key={item.orderItem.itemName}>{item.orderItem.itemName} × {String(item.quantity)}</div>)}</div>
          {status !== "COMPLETED" && <button className="btn" style={{ display: "block", width: "100%", marginTop: 14 }} disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, status })}>{status === "PENDING" ? "Start" : status === "PREPARING" ? "Mark ready" : "Mark completed"}</button>}
        </article>)}
      </div>)}
    </section>
  </>;
}
