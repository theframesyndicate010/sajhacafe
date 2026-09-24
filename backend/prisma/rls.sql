-- Supabase defense-in-depth policies for tenant-owned tables.
-- The NestJS application remains responsible for authorization and query scoping.
-- Before applying this file, configure the runtime connection to set:
--   SET LOCAL app.tenant_id = '<authenticated tenant UUID>'
-- inside each transaction that accesses tenant data.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'RestaurantSettings', 'Category', 'MenuItem', 'Recipe', 'RecipeItem',
    'RestaurantTable', 'Customer', 'Order', 'OrderItem', 'Kot', 'KotItem',
    'Payment', 'Refund', 'InventoryItem', 'StockMovement', 'Supplier',
    'Purchase', 'PurchaseItem', 'Expense', 'CustomerLedgerEntry', 'AuditLog'
  ] LOOP
    EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON "%s"', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON "%s" USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())',
      table_name
    );
  END LOOP;
END $$;
