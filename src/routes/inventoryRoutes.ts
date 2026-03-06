import { Router } from 'express';
import { getInventory, addToInventory, cookRecipe } from '../controllers/inventoryController';

const router = Router();

router.get('/:user_id', getInventory);
router.post('/', addToInventory);
router.post('/cook', cookRecipe);

export default router;