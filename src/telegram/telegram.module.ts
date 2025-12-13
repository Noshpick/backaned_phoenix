import { Module } from '@nestjs/common';
import { BotHttpController, TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotModule } from '../bot/bot.module';
import { TelegrafModule } from 'nestjs-telegraf';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    ConfigModule,
    BotModule,
    FilesModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>('TOKEN'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TelegramService],
  controllers: [BotHttpController]
})
export class TelegramModule {}