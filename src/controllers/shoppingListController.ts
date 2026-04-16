import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { 
  generateListFromRecipeService, getUserListsService, purchaseListService,
  createManualListService, modifyItemInListService, removeItemFromListService, deleteListService 
} from '../services/shoppingListService';

export const generateFromRecipe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { recipe_id } = req.body;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
    if (!recipe_id) { res.status(400).json({ error: 'Falta recipe_id.' }); return; }

    const newList = await generateListFromRecipeService(user_id, Number(recipe_id));
    res.status(201).json({ message: 'Lista generada con éxito', list: newList });

  } catch (error: any) { 
    const status = error.message.includes('Ya tienes') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Error interno al generar la lista.' }); 
  }
};

export const getMyLists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }

    const lists = await getUserListsService(user_id); 
    res.json(lists);
  } catch (error) { 
    res.status(500).json({ error: 'Error al obtener listas' }); 
  }
};

export const completePurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { list_id } = req.body;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
    if (!list_id) { res.status(400).json({ error: 'Falta list_id.' }); return; }

    const result = await purchaseListService(Number(list_id), user_id);
    res.json(result);
  } catch (error: any) { 
    res.status(400).json({ error: error.message }); 
  }
};

export const createManualList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { name } = req.body;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
    if (!name) { res.status(400).json({ error: 'Falta el nombre de la lista.' }); return; }

    const newList = await createManualListService(user_id, name);
    res.status(201).json({ message: 'Lista manual creada', list: newList });
  } catch (error: any) { 
    res.status(400).json({ error: error.message }); 
  }
};

export const modifyItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { list_id, ingredient_id, quantity } = req.body;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
    if (!list_id || !ingredient_id || quantity === undefined) { res.status(400).json({ error: 'Faltan datos.' }); return; }

    const item = await modifyItemInListService(user_id, Number(list_id), Number(ingredient_id), Number(quantity));
    res.json({ message: 'Ingrediente guardado en tu lista', item });
  } catch (error: any) { 
    res.status(400).json({ error: error.message }); 
  }
};

export const removeItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { list_id, item_id } = req.body;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
    if (!list_id || !item_id) { res.status(400).json({ error: 'Faltan datos.' }); return; }

    await removeItemFromListService(user_id, Number(list_id), Number(item_id));
    res.json({ message: 'Ingrediente eliminado de tu lista' });
  } catch (error: any) { 
    res.status(400).json({ error: error.message }); 
  }
};

export const deleteList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    const { id } = req.params;

    if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }

    await deleteListService(user_id, Number(id));
    res.json({ message: 'Lista eliminada por completo' });
  } catch (error: any) { 
    res.status(400).json({ error: error.message }); 
  }
};