import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getUserInventoryService, addIngredientToInventoryService, cookRecipeService, removeIngredientFromInventoryService } from '../services/inventoryService';

export const getInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  const user_id = req.user?.userId;
  if (!user_id) { res.status(401).json({ error: 'No autorizado. Debes iniciar sesión.' }); return; }

  try {
    const inventory = await getUserInventoryService(user_id);
    res.json({ message: 'Refri obtenido exitosamente', items: inventory });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const addToInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  const user_id = req.user?.userId;
  const { ingredient_id, quantity } = req.body;

  if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
  if (!ingredient_id || quantity === undefined) { res.status(400).json({ error: 'Faltan datos obligatorios.' }); return; }

  try {
    const updatedItem = await addIngredientToInventoryService({ user_id, ingredient_id, quantity_units: quantity });
    res.status(200).json({ message: 'Ingrediente sumado al refri', item: updatedItem });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// 👇 NUEVA FUNCIÓN
export const removeFromInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  const user_id = req.user?.userId;
  const { ingredient_id, quantity } = req.body;

  if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
  if (!ingredient_id || quantity === undefined) { res.status(400).json({ error: 'Faltan datos obligatorios.' }); return; }

  try {
    const updatedItem = await removeIngredientFromInventoryService({ user_id, ingredient_id, quantity_units: quantity });
    res.status(200).json({ message: 'Ingrediente retirado del refri', item: updatedItem });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const cookRecipe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user_id = req.user?.userId;
  const { recipe_id } = req.body;

  if (!user_id) { res.status(401).json({ error: 'No autorizado.' }); return; }
  if (!recipe_id) { res.status(400).json({ error: "Falta el ID de la receta." }); return; }

  try {
    const result = await cookRecipeService(user_id, Number(recipe_id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};