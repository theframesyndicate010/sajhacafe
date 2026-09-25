import { assertTransition, ORDER_TRANSITIONS } from '../src/common/domain/state-machine';

describe('order state transitions', () => {
  it('allows an order created as DRAFT to be sent straight to the kitchen', () => {
    expect(() => assertTransition('order', 'DRAFT', 'SENT_TO_KITCHEN', ORDER_TRANSITIONS)).not.toThrow();
  });

  it('allows a waiter to mark an active order served without cooking or ready transitions', () => {
    for (const status of ['DRAFT', 'CONFIRMED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY']) {
      expect(() => assertTransition('order', status, 'SERVED', ORDER_TRANSITIONS)).not.toThrow();
    }
  });
});
