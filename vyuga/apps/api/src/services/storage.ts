import { put } from '@vercel/blob';

export async function uploadToBlob(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const { url } = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return url;
}
