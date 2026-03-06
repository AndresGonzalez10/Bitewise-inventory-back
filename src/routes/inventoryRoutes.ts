import { Router } from 'express';
import { getInventory, addToInventory } from '../controllers/inventoryController';

const router = Router();

router.get('/:user_id', getInventory);
router.post('/', addToInventory);

export default router;