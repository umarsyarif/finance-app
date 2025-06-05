import { Request, Response, NextFunction } from 'express';
import {
  createCategoryHandler,
  getCategoriesHandler,
  getCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler
} from '../src/controllers/category.controller';
import * as categoryService from '../src/services/category.service';
import * as jwt from '../src/utils/jwt';
import * as userService from '../src/services/user.service';

// Mock the modules
jest.mock('../src/services/category.service');
jest.mock('../src/utils/jwt');
jest.mock('../src/services/user.service');

describe('Category Controller Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    statusMock = jest.fn();
    jsonMock = jest.fn();
    statusMock.mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      locals: { user: { id: 'user123' } }
    };
    next = jest.fn() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCategoryHandler', () => {
    it('should create a new category successfully', async () => {
      const categoryData = {
        name: 'Food & Dining',
        description: 'Expenses for food and dining'
      };

      const mockCategory = {
        id: 'category123',
        name: 'Food & Dining',
        description: 'Expenses for food and dining',
        userId: 'user123'
      };

      req.body = categoryData;
      (categoryService.createCategory as jest.Mock).mockResolvedValue(mockCategory);

      await createCategoryHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          category: mockCategory
        }
      });
    });

    it('should handle category already exists error', async () => {
      const categoryData = {
        name: 'Existing Category',
        type: 'expense'
      };

      const existingCategory = {
        id: 'existing123',
        userId: 'user123',
        name: 'Existing Category',
        type: 'expense'
      };

      req.body = categoryData;
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(existingCategory);

      await createCategoryHandler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle validation error for invalid input', async () => {
      const invalidData = {
        name: '',
        type: 'invalid_type'
      };

      req.body = invalidData;

      await createCategoryHandler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCategoriesHandler', () => {
    it('should get categories successfully', async () => {
      const mockCategories = [
        {
          id: 'category1',
          name: 'Food',
          type: 'expense',
          userId: 'user123'
        },
        {
          id: 'category2',
          name: 'Salary',
          type: 'income',
          userId: 'user123'
        }
      ];

      (categoryService.findCategories as jest.Mock).mockResolvedValue(mockCategories);
      (categoryService.countCategories as jest.Mock).mockResolvedValue(mockCategories.length);

      await getCategoriesHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        results: mockCategories.length,
        data: {
          categories: mockCategories,
          pagination: {
            page: 1,
            limit: 10,
            total: mockCategories.length,
            totalPages: 1
          }
        }
      });
    });

    it('should handle empty categories list', async () => {
      (categoryService.findCategories as jest.Mock).mockResolvedValue([]);
      (categoryService.countCategories as jest.Mock).mockResolvedValue(0);

      await getCategoriesHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        results: 0,
        data: {
          categories: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0
          }
        }
      });
    });
  });

  describe('getCategoryHandler', () => {
    it('should get category successfully', async () => {
      const mockCategory = {
        id: 'category123',
        name: 'Food & Dining',
        type: 'expense',
        userId: 'user123'
      };

      req.params = { categoryId: 'category123' };
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(mockCategory);

      await getCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          category: mockCategory
        }
      });
    });

    it('should handle category not found', async () => {
      req.params = { categoryId: 'nonexistent' };
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(null);

      await getCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateCategoryHandler', () => {
    it('should update category successfully', async () => {
      const updateData = {
        name: 'Updated Food & Dining',
        description: 'Updated description'
      };

      const existingCategory = {
        id: 'category123',
        name: 'Food & Dining',
        userId: 'user123'
      };

      const updatedCategory = {
        ...existingCategory,
        ...updateData
      };

      req.params = { categoryId: 'category123' };
      req.body = updateData;
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(existingCategory);
      (categoryService.updateCategory as jest.Mock).mockResolvedValue(updatedCategory);

      await updateCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          category: updatedCategory
        }
      });
    });

    it('should handle category not found during update', async () => {
      req.params = { categoryId: 'nonexistent' };
      req.body = { name: 'Updated Name' };
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(null);

      await updateCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteCategoryHandler', () => {
    it('should delete category successfully', async () => {
      const existingCategory = {
        id: 'category123',
        name: 'Food & Dining',
        userId: 'user123'
      };

      req.params = { categoryId: 'category123' };
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(existingCategory);
      (categoryService.deleteCategory as jest.Mock).mockResolvedValue(existingCategory);

      await deleteCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(204);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: null
      });
    });

    it('should handle category not found during delete', async () => {
      req.params = { categoryId: 'nonexistent' };
      (categoryService.findUniqueCategory as jest.Mock).mockResolvedValue(null);

      await deleteCategoryHandler(req as Request<{categoryId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});