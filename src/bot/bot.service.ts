import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto } from './dto/news.dto';
import { News } from '@prisma/client';
import { OrderDto } from '../order/dto/order.dto';

interface CreateNewsInput {
  titleRu: string;
  contentRu: string;
  photo: string;
  titleEn?: string;
  contentEn?: string;
  photos?: string[];
}

@Injectable()
export class BotService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateNewsInput): Promise<News> {
    console.log('BotService.create called with:', data);

    try {
      const created = await this.prisma.news.create({
        data: {
          titleRu: data.titleRu,
          contentRu: data.contentRu,
          photo: data.photo,
          photos: data.photos || [],
          titleEn: data.titleEn ?? null,
          contentEn: data.contentEn ?? null,
        },
      });

      console.log('BotService.create result:', created);
      return created;
    } catch (error: any) {
      // Если поле photos не существует (миграция не применена), создаем без него
      if (error.code === 'P2022' && error.meta?.column === 'photos') {
        console.warn('Column photos does not exist, creating without it');
        const created = await this.prisma.news.create({
          data: {
            titleRu: data.titleRu,
            contentRu: data.contentRu,
            photo: data.photo,
            titleEn: data.titleEn ?? null,
            contentEn: data.contentEn ?? null,
          },
        });
        // Добавляем photos вручную для обратной совместимости
        return { ...created, photos: data.photos || [] } as News;
      }
      throw error;
    }
  }

  async findAll() {
    try {
      const newsList = await this.prisma.news.findMany({
        orderBy: { createdAt: 'desc' },
      });
      // Добавляем photos если его нет (для обратной совместимости)
      return newsList.map((news) => ({
        ...news,
        photos: (news as any).photos || [],
      }));
    } catch (error) {
      console.error('Error in findAll:', error);
      // Fallback без photos
      const newsList = await this.prisma.news.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          titleRu: true,
          titleEn: true,
          contentRu: true,
          contentEn: true,
          photo: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return newsList.map((news) => ({ ...news, photos: [] }));
    }
  }

  async findOne(id: number) {
    try {
      const news = await this.prisma.news.findUnique({ where: { id } });
      if (!news) return null;
      return {
        ...news,
        photos: (news as any).photos || [],
      };
    } catch (error) {
      console.error('Error in findOne:', error);
      // Fallback без photos
      const news = await this.prisma.news.findUnique({
        where: { id },
        select: {
          id: true,
          titleRu: true,
          titleEn: true,
          contentRu: true,
          contentEn: true,
          photo: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return news ? { ...news, photos: [] } : null;
    }
  }

  async findLatest() {
    try {
      const news = await this.prisma.news.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      // Если новостей нет, возвращаем null вместо ошибки
      return news;
    } catch (error) {
      console.error('Error in findLatest:', error);
      // Если поле photos не существует (миграция не применена), пробуем без него
      try {
        const news = await this.prisma.news.findFirst({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            titleRu: true,
            titleEn: true,
            contentRu: true,
            contentEn: true,
            photo: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        // Добавляем пустой массив photos для обратной совместимости
        return news ? { ...news, photos: [] } : null;
      } catch (fallbackError) {
        console.error('Fallback error in findLatest:', fallbackError);
        throw error;
      }
    }
  }

  async remove(id: number): Promise<boolean> {
    try {
      const deleted = await this.prisma.news.delete({
        where: { id },
      });
      return !!deleted;
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Record not found
        return false;
      }
      throw error;
    }
  }
}
