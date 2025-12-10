import { PartialType } from '@nestjs/mapped-types';
import { CreateNewsDto } from './news.dto';

export class UpdateNewsDto extends PartialType(CreateNewsDto) {}