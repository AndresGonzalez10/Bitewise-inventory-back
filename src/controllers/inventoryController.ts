import { Request, Response } from 'express';
import { getUserInventoryService, addIngredientToInventoryService,cookRecipeService } from '../services/inventoryService';

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  const { user_id } = req.params;

  if (!user_id) {
    res.status(400).json({ error: 'Falta el ID del usuario.' });
    return;
  }

  try {
    const inventory = await getUserInventoryService(user_id as string);1
    res.json({
      message: 'Refri obtenido exitosamente',
      items: inventory
    });
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const addToInventory = async (req: Request, res: Response): Promise<void> => {
  const { user_id, ingredient_id, quantity } = req.body;

  if (!user_id || !ingredient_id || !quantity) {
    res.status(400).json({ error: 'Faltan datos obligatorios (user_id, ingredient_id, quantity).' });
    return;
  }

  try {
    const updatedItem = await addIngredientToInventoryService({ user_id, ingredient_id, quantity });
    res.status(200).json({
      message: 'Ingrediente guardado en el refri',
      item: updatedItem
    });
  } catch (error) {
    console.error('Error al guardar en inventario:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

export const cookRecipe = async (req: Request, res: Response): Promise<void> => {
  const { user_id, recipe_id } = req.body;

  if (!user_id || !recipe_id) {
    res.status(400).json({ error: "Faltan datos obligatorios (user_id, recipe_id)." });
    return;
  }

  try {
    const result = await cookRecipeService(user_id as string, Number(recipe_id));
    res.json(result);
  } catch (error: any) {
    console.error("Error al cocinar:", error.message);
    res.status(400).json({ error: error.message });
  }
};