import express from 'express';
import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoriesHandler,
  getCategoryHandler,
  updateCategoryHandler,
} from '../controllers/category.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategoriesSchema,
  getCategorySchema,
  updateCategorySchema,
} from '../schemas/category.schema';

const router = express.Router();

router.use(deserializeUser, requireUser);

// GET /api/categories
router.get('/', validate(getCategoriesSchema), getCategoriesHandler);

// POST /api/categories
router.post('/', validate(createCategorySchema), createCategoryHandler);

// GET /api/categories/:categoryId
router.get('/:categoryId', validate(getCategorySchema), getCategoryHandler);

// PATCH /api/categories/:categoryId
router.patch('/:categoryId', validate(updateCategorySchema), updateCategoryHandler);

// DELETE /api/categories/:categoryId
router.delete('/:categoryId', validate(deleteCategorySchema), deleteCategoryHandler);

export default router;