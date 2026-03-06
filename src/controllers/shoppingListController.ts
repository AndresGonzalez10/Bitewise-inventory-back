import { Request, Response } from 'express';
import { generateListFromRecipeService, getUserListsService } from '../services/shoppingListService';

export const generateFromRecipe = async (req: Request, res: Response): Promise<void> => {
  const { user_id, recipe_id } = req.body;
  try {
    const newList = await generateListFromRecipeService(user_id as string, Number(recipe_id));
    res.status(201).json({ message: 'Lista de compras generada', list: newList });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getMyLists = async (req: Request, res: Response): Promise<void> => {
  const { user_id } = req.params;
  try {
    const lists = await getUserListsService(user_id as string); 
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener listas' });
  }
};