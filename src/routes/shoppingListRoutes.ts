import { Router } from 'express';
import { generateFromRecipe, getMyLists } from '../controllers/shoppingListController';

const router = Router();

router.post('/generate', generateFromRecipe);
router.get('/user/:user_id', getMyLists);

export default router;