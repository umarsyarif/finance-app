import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const createCategory = async (input: Prisma.CategoryCreateInput) => {
  return (await prisma.category.create({
    data: input,
  })) as any;
};

export const findCategory = async (
  where: Partial<Prisma.CategoryWhereInput>,
  select?: Prisma.CategorySelect,
  include?: Prisma.CategoryInclude
) => {
  if (select && include) {
    throw new Error('Cannot use both select and include');
  }

  const query: any = { where };
  if (select) {
    query.select = select;
  } else if (include) {
    query.include = include;
  }

  return (await prisma.category.findFirst(query)) as any;
};

export const findUniqueCategory = async (
  where: Prisma.CategoryWhereUniqueInput,
  select?: Prisma.CategorySelect,
  include?: Prisma.CategoryInclude
) => {
  if (select && include) {
    throw new Error('Cannot use both select and include');
  }

  const query: any = { where };
  if (select) {
    query.select = select;
  } else if (include) {
    query.include = include;
  }

  return (await prisma.category.findUnique(query)) as any;
};

export const findCategories = async (
  where: Partial<Prisma.CategoryWhereInput>,
  select?: Prisma.CategorySelect,
  include?: Prisma.CategoryInclude,
  skip?: number,
  take?: number
) => {
  if (select && include) {
    throw new Error('Cannot use both select and include');
  }

  const query: any = { where };
  if (select) {
    query.select = select;
  } else if (include) {
    query.include = include;
  }
  if (skip !== undefined) {
    query.skip = skip;
  }
  if (take !== undefined) {
    query.take = take;
  }

  return (await prisma.category.findMany(query)) as any;
};

export const updateCategory = async (
  where: Prisma.CategoryWhereUniqueInput,
  data: Prisma.CategoryUpdateInput,
  select?: Prisma.CategorySelect,
  include?: Prisma.CategoryInclude
) => {
  if (select && include) {
    throw new Error('Cannot use both select and include');
  }

  const query: any = { where, data };
  if (select) {
    query.select = select;
  } else if (include) {
    query.include = include;
  }

  return (await prisma.category.update(query)) as any;
};

export const deleteCategory = async (where: Prisma.CategoryWhereUniqueInput) => {
  return await prisma.category.delete({ where });
};

export const countCategories = async (where: Partial<Prisma.CategoryWhereInput>) => {
  return await prisma.category.count({ where });
};