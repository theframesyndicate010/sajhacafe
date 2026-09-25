import { assertTransition, ORDER_TRANSITIONS } from '../src/common/domain/state-machine';

describe('order state transitions', () => {
  it('allows an order created as DRAFT to be sent straight to the kitchen', () => {
    expect(() => assertTransition('order', 'DRAFT', 'SENT_TO_KITCHEN', ORDER_TRANSITIONS)).not.toThrow();
  });
});
