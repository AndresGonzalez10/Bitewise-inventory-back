import { Router } from 'express';
import { generateFromRecipe, getMyLists, completePurchase } from '../controllers/shoppingListController';

const router = Router();

router.post('/generate', generateFromRecipe);
router.get('/user/:user_id', getMyLists);
router.post('/purchase', completePurchase);

export default router;