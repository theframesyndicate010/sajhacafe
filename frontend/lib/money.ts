export type SettledPayment = { amount: number | string; status?: string | null };

/** Payment states that must never count towards a settled total. */
const unsettledStatuses = new Set(["PENDING", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]);

/** Mirrors `money()` in backend/src/common/domain/order-calculations.ts. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Sums the money actually received against an order or bill.
 *
 * The API already filters to `COMPLETED` when it includes payments, but
 * `bills.service.ts` selects a narrow field set that omits `status`, so a
 * missing status is treated as settled. Refunds are excluded so a refunded
 * payment stops counting as paid.
 */
export function settledTotal(payments: SettledPayment[] | null | undefined): number {
  return roundMoney(
    (payments ?? [])
      .filter((payment) => !payment.status || !unsettledStatuses.has(String(payment.status)))
      .reduce((sum, payment) => sum + Number(payment.amount), 0),
  );
}

/** Outstanding balance for a total that already has `paid` settled against it. */
export function balanceDue(total: number | string, paid: number): number {
  return roundMoney(Math.max(Number(total) - paid, 0));
}
