export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Invalid ${entity} transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertTransition(
  entity: string,
  from: string,
  to: string,
  transitions: Record<string, readonly string[]>,
): void {
  if (!transitions[from]?.includes(to)) {
    throw new InvalidTransitionError(entity, from, to);
  }
}

export const ORDER_TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'SENT_TO_KITCHEN', 'CANCELLED'],
  CONFIRMED: ['SENT_TO_KITCHEN', 'CANCELLED'],
  SENT_TO_KITCHEN: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
} as const;

export const KOT_TRANSITIONS = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
} as const;
