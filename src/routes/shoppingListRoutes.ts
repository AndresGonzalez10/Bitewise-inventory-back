import { Router } from 'express';
import { 
  generateFromRecipe, getMyLists, completePurchase, 
  createManualList, modifyItem, removeItem, deleteList 
} from '../controllers/shoppingListController';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', verifyToken, getMyLists);
router.post('/generate', verifyToken, generateFromRecipe);
router.post('/purchase', verifyToken, completePurchase);

router.post('/manual', verifyToken, createManualList);
router.post('/manual/item', verifyToken, modifyItem);
router.post('/manual/item/remove', verifyToken, removeItem);
router.delete('/:id', verifyToken, deleteList); 

export default router;