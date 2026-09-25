import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { UsersModule } from './users/users.module';
import { MenuModule } from './menu/menu.module';
import { RecipesModule } from './recipes/recipes.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { KotModule } from './kot/kot.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { PaymentsModule } from './payments/payments.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { BillsModule } from './bills/bills.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    PermissionsModule,
    UsersModule,
    MenuModule,
    RecipesModule,
    TablesModule,
    OrdersModule,
    BillsModule,
    KotModule,
    KitchenModule,
    PaymentsModule,
    CustomersModule,
    InventoryModule,
    PurchasesModule,
    SuppliersModule,
    ExpensesModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
