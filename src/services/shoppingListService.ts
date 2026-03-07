import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const generateListFromRecipeService = async (userId: string, recipeId: number) => {
  const recipe = await prisma.recipes.findUnique({
    where: { id: recipeId },
    include: { recipe_ingredients: { include: { ingredients: true } } }
  });

  if (!recipe) throw new Error('Receta no encontrada.');

  const userInventory = await prisma.inventory.findMany({ where: { user_id: userId } });

  const missingItems = recipe.recipe_ingredients.map((ri: any) => {
    const userInv = userInventory.find((inv: any) => inv.ingredient_id === ri.ingredient_id);
    const hasGrams = userInv ? Number(userInv.current_quantity) : 0;
    const neededGrams = Number(ri.required_quantity);
    const diffGrams = neededGrams - hasGrams;

    if (diffGrams <= 0) return null;

    const unitsToBuy = Math.ceil(diffGrams / Number(ri.ingredients.weight_per_unit));

    return { ingredient_id: ri.ingredient_id, units: unitsToBuy };
  }).filter((item: any) => item !== null);

  if (missingItems.length === 0) throw new Error('¡Ya tienes todos los ingredientes en tu refri!');

  return await prisma.shopping_lists.create({
    data: {
      user_id: userId,
      name: `Lista para: ${recipe.title}`,
      shopping_list_items: {
        create: missingItems.map((item: any) => ({
          ingredient_id: item.ingredient_id,
          target_quantity: item.units
        }))
      }
    },
    include: { shopping_list_items: true }
  });
};

export const getUserListsService = async (userId: string) => {
  return await prisma.shopping_lists.findMany({ 
    where: { user_id: userId },
    include: { shopping_list_items: { include: { ingredients: true } } },
    orderBy: { created_at: 'desc' }
  });
};

export const purchaseListService = async (listId: number, userId: string) => {
  return await prisma.$transaction(async (tx) => {
    const list = await tx.shopping_lists.findFirst({
      where: { id: listId, user_id: userId },
      include: { shopping_list_items: { include: { ingredients: true } } }
    });

    const user = await tx.users.findUnique({ where: { id: userId } });

    if (!list || !user) throw new Error('Información no encontrada.');
    if (list.shopping_list_items.length === 0) throw new Error('Esta lista ya está vacía.');

    let gastoInteligente = 0;

    for (const item of list.shopping_list_items) {
      if (!item.ingredient_id || !item.ingredients) continue;

      const gramsToAdd = Number(item.target_quantity) * Number(item.ingredients.weight_per_unit);
      gastoInteligente += Number(item.total_price);

      await tx.inventory.upsert({
        where: { user_id_ingredient_id: { user_id: userId, ingredient_id: item.ingredient_id } },
        update: { current_quantity: { increment: gramsToAdd } },
        create: { user_id: userId, ingredient_id: item.ingredient_id, current_quantity: gramsToAdd }
      });
    }
    await tx.purchase_history.create({
      data: {
        user_id: userId,
        total_cost: gastoInteligente
      }
    });

    await tx.shopping_list_items.deleteMany({ where: { list_id: listId } });
    await tx.shopping_lists.delete({ where: { id: listId } });
    const gastoHabitual = Number(user.weekly_budget);
    let dineroAhorrado = gastoHabitual - gastoInteligente;
    let porcentajeAhorro = gastoHabitual > 0 ? (dineroAhorrado / gastoHabitual) * 100 : 0;

    return { 
      message: 'Compra exitosa. El ticket ha sido guardado en tu historial.',
      reporte_hipotesis: {
        gasto_habitual_declarado: gastoHabitual.toFixed(2),
        gasto_con_bitewise: gastoInteligente.toFixed(2),
        dinero_ahorrado: dineroAhorrado.toFixed(2),
        porcentaje_de_ahorro: `${porcentajeAhorro.toFixed(1)}%`
      }
    };
  });
};

export const createManualListService = async (userId: string, name: string) => {
  return await prisma.shopping_lists.create({ data: { user_id: userId, name } });
};

export const modifyItemInListService = async (userId: string, listId: number, ingredientId: number, quantity: number) => {
  const list = await prisma.shopping_lists.findUnique({ where: { id: listId } });
  if (!list || list.user_id !== userId) throw new Error("No tienes permiso para modificar esta lista.");

  const existingItem = await prisma.shopping_list_items.findFirst({
    where: { list_id: listId, ingredient_id: ingredientId }
  });

  if (existingItem) {
    return await prisma.shopping_list_items.update({
      where: { id: existingItem.id },
      data: { target_quantity: quantity }
    });
  } else {
    return await prisma.shopping_list_items.create({
      data: { list_id: listId, ingredient_id: ingredientId, target_quantity: quantity }
    });
  }
};

export const removeItemFromListService = async (userId: string, listId: number, itemId: number) => {
  const list = await prisma.shopping_lists.findUnique({ where: { id: listId } });
  if (!list || list.user_id !== userId) throw new Error("No tienes permiso.");
  return await prisma.shopping_list_items.delete({ where: { id: itemId } });
};

export const deleteListService = async (userId: string, listId: number) => {
  const list = await prisma.shopping_lists.findUnique({ where: { id: listId } });
  if (!list || list.user_id !== userId) throw new Error("No tienes permiso.");
  return await prisma.shopping_lists.delete({ where: { id: listId } });
};