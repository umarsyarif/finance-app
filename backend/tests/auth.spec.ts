import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  registerUserHandler,
  loginUserHandler,
  refreshAccessTokenHandler,
  logoutUserHandler
} from '../src/controllers/auth.controller';
import * as userService from '../src/services/user.service';
import * as jwtUtils from '../src/utils/jwt';
import Email from '../src/utils/email';

// Mock the modules
jest.mock('../src/services/user.service');
jest.mock('../src/utils/email');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../src/utils/jwt');
jest.mock('../src/utils/connectRedis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn()
  }
}));

describe('Auth Controller Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let cookieMock: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      cookies: {},
      get: jest.fn() as any
    };
    statusMock = jest.fn();
    jsonMock = jest.fn();
    cookieMock = jest.fn();
    statusMock.mockReturnValue({ json: jsonMock, cookie: cookieMock });
    res = {
      status: statusMock,
      cookie: cookieMock,
      locals: {}
    };
    next = jest.fn() as any;
    
    // Reset Redis client mocks
    const redisClient = require('../src/utils/connectRedis').default;
    redisClient.get.mockReset();
    redisClient.set.mockReset();
    redisClient.del.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUserHandler', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        verified: false
      };
      
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        passwordConfirm: 'password123'
      };
      
      (userService.findUniqueUser as jest.Mock).mockResolvedValue(null);
      (userService.createUser as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(Email.prototype, 'sendVerificationCode').mockResolvedValue(undefined);
      (bcryptjs.hash as jest.Mock).mockResolvedValue('hashedPassword');
      
      // Act
      await registerUserHandler(req as Request, res as Response, next);
      
      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success'
      }));
    });

    it('should return error for existing email', async () => {
      // Arrange
      const existingUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Existing User'
      };
      
      req.body = {
        email: 'test@example.com'
      };
      
      (userService.findUniqueUser as jest.Mock).mockResolvedValue(existingUser);
      
      // Act
      await registerUserHandler(req as Request, res as Response, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should return validation error for invalid input', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        password: '123'
      };

      req.body = invalidData;
      
      await registerUserHandler(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('loginUserHandler', () => {
    it('should login user successfully', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        verified: true
      };

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (userService.findUniqueUser as jest.Mock).mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      
      // Mock Redis client for signTokens
      const redisClient = require('../src/utils/connectRedis').default;
      redisClient.set.mockResolvedValue('OK');
      
      // Mock JWT signing
      (jwtUtils.signJwt as jest.Mock).mockReturnValue('mock-token');
      
      // Mock signTokens function
      (userService.signTokens as jest.Mock).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token'
      });

      // Act
      await loginUserHandler(req as Request, res as Response, next);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        access_token: 'mock-access-token'
      }));
    });

    it('should return error for invalid credentials', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      (userService.findUniqueUser as jest.Mock).mockResolvedValue(null);

      // Act
      await loginUserHandler(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should return error for unverified user', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        verified: false
      };

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (userService.findUniqueUser as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await loginUserHandler(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('refreshAccessTokenHandler', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com'
      };

      req.cookies = { refresh_token: 'valid_refresh_token' };
      
      // Mock JWT utilities
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ sub: '123' });
      (jwtUtils.signJwt as jest.Mock).mockReturnValue('new_access_token');
      
      // Mock Redis client
      const redisClient = require('../src/utils/connectRedis').default;
      redisClient.get.mockResolvedValue(JSON.stringify({ id: '123' }));
      
      (userService.findUniqueUser as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await refreshAccessTokenHandler(req as Request, res as Response, next);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        access_token: 'new_access_token'
      }));
    });

    it('should return error for invalid refresh token', async () => {
      // Arrange
      req.cookies = { refresh_token: 'invalid_token' };
      
      // Mock JWT verification to return null for invalid token
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue(null);

      // Act
      await refreshAccessTokenHandler(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'Could not refresh access token'
      }));
    });
  });

  describe('logoutUserHandler', () => {
    it('should logout user successfully', async () => {
      // Arrange
      res.locals = { user: { id: 'user123' } };
      
      // Mock Redis client
      const redisClient = require('../src/utils/connectRedis').default;
      redisClient.del.mockResolvedValue(1);
      
      // Act
      await logoutUserHandler(req as Request, res as Response, next);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith('user123');
      expect(cookieMock).toHaveBeenCalledWith('access_token', '', expect.any(Object));
      expect(cookieMock).toHaveBeenCalledWith('refresh_token', '', expect.any(Object));
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success'
      }));
    });
  });
});