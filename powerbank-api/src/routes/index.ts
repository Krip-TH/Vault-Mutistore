import { Router } from 'express';
import {
  createPowerbank,
  deletePowerbank,
  getHealth,
  getPowerbankById,
  getPowerbanks,
  updatePowerbank,
} from '../controllers/powerbankController.js';

const router = Router();
router.get('/health', getHealth);
router.get('/powerbank', getPowerbanks);
router.get('/powerbank/:id', getPowerbankById);
router.post('/powerbank', createPowerbank);
router.put('/powerbank/:id', updatePowerbank);
router.delete('/powerbank/:id', deletePowerbank);
export default router;
