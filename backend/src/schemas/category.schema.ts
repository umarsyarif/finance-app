import { object, string, TypeOf, z } from 'zod';

enum CategoryTypeEnum {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export const createCategorySchema = object({
  body: object({
    name: string({
      required_error: 'Category name is required',
    }).min(1, 'Category name cannot be empty'),
    type: z.nativeEnum(CategoryTypeEnum, {
      required_error: 'Category type is required',
    }),
    color: string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').default('#10B981'),
  }),
});

export const updateCategorySchema = object({
  params: object({
    categoryId: string(),
  }),
  body: object({
    name: string().min(1, 'Category name cannot be empty').optional(),
    type: z.nativeEnum(CategoryTypeEnum).optional(),
    color: string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  }),
});

export const getCategorySchema = object({
  params: object({
    categoryId: string(),
  }),
});

export const deleteCategorySchema = object({
  params: object({
    categoryId: string(),
  }),
});

export const getCategoriesSchema = object({
  query: object({
    type: z.nativeEnum(CategoryTypeEnum).optional(),
    page: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().positive().optional()
    ),
    limit: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().positive().optional()
    ),
  }),
});

export type CreateCategoryInput = TypeOf<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = TypeOf<typeof updateCategorySchema>;
export type GetCategoryInput = TypeOf<typeof getCategorySchema>['params'];
export type DeleteCategoryInput = TypeOf<typeof deleteCategorySchema>['params'];
export type GetCategoriesInput = TypeOf<typeof getCategoriesSchema>['query'];