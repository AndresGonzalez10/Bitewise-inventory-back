import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUserInventoryService = async (userId: string) => {
  return await prisma.inventory.findMany({
    where: { user_id: userId },
    include: {
      ingredients: true 
    },
    orderBy: { updated_at: 'desc' }
  });
};

export const addIngredientToInventoryService = async (data: any) => {
  const { user_id, ingredient_id, quantity } = data;

  if (Number(quantity) <= 0) {
    throw new Error('La cantidad a añadir debe ser mayor a cero.');
  }

  const ingredientExists = await prisma.ingredients.findUnique({
    where: { id: Number(ingredient_id) }
  });

  if (!ingredientExists) {
    throw new Error('El ingrediente que intentas añadir no existe en el catálogo.');
  }

  return await prisma.inventory.upsert({
    where: {
      user_id_ingredient_id: {
        user_id: user_id,
        ingredient_id: Number(ingredient_id)
      }
    },
    update: {
      current_quantity: { increment: Number(quantity) }
    },
    create: {
      user_id: user_id,
      ingredient_id: Number(ingredient_id),
      current_quantity: Number(quantity)
    }
  });
};