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

export const addIngredientToInventoryService = async (data: { user_id: string; ingredient_id: number; quantity: number }) => {
  const { user_id, ingredient_id, quantity } = data;

  return await prisma.inventory.upsert({
    where: {
      user_id_ingredient_id: {
        user_id,
        ingredient_id
      }
    },
    update: {
      current_quantity: { increment: quantity } 
    },
    create: {
      user_id,
      ingredient_id,
      current_quantity: quantity 
    }
  });
};