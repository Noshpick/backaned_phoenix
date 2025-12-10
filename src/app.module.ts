import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BotModule } from './bot/bot.module';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { FilesModule } from './files/files.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [BotModule, PrismaModule, TelegramModule, FilesModule, OrderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
