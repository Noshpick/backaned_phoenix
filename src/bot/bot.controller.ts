import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateNewsDto } from './dto/news.dto';
import { BotService } from './bot.service';
import { OrderDto } from '../order/dto/order.dto';

@Controller('api/news')
export class BotController {
  orderService: any;
  constructor(private readonly newsService: BotService) {}

  @Post()
  create(@Body() dto: CreateNewsDto) {
    return this.newsService.create(dto);
  }

  @Get()
  findAll() {
    return this.newsService.findAll();
  }

  @Get('latest')
  async findLatest() {
    const news = await this.newsService.findLatest();
    if (!news) {
      return null;
    }
    return news;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(Number(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const deleted = await this.newsService.remove(Number(id));
    if (!deleted) {
      throw new Error('News not found');
    }
    return { success: true };
  }
}
