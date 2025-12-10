import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderDto } from './dto/order.dto';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}


  @Post('bot')
  @HttpCode(HttpStatus.CREATED)
  async sendAndSave(@Body() dto: OrderDto) {
    return this.orderService.sendAndSave(dto);
  }


}
