import { ProductModel } from '../models/product.model';

async function upsertProduct(input: {
  name: string;
  price: number;
  ingredients?: string[];
}) {
  return ProductModel.findOneAndUpdate(
    { name: input.name },
    {
      $set: {
        name: input.name,
        price: input.price,
        ingredients: input.ingredients ?? [],
        coverImage: null,
        gallery: [],
      },
    },
    { new: true, upsert: true },
  );
}

export async function populateProducts() {
  const burger = await upsertProduct({
    name: 'Smash Burger',
    price: 8.5,
    ingredients: ['manzo 150g', 'cheddar', 'lattuga', 'pomodoro', 'salsa speciale'],
  });

  const pulledPork = await upsertProduct({
    name: 'Pulled Pork Sandwich',
    price: 9.0,
    ingredients: ['maiale disossato', 'bbq sauce', 'coleslaw', 'panino brioche'],
  });

  const fries = await upsertProduct({
    name: 'Patate Speziate',
    price: 4.0,
    ingredients: ['patate', 'rosmarino', 'paprika', 'sale marino'],
  });

  const drink = await upsertProduct({
    name: 'Birra Artigianale',
    price: 5.0,
    ingredients: ['luppolo', 'malto', 'acqua', 'lievito'],
  });

  const ribs = await upsertProduct({
    name: 'Costine BBQ',
    price: 12.0,
    ingredients: ['costine di maiale', 'bbq sauce', 'spezie affumicate'],
  });

  const sausage = await upsertProduct({
    name: 'Salsiccia Griglia',
    price: 6.0,
    ingredients: ['salsiccia di suino', 'cipolla caramellata', 'senape'],
  });

  const crepe = await upsertProduct({
    name: 'Crêpe Nutella',
    price: 5.5,
    ingredients: ['farina', 'uova', 'latte', 'nutella', 'zucchero a velo'],
  });

  const gelato = await upsertProduct({
    name: 'Gelato Artigianale',
    price: 4.0,
    ingredients: ['latte', 'panna', 'zucchero', 'varie aromi'],
  });

  const water = await upsertProduct({
    name: 'Acqua Naturale',
    price: 1.5,
  });

  if (!burger || !pulledPork || !fries || !drink || !ribs || !sausage || !crepe || !gelato || !water) {
    throw new Error('Failed to seed products');
  }

  return {
    burger,
    pulledPork,
    fries,
    drink,
    ribs,
    sausage,
    crepe,
    gelato,
    water,
  };
}

export type SeedProductsResult = Awaited<ReturnType<typeof populateProducts>>;
