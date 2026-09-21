import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { adminProductService } from '../services/adminProductService.js';
import type { AdminProductService } from '../services/adminProductService.js';
import multer from 'multer';

function sendError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Admin product request failed:', error);
  response.status(500).json({ error: { code: 'ADMIN_PRODUCT_FAILED', message: 'Unable to process the product request.' } });
}

export function createAdminProductController(service: AdminProductService = adminProductService) {
  return {
    async list(_request: Request, response: Response) {
      try { response.json({ data: await service.listProducts() }); } catch (error) { sendError(response, error); }
    },
    async options(_request: Request, response: Response) {
      try { response.json({ data: await service.getProductOptions() }); } catch (error) { sendError(response, error); }
    },
    async get(request: Request, response: Response) {
      try { response.json({ data: await service.getProduct(String(request.params.business), String(request.params.id)) }); }
      catch (error) { sendError(response, error); }
    },
    async create(request: Request, response: Response) {
      try { response.status(201).json({ data: await service.createProduct(request.body) }); }
      catch (error) { sendError(response, error); }
    },
    async update(request: Request, response: Response) {
      try { response.json({ data: await service.updateProduct(String(request.params.business), String(request.params.id), request.body) }); }
      catch (error) { sendError(response, error); }
    },
    async remove(request: Request, response: Response) {
      try {
        await service.deleteProduct(String(request.params.business), String(request.params.id));
        response.status(204).end();
      } catch (error) { sendError(response, error); }
    },
    uploadImage(request: Request, response: Response) {
      if (!request.file) {
        response.status(400).json({ error: { code: 'IMAGE_REQUIRED', message: 'Choose one JPEG, PNG, or WEBP image.' } });
        return;
      }
      response.status(201).json({ data: { image_url: `/uploads/products/${request.file.filename}` } });
    },
  };
}

export function sendUploadError(response: Response, error: unknown) {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    response.status(tooLarge ? 413 : 400).json({ error: {
      code: tooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE',
      message: tooLarge ? 'Image files must be 5 MB or smaller.' : 'Upload exactly one JPEG, PNG, or WEBP image.',
    } });
    return;
  }
  sendError(response, error);
}
