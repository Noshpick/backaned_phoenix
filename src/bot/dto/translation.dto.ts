import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranslationDto {
  @IsString()
  @IsNotEmpty({ message: 'Русская версия обязательна' })
  ru: string;

  @IsOptional()
  @IsString()
  en?: string;
}