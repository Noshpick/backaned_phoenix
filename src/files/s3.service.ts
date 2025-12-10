// src/files/s3.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicUrl = this.config.get<string>('S3_PUBLIC_URL')!;

    this.s3 = new S3Client({
      region: this.config.get<string>('S3_REGION') || 'ru-central1',
      endpoint: this.config.get<string>('S3_ENDPOINT') || 'https://storage.yandexcloud.net',
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: false, // у YandexCloud пусть будет false
    });
  }

  async uploadBuffer(buffer: Buffer, contentType: string): Promise<string> {
    const key = `news/${randomUUID()}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // чтобы фронтенд мог открывать картинку напрямую
    };

    await this.s3.send(new PutObjectCommand(params));

    return `${this.publicUrl}/${this.bucket}/${key}`;
  }
}