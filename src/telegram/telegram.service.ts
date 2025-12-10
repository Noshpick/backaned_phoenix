// src/telegram/telegram.service.ts
import { Update, Start, On, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { BotService } from '../bot/bot.service';
import axios from 'axios';
import { S3Service } from 'src/files/s3.service';
import {
  Controller,
  Post,
  Body,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { OrderDto } from 'src/order/dto/order.dto';

type TgContext = Context & {
  message?: any;
};

interface PhotoSession {
  userId: number;
  photos: Array<{ fileId: string; filePath?: string }>;
  mediaGroupId?: string;
  timestamp: number;
}

@Update()
export class TelegramService {
  private readonly adminIds: number[];
  // Хранилище сессий для сбора фото (в продакшене лучше использовать Redis)
  private photoSessions: Map<string, PhotoSession> = new Map();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 минут

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    const admins = this.configService.get<string>('ADMIN_ID') || '';
    this.adminIds = admins
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => Number(id));

    console.log('TelegramService init, admins:', this.adminIds);

    // Очистка устаревших сессий каждые 5 минут
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
  }

  private isAdmin(ctx: TgContext): boolean {
    const fromId = ctx.from?.id;
    if (!fromId) return false;
    return this.adminIds.includes(fromId);
  }

  private cleanupSessions() {
    const now = Date.now();
    for (const [key, session] of this.photoSessions.entries()) {
      if (now - session.timestamp > this.SESSION_TIMEOUT) {
        this.photoSessions.delete(key);
      }
    }
  }

  private getSessionKey(userId: number, mediaGroupId?: string): string {
    return mediaGroupId ? `${userId}_${mediaGroupId}` : `${userId}_single`;
  }

  @Start()
  async onStart(@Ctx() ctx: TgContext) {
    console.log('onStart from', ctx.from?.id);

    if (!this.isAdmin(ctx)) {
      await ctx.reply('Доступ запрещён.');
      return;
    }

    // Очищаем старые сессии для этого пользователя
    const userId = ctx.from?.id;
    if (userId) {
      for (const [key, sess] of this.photoSessions.entries()) {
        if (sess.userId === userId) {
          this.photoSessions.delete(key);
        }
      }
    }

    await ctx.reply(
      '👋 Добро пожаловать!\n\n' +
        '📝 Создать новость:\n' +
        'Отправьте фото новости (можно несколько).\n' +
        'После отправки всех фото отправьте текст:\n' +
        'Первая строка — заголовок (RU)\n' +
        'Остальное — текст новости (RU).\n\n' +
        '📋 Показать все новости: /list\n' +
        '🗑️ Удалить новость: /delete <id>',
    );
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: TgContext) {
    console.log('onPhoto from', ctx.from?.id);

    if (!this.isAdmin(ctx)) {
      console.log('Not admin, access denied');
      await ctx.reply('Доступ запрещён.');
      return;
    }

    const message = ctx.message;
    if (!message || !('photo' in message)) {
      console.log('No photo in message');
      await ctx.reply('Не удалось прочитать фото.');
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Не удалось определить пользователя.');
      return;
    }

    const photoSizes = message.photo as { file_id: string }[];
    const largestPhoto = photoSizes[photoSizes.length - 1];
    const fileId = largestPhoto.file_id;
    const mediaGroupId = (message as any).media_group_id;

    // Игнорируем подпись к фото - текст должен быть отдельным сообщением
    // Сохраняем фото в сессию
    const sessionKey = this.getSessionKey(userId, mediaGroupId);
    let session = this.photoSessions.get(sessionKey);

    if (!session) {
      session = {
        userId,
        photos: [],
        mediaGroupId,
        timestamp: Date.now(),
      };
      this.photoSessions.set(sessionKey, session);
    }

    // Добавляем фото в сессию, если его еще нет
    if (!session.photos.find((p) => p.fileId === fileId)) {
      session.photos.push({ fileId });
      session.timestamp = Date.now(); // Обновляем время последнего фото
      console.log(
        `Photo added to session. Total photos: ${session.photos.length}`,
      );
      console.log(`Session key: ${sessionKey}`);
      console.log(`All sessions:`, Array.from(this.photoSessions.keys()));

      if (session.photos.length === 1) {
        await ctx.reply(
          '✅ Фото получено.\n\n' +
            'Можно отправить ещё фото или сразу отправьте текст:\n' +
            'Первая строка — заголовок (RU)\n' +
            'Остальное — текст новости (RU).',
        );
      } else {
        await ctx.reply(
          `✅ Фото ${session.photos.length} получено.\n\n` +
            `Отправьте текст новости (заголовок + описание).`,
        );
      }
    } else {
      console.log('Photo already in session, skipping');
    }
  }

  @On('message')
  async onMessage(@Ctx() ctx: TgContext) {
    // Обрабатываем только текстовые сообщения (не команды, не фото)
    const message = ctx.message;
    if (!message) return;

    // Если это фото, пропускаем (обрабатывается в onPhoto)
    if ('photo' in message) {
      return;
    }

    // Если это не текст, пропускаем
    if (!('text' in message)) {
      return;
    }

    // Если это команда, обрабатываем отдельно
    const text = message.text?.trim() || '';
    if (text.startsWith('/')) {
      await this.handleCommand(ctx, text);
      return;
    }

    // Обрабатываем как текст новости
    await this.handleTextMessage(ctx);
  }

  private async handleCommand(@Ctx() ctx: TgContext, command: string) {
    if (!this.isAdmin(ctx)) {
      await ctx.reply('Доступ запрещён.');
      return;
    }

    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    if (cmd === '/list') {
      await this.handleListCommand(ctx);
    } else if (cmd === '/delete' && parts.length > 1) {
      const id = parseInt(parts[1], 10);
      if (isNaN(id)) {
        await ctx.reply('❌ Неверный ID. Используйте: /delete <id>');
        return;
      }
      await this.handleDeleteCommand(ctx, id);
    } else if (cmd === '/start') {
      // Команда /start обрабатывается отдельным декоратором
      return;
    } else {
      await ctx.reply(
        '❓ Неизвестная команда.\n\n' +
          'Доступные команды:\n' +
          '/start - Начать работу\n' +
          '/list - Показать все новости\n' +
          '/delete <id> - Удалить новость',
      );
    }
  }

  private async handleListCommand(@Ctx() ctx: TgContext) {
    try {
      const allNews = await this.botService.findAll();

      if (!allNews || allNews.length === 0) {
        await ctx.reply('📭 Новостей пока нет.');
        return;
      }

      let message = `📋 Всего новостей: ${allNews.length}\n\n`;

      // Ограничиваем количество новостей в одном сообщении (Telegram лимит ~4096 символов)
      const maxNewsPerMessage = 20;
      const newsToShow = allNews.slice(0, maxNewsPerMessage);

      for (const news of newsToShow) {
        const date = new Date(news.createdAt).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const title =
          news.titleRu.length > 50
            ? news.titleRu.substring(0, 47) + '...'
            : news.titleRu;

        message += `📰 ID: ${news.id}\n`;
        message += `📅 ${date}\n`;
        message += `📝 ${title}\n\n`;
      }

      if (allNews.length > maxNewsPerMessage) {
        message += `\n... и ещё ${allNews.length - maxNewsPerMessage} новостей`;
      }

      message += `\n\n🗑️ Для удаления используйте: /delete <id>`;

      await ctx.reply(message);
    } catch (error) {
      console.error('Error in handleListCommand:', error);
      await ctx.reply('❌ Ошибка при получении списка новостей.');
    }
  }

  private async handleDeleteCommand(@Ctx() ctx: TgContext, id: number) {
    try {
      // Сначала проверяем, существует ли новость
      const news = await this.botService.findOne(id);

      if (!news) {
        await ctx.reply(`❌ Новость с ID ${id} не найдена.`);
        return;
      }

      // Удаляем новость
      const deleted = await this.botService.remove(id);

      if (deleted) {
        await ctx.reply(
          `✅ Новость удалена!\n\n` +
            `ID: ${id}\n` +
            `Заголовок: ${news.titleRu}`,
        );
      } else {
        await ctx.reply(`❌ Не удалось удалить новость с ID ${id}.`);
      }
    } catch (error) {
      console.error('Error in handleDeleteCommand:', error);
      await ctx.reply('❌ Ошибка при удалении новости.');
    }
  }

  private async handleTextMessage(@Ctx() ctx: TgContext) {
    console.log('handleTextMessage called from', ctx.from?.id);
    console.log('Message:', ctx.message);

    if (!this.isAdmin(ctx)) {
      console.log('Not admin, ignoring text');
      return;
    }

    const message = ctx.message;
    if (!message || !('text' in message)) {
      console.log('No text in message');
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Не удалось определить пользователя.');
      return;
    }

    const text = message.text.trim();
    console.log('Text received:', text);
    console.log('Text length:', text.length);

    if (!text) {
      console.log('Empty text, ignoring');
      return;
    }

    // Ищем самую свежую активную сессию для этого пользователя
    console.log('Looking for session for user:', userId);
    console.log(
      'Active sessions:',
      Array.from(this.photoSessions.entries()).map(([k, v]) => ({
        key: k,
        userId: v.userId,
        photosCount: v.photos.length,
      })),
    );

    let session: PhotoSession | undefined;
    let latestTimestamp = 0;
    let sessionKey: string | undefined;

    for (const [key, sess] of this.photoSessions.entries()) {
      if (sess.userId === userId && sess.timestamp > latestTimestamp) {
        session = sess;
        latestTimestamp = sess.timestamp;
        sessionKey = key;
      }
    }

    console.log(
      'Found session:',
      session
        ? { photosCount: session.photos.length, timestamp: session.timestamp }
        : 'none',
    );

    if (!session || session.photos.length === 0) {
      console.log('No session or no photos found');
      await ctx.reply(
        'Сначала отправьте фото новости.\n' + 'Используйте /start для начала.',
      );
      return;
    }

    console.log('Processing text with photos...');
    // Обрабатываем текст и все собранные фото
    await this.processPhotosWithText(ctx, userId, text, session, sessionKey);
  }

  private async processPhotosWithText(
    ctx: TgContext,
    userId: number,
    text: string,
    session: PhotoSession,
    sessionKey?: string,
  ) {
    // Удаляем сессию сразу, чтобы избежать повторной обработки
    if (sessionKey) {
      this.photoSessions.delete(sessionKey);
    } else {
      // Если ключ не передан, ищем и удаляем все сессии этого пользователя
      for (const [key, sess] of this.photoSessions.entries()) {
        if (sess.userId === userId && sess.timestamp === session.timestamp) {
          this.photoSessions.delete(key);
          break;
        }
      }
    }

    const allFileIds = session.photos.map((p) => p.fileId);

    if (allFileIds.length === 0) {
      await ctx.reply('Не удалось получить фото.');
      return;
    }

    // Разбиваем текст на строки, учитывая что между заголовком и текстом могут быть пустые строки
    const allLines = text.split('\n').map((l: string) => l.trim());
    const nonEmptyLines = allLines.filter(Boolean);

    console.log('All lines:', allLines);
    console.log('Non-empty lines:', nonEmptyLines);
    console.log('Non-empty lines count:', nonEmptyLines.length);

    if (nonEmptyLines.length < 2) {
      console.log('Not enough lines, need at least 2');
      await ctx.reply(
        'Минимум две строки: первая — заголовок, дальше — текст новости.\n' +
          'Попробуйте ещё раз.\n\n' +
          `Получено непустых строк: ${nonEmptyLines.length}`,
      );
      // Восстанавливаем сессию, если текст неправильный
      if (sessionKey) {
        this.photoSessions.set(sessionKey, session);
      }
      return;
    }

    // Первая непустая строка - заголовок
    const titleRu = nonEmptyLines[0];
    // Все остальные непустые строки - текст новости
    const contentRu = nonEmptyLines.slice(1).join('\n');

    console.log('Title:', titleRu);
    console.log('Content length:', contentRu.length);

    // Загружаем все фото в S3
    const botToken = this.configService.getOrThrow<string>('TOKEN');
    const uploadedPhotos: string[] = [];

    for (let i = 0; i < allFileIds.length; i++) {
      const fileId = allFileIds[i];
      try {
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

        const response = await axios.get<ArrayBuffer>(fileUrl, {
          responseType: 'arraybuffer',
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';

        const s3Url = await this.s3Service.uploadBuffer(buffer, contentType);
        uploadedPhotos.push(s3Url);

        console.log(`Photo ${i + 1}/${allFileIds.length} uploaded to S3`);
      } catch (error) {
        console.error(`Error uploading photo ${fileId}:`, error);
        await ctx.reply(`Ошибка при загрузке фото ${i + 1}. Продолжаю...`);
      }
    }

    if (uploadedPhotos.length === 0) {
      await ctx.reply('Не удалось загрузить ни одного фото.');
      return;
    }

    // Первое фото — основное, остальные — в массив
    const mainPhoto = uploadedPhotos[0];
    const additionalPhotos = uploadedPhotos.slice(1);

    const created = await this.botService.create({
      titleRu,
      contentRu,
      photo: mainPhoto,
      photos: additionalPhotos,
      titleEn: undefined,
      contentEn: undefined,
    });

    await ctx.reply(
      `✅ Новость сохранена!\n\n` +
        `ID: ${created.id}\n` +
        `Загружено фото: ${uploadedPhotos.length}\n\n` +
        `Используйте /start для создания новой новости.`,
    );
  }
}

@Controller('/api/bot')
export class BotHttpController {
  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async receiveOrder(
    @Body()
    body: OrderDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const expectedKey = this.configService.getOrThrow<string>('TOKEN');

    const CHAT_ID = this.configService.getOrThrow<string>('ADMIN_ID');

    const msg = [
      '🆕 Новый заказ',
      body.name && `Имя: ${body.name}`,
      body.phone && `Телефон: ${body.phone}`,
      body.username && `username ${body.username}`,
    ]
      .filter(Boolean)
      .join('\n');

    await this.bot.telegram.sendMessage(Number(CHAT_ID), msg);

    return { ok: true };
  }
}
