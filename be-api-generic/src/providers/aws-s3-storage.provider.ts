/**
 * AWS S3 Storage Provider Implementation
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import config from '../config';
import logger from '../config/logger';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
  DownloadResult,
} from '../interfaces/storage-provider.interface';

export class AwsS3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.client = new S3Client({
      region: config.AWS_REGION!,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID!,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = config.AWS_S3_BUCKET_NAME!;
  }

  async initialize(): Promise<void> {
    try {
      // Check if bucket exists
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
        logger.info(`AWS S3 bucket '${this.bucketName}' already exists`);
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          // Create bucket if it doesn't exist
          await this.client.send(
            new CreateBucketCommand({
              Bucket: this.bucketName,
              CreateBucketConfiguration: {
                LocationConstraint: config.AWS_REGION !== 'us-east-1' ? config.AWS_REGION : undefined,
              },
            })
          );
          logger.info(`AWS S3 bucket '${this.bucketName}' created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to initialize AWS S3 bucket:', error);
      throw error;
    }
  }

  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { buffer, filename, mimetype, size } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
        ContentLength: size,
      });

      await this.client.send(command);

      // Generate URL (note: for production, you might want to use presigned URLs)
      const url = `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${filename}`;

      logger.info(`File uploaded to AWS S3: ${filename}`);

      return {
        key: filename,
        url,
        size,
        mimetype,
      };
    } catch (error) {
      logger.error(`Failed to upload file to AWS S3: ${filename}`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return {
        buffer,
        mimetype: response.ContentType || 'application/octet-stream',
        filename: key,
      };
    } catch (error) {
      logger.error(`Failed to download file from AWS S3: ${key}`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      logger.info(`File deleted from AWS S3: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete file from AWS S3: ${key}`, error);
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key: string): Promise<{ size: number; mimetype: string; lastModified: Date }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        size: response.ContentLength || 0,
        mimetype: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
      };
    } catch (error) {
      logger.error(`Failed to get file metadata from AWS S3: ${key}`, error);
      throw error;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.client.send(command);

      const metadata = await this.getFileMetadata(destinationKey);
      const url = `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${destinationKey}`;

      logger.info(`File copied in AWS S3: ${sourceKey} -> ${destinationKey}`);

      return {
        key: destinationKey,
        url,
        size: metadata.size,
        mimetype: metadata.mimetype,
      };
    } catch (error) {
      logger.error(`Failed to copy file in AWS S3: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.client.send(command);
      const files = response.Contents?.map((obj) => obj.Key || '') || [];

      return files.filter((key) => key !== '');
    } catch (error) {
      logger.error(`Failed to list files from AWS S3`, error);
      throw error;
    }
  }
}
