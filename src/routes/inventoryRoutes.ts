import { Router } from 'express';
import { getInventory, addToInventory, cookRecipe, removeFromInventory } from '../controllers/inventoryController';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', verifyToken, getInventory);
router.post('/', verifyToken, addToInventory);
router.post('/remove', verifyToken, removeFromInventory);
router.post('/cook', verifyToken, cookRecipe);

export default router;