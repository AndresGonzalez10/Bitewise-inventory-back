import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const generateListFromRecipeService = async (userId: string, recipeId: number) => {
  const recipe = await prisma.recipes.findUnique({
    where: { id: recipeId },
    include: { recipe_ingredients: { include: { ingredients: true } } }
  });

  if (!recipe) throw new Error('La receta solicitada no existe en nuestro catálogo.');

  const userInventory = await prisma.inventory.findMany({ 
    where: { user_id: userId } 
  });

  const missingItems = recipe.recipe_ingredients.map((ri: any) => {
    const userInv = userInventory.find((inv: any) => inv.ingredient_id === ri.ingredient_id);
    const has = userInv ? Number(userInv.current_quantity) : 0;
    const needed = Number(ri.required_quantity);
    
    if (needed <= 0) return null;

    return {
      ingredient_id: ri.ingredient_id,
      missing: needed - has,
      price: Number(ri.ingredients.unit_price)
    };
  }).filter((item: any) => item !== null && item.missing > 0);

  if (missingItems.length === 0) throw new Error('¡Ya tienes todo para esta receta!');

  return await prisma.shopping_lists.create({
    data: {
      user_id: userId,
      name: `Faltantes para: ${recipe.title}`,
      shopping_list_items: {
        create: missingItems.map((item: any) => ({
          ingredient_id: item.ingredient_id,
          target_quantity: Math.max(0, item.missing),
          total_price: Math.max(0, item.missing * item.price)
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
    const list = await tx.shopping_lists.findFirst({
      where: { 
        id: listId,
        user_id: userId 
      },
      include: { shopping_list_items: true }
    });

    if (!list) {
      throw new Error('La lista no existe o no tienes permiso para acceder a ella.');
    }

    if (list.shopping_list_items.length === 0) {
      throw new Error('Esta lista ya ha sido procesada o está vacía.');
    }

    for (const item of list.shopping_list_items) {
      if (!item.ingredient_id) continue;

      await tx.inventory.upsert({
        where: {
          user_id_ingredient_id: {
            user_id: userId,
            ingredient_id: item.ingredient_id
          }
        },
        update: {
          current_quantity: { increment: item.target_quantity }
        },
        create: {
          user_id: userId,
          ingredient_id: item.ingredient_id,
          current_quantity: item.target_quantity
        }
      });
    }
    await tx.shopping_list_items.deleteMany({
      where: { list_id: listId }
    });

    return { 
      message: 'Compra exitosa. El inventario ha sido actualizado y la lista ha sido procesada.',
      items_moved: list.shopping_list_items.length
    };
  });
};