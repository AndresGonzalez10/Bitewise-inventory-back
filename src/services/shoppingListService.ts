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
    const hasQuantity = userInv ? Number(userInv.current_quantity) : 0;
    const neededQuantity = Number(ri.required_quantity);
    const diffQuantity = neededQuantity - hasQuantity;

    if (diffQuantity <= 0) return null;

    const quantityToBuy = Math.ceil(diffQuantity);

    return { 
      ingredient_id: ri.ingredient_id, 
      target_quantity: quantityToBuy 
    };
  }).filter((item): item is { ingredient_id: number; target_quantity: number } => item !== null);

  if (missingItems.length === 0) throw new Error('¡Ya tienes todos los ingredientes en tu refri!');

  return await prisma.shopping_lists.create({
    data: {
      user_id: userId,
      name: `Lista para: ${recipe.title}`,
      status: 'pendiente',
      shopping_list_items: {
        create: missingItems
      }
    },
    include: { shopping_list_items: true }
  });
};

export const getUserListsService = async (userId: string) => {
  // Mostramos el historial completo
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

    if (!list) throw new Error('Información no encontrada.');
    if (list.status !== 'pendiente') throw new Error('Esta lista ya fue procesada.');
    if (list.shopping_list_items.length === 0) throw new Error('Esta lista ya está vacía.');

    let gastoInteligente = 0;

    for (const item of list.shopping_list_items) {
      if (!item.ingredient_id || !item.ingredients) continue;

      const quantityToAdd = Number(item.target_quantity);
      gastoInteligente += Number(item.total_price);

      await tx.inventory.upsert({
        where: { user_id_ingredient_id: { user_id: userId, ingredient_id: item.ingredient_id } },
        update: { current_quantity: { increment: quantityToAdd } },
        create: { user_id: userId, ingredient_id: item.ingredient_id, current_quantity: quantityToAdd }
      });
    }
    
    await tx.purchase_history.create({
      data: {
        user_id: userId,
        total_cost: gastoInteligente
      }
    });

    await tx.shopping_lists.update({
      where: { id: listId },
      data: { status: 'comprada' }
    });
    
    return { 
      message: 'Compra exitosa. El ticket ha sido guardado y tu refri está actualizado.',
      costo_total: gastoInteligente
    };
  });
};

export const createManualListService = async (userId: string, name: string) => {
  return await prisma.shopping_lists.create({ data: { user_id: userId, name, status: 'pendiente' } });
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
  
  return await prisma.shopping_lists.update({ 
    where: { id: listId },
    data: { status: 'cancelada' }
  });
};