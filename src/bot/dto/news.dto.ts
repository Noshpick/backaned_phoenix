// src/news/dto/create-news.dto.ts
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  titleRu: string;

  @IsString()
  @IsOptional()
  titleEn?: string;

  @IsString()
  @IsNotEmpty()
  contentRu: string;

  @IsString()
  @IsOptional()
  contentEn?: string;

  @IsString()
  @IsNotEmpty()
  photo: string; // Основное фото (для обратной совместимости)

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[]; // Массив фото
}