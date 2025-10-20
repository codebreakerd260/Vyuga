import { put } from '@vercel/blob';
import fetch from 'node-fetch';

// Quick Path: Use Hugging Face Inference API
export async function generateTryOn(
  personImageUrl: string,
  garmentImageUrl: string
): Promise<string> {

  const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
  const MODEL = 'Kolors/Kolors-Virtual-Try-On';

  // Download images as buffers
  const [personBuffer, garmentBuffer] = await Promise.all([
    fetch(personImageUrl).then(r => r.buffer()),
    fetch(garmentImageUrl).then(r => r.buffer())
  ]);

  // Call Hugging Face API
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          person_image: personBuffer.toString('base64'),
          garment_image: garmentBuffer.toString('base64')
        },
        parameters: {
          num_inference_steps: 30, // Lower for speed (Quick Path)
          guidance_scale: 2.0
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HF API error: ${error}`);
  }

  // Get result image
  const resultBuffer = await response.buffer();

  // Upload to Vercel Blob
  const { url } = await put(
    `results/${Date.now()}.jpg`,
    resultBuffer,
    {
      access: 'public',
      addRandomSuffix: true
    }
  );

  return url;
}
