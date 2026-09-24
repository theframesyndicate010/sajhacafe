import { Module } from '@nestjs/common';
import { KotController } from './kot.controller';
@Module({ controllers: [KotController] })
export class KotModule {}
