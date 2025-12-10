import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class OrderDto{

    @IsString()
    @IsNotEmpty({ message: 'Имя обязательно' })
    name: string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsOptional()
    @IsString()
    username: string;
    
}