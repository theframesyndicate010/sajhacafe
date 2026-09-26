import type { PrinterConfig, ReceiptData } from "./types";
import { thermalPrint } from "./bridge-client";
const pending = new Map<string, Promise<void>>();
const completed = new Set<string>();
export function enqueuePrint(id: string, receipt: ReceiptData, config: PrinterConfig, update: (state: "printing" | "printed" | "failed", error?: string) => void) {
  if (pending.has(id) || completed.has(id)) return;
  update("printing");
  const previous = [...pending.values()].at(-1) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(async () => { try { await thermalPrint(receipt, config); completed.add(id); update("printed"); } catch (error) { update("failed", error instanceof Error ? error.message : "Print failed."); } }).finally(() => pending.delete(id));
  pending.set(id, job);
}
