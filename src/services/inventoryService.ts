import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUserInventoryService = async (userId: string) => {
  return await prisma.inventory.findMany({
    where: { user_id: userId },
    include: { ingredients: true },
    orderBy: { updated_at: 'desc' }
  });
};

export const addIngredientToInventoryService = async (data: any) => {
  const { user_id, ingredient_id, quantity_units } = data;
  if (Number(quantity_units) <= 0) throw new Error('Cantidad no válida.');

  const ingredient = await prisma.ingredients.findUnique({ where: { id: Number(ingredient_id) } });
  if (!ingredient) throw new Error('Ingrediente no existe.');

  // NUEVA LÓGICA: Se guarda directamente la cantidad sin conversiones de peso
  const amountToAdd = Number(quantity_units);

  return await prisma.inventory.upsert({
    where: { user_id_ingredient_id: { user_id, ingredient_id: Number(ingredient_id) } },
    update: { current_quantity: { increment: amountToAdd } },
    create: { user_id, ingredient_id: Number(ingredient_id), current_quantity: amountToAdd }
  });
};

export const removeIngredientFromInventoryService = async (data: any) => {
  const { user_id, ingredient_id, quantity_units } = data;
  if (Number(quantity_units) <= 0) throw new Error('Cantidad no válida.');

  const ingredient = await prisma.ingredients.findUnique({ where: { id: Number(ingredient_id) } });
  if (!ingredient) throw new Error('Ingrediente no existe.');

  // NUEVA LÓGICA: Se resta directamente la cantidad
  const amountToRemove = Number(quantity_units);

  const invItem = await prisma.inventory.findUnique({
    where: { user_id_ingredient_id: { user_id, ingredient_id: Number(ingredient_id) } }
  });

  if (!invItem || Number(invItem.current_quantity) < amountToRemove) {
    throw new Error('No tienes suficiente cantidad en el refri para retirar.');
  }

  return await prisma.inventory.update({
    where: { id: invItem.id },
    data: { current_quantity: { decrement: amountToRemove } }
  });
};

export const cookRecipeService = async (userId: string, recipeId: number) => {
  return await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipes.findUnique({
      where: { id: recipeId },
      include: { recipe_ingredients: { include: { ingredients: true } } }
    });

    if (!recipe) throw new Error("La receta seleccionada no existe.");

    for (const ri of recipe.recipe_ingredients) {
      const invItem = await tx.inventory.findUnique({
        where: { user_id_ingredient_id: { user_id: userId, ingredient_id: ri.ingredient_id } }
      });

      const required = Number(ri.required_quantity);
      const available = invItem ? Number(invItem.current_quantity) : 0;

      if (available < required) {
        throw new Error(`Insuficiente: Te faltan ${(required - available)} ${ri.ingredients.unit_default} de ${ri.ingredients.name}.`);
      }

      await tx.inventory.update({
        where: { id: invItem!.id },
        data: { current_quantity: { decrement: required } }
      });
    }

    return { message: `¡${recipe.title} cocinado con éxito!`, details: "Inventario actualizado." };
  });
};