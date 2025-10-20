'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Camera, Loader2 } from 'lucide-react';
import { tryonAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function TryOnUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const garmentId = searchParams.get('garmentId');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!garmentId) {
    return <div className="p-8 text-center">No garment selected</div>;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('garmentId', garmentId);

      const { data } = await tryonAPI.upload(formData);

      toast.success('Processing your try-on...');
      router.push(`/try-on/${data.sessionId}`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Upload Your Photo
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Photo Guidelines */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">📸 Photo Tips:</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>• Stand straight facing the camera</li>
              <li>• Good lighting (avoid shadows)</li>
              <li>• Plain background preferred</li>
              <li>• Full upper body visible</li>
            </ul>
          </div>

          {/* Upload Area */}
          {!preview ? (
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center cursor-pointer hover:border-purple-500 transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                JPEG, PNG (max 10MB)
              </p>
            </label>
          ) : (
            <div>
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-lg mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Change Photo
                </button>

                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Try On'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
