import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({});

export async function putRawPayload(bucket: string, key: string, body: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  );
}
