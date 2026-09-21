import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

export const productUploadDirectory = path.resolve(process.cwd(), 'uploads', 'products');
export const maxProductImageBytes = 5 * 1024 * 1024;

mkdirSync(productUploadDirectory, { recursive: true });

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: productUploadDirectory,
  filename(_request, file, callback) {
    callback(null, `${randomUUID()}${extensions[file.mimetype]}`);
  },
});

export const productImageUpload = multer({
  storage,
  limits: { fileSize: maxProductImageBytes, files: 1 },
  fileFilter(_request, file, callback) {
    if (!extensions[file.mimetype]) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
      return;
    }
    callback(null, true);
  },
});
