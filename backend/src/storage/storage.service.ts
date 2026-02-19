import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', 'humanecare-docs-dev');
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /**
   * Generate a presigned URL for uploading a file to S3.
   * Key format: {orgId}/{clinicianId}/{itemId}/{uuid}-{fileName}
   */
  async getUploadUrl(params: {
    organizationId: string;
    clinicianId: string;
    itemId: string;
    fileName: string;
    contentType: string;
  }) {
    const key = `${params.organizationId}/${params.clinicianId}/${params.itemId}/${randomUUID()}-${params.fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return { url, key };
  }

  /**
   * Generate a presigned URL for uploading a file with a specific S3 key.
   */
  async getUploadUrlForKey(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return { url, key };
  }

  /**
   * Generate a presigned URL for downloading a file from S3.
   */
  async getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    return { url };
  }
}
