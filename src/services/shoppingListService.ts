import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const generateListFromRecipeService = async (userId: string, recipeId: number) => {
  const recipe = await prisma.recipes.findUnique({ 
    where: { id: recipeId },
    include: { 
      recipe_ingredients: { 
        include: { ingredients: true } 
      } 
    }
  });

  if (!recipe) throw new Error('Receta no encontrada');

  const userInventory = await prisma.inventory.findMany({ 
    where: { user_id: userId } 
  });

  const missingItems = recipe.recipe_ingredients.map((ri: any) => { 
    const userInv = userInventory.find((inv: any) => inv.ingredient_id === ri.ingredient_id);
    const has = userInv ? Number(userInv.current_quantity) : 0;
    const MathRequired = Number(ri.required_quantity);
    
    return {
      ingredient_id: ri.ingredient_id,
      missing: MathRequired - has,
      price: Number(ri.ingredients.unit_price)
    };
  }).filter((item: any) => item.missing > 0);

  if (missingItems.length === 0) throw new Error('¡Ya tienes todo para esta receta!');

  return await prisma.shopping_lists.create({ 
    data: {
      user_id: userId,
      name: `Faltantes para: ${recipe.title}`,
      shopping_list_items: { 
        create: missingItems.map((item: any) => ({ 
          ingredient_id: item.ingredient_id,
          target_quantity: item.missing,
          total_price: item.missing * item.price
        }))
      }
    },
    include: { shopping_list_items: true }
  });
};

export const getUserListsService = async (userId: string) => {
  return await prisma.shopping_lists.findMany({ 
    where: { user_id: userId },
    include: { shopping_list_items: true },
    orderBy: { created_at: 'desc' }
  });
};
export const purchaseListService = async (listId: number, userId: string) => {
  return await prisma.$transaction(async (tx) => {
    const items = await tx.shopping_list_items.findMany({
      where: { list_id: listId }
    });

    if (items.length === 0) {
      throw new Error('La lista está vacía o no existe.');
    }

    for (const item of items) {
      await tx.inventory.upsert({
        where: {
          user_id_ingredient_id: {
            user_id: userId,
            ingredient_id: item.ingredient_id as number
          }
        },
        update: {
          current_quantity: { increment: item.target_quantity }
        },
        create: {
          user_id: userId,
          ingredient_id: item.ingredient_id as number,
          current_quantity: item.target_quantity
        }
      });
    }

    return { 
      message: '¡Compra procesada! Los ingredientes ya están en tu inventario.',
      items_processed: items.length 
    };
  });
};