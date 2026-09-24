import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsService } from './payments.service';
@Module({
  imports: [InventoryModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
