import { Injectable } from '@nestjs/common';
import { OrderDto } from './dto/order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
    constructor(private prisma: PrismaService) {}


    private async sendMessage(dto: OrderDto) {
        const payload = {
          name: dto.name,
          phone: dto.phone,
          username: dto.username,
        };
    
        const response = await fetch('http://localhost:3000/api/bot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-secret-api-key',
          },
          body: JSON.stringify(payload),
        });
    
        const result = await response.json();
        console.log(result);
        return result;
      }
    
      private createOrder(dto: OrderDto) {
        return this.prisma.order.create({
          data: {
            name: dto.name,
            phone: dto.phone,
            username: dto.username,
          },
        });
      }
    
      async sendAndSave(dto: OrderDto) {
        const [send, save] = await Promise.all([
          this.sendMessage(dto),
          this.createOrder(dto),
        ]);
    
        return { send, save };
      }
}
