import { Request, Response, NextFunction } from 'express';
import { getMeHandler } from '../src/controllers/user.controller';

describe('User Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    req = {};
    statusMock = jest.fn();
    jsonMock = jest.fn();
    statusMock.mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      locals: {}
    };
    next = jest.fn() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMeHandler', () => {
    it('should return user data successfully', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User'
      };
      res.locals!.user = mockUser;

      // Act
      await getMeHandler(req as Request, res as Response, next);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: mockUser
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle errors and call next', async () => {
      // Arrange
      const error = new Error('Test error');
      statusMock.mockImplementation(() => {
        throw error;
      });

      // Act
      await getMeHandler(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle missing user in res.locals', async () => {
      // Arrange
      res.locals!.user = undefined;

      // Act
      await getMeHandler(req as Request, res as Response, next);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: undefined
        }
      });
    });
  });
});