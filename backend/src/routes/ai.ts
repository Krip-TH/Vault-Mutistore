import { Router } from 'express';
import { getRecommendations, postChat, postDescribe, postSearch } from '../controllers/aiController.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';

export function createAiRouter(): Router {
  const router = Router();
  router.use(aiRateLimit);
  router.post('/search', postSearch);
  router.post('/chat', postChat);
  router.get('/recommend/:productId', getRecommendations);
  router.post('/describe', postDescribe);
  return router;
}
