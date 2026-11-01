/**
 * Unit Tests - Auth Service
 * Tests: register, login, validateUser, changePassword, generateTokens
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: Repository<User>;
  let jwtService: JwtService;

  const mockUser: User = {
    id: 'test-user-id-123',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '$argon2id$v=19$m=65536,t=3,p=4$test$test',
    phone: '+1234567890',
    address: 'Test Address',
    social_links: null,
    company_id: 'test-company-id',
    platform_role: 'owner',
    status: UserStatus.ACTIVE,
    whatsapp_phone: null,
    memberships: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUsersRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    findOneOrFail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-access-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const defaults: Record<string, string> = {
        JWT_SECRET: 'test-secret',
      };
      return defaults[key] || undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepo = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      mockUsersRepo.create.mockReturnValue(mockUser);
      mockUsersRepo.save.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(mockUsersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(mockUsersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(mockUsersRepo.save).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalled();
      expect(result.access_token).toBe('test-access-token');
      expect(result.user.password_hash).toBeUndefined();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(mockUsersRepo.create).not.toHaveBeenCalled();
    });

    it('should hash password before saving', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      mockUsersRepo.create.mockReturnValue(mockUser);
      mockUsersRepo.save.mockResolvedValue(mockUser);

      jest.spyOn(argon2, 'hash').mockResolvedValue('hashed-password' as any);

      await service.register(registerDto);

      expect(mockUsersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: 'hashed-password' }),
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(true as any);

      const result = await service.login(loginDto);

      expect(mockUsersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(mockJwtService.sign).toHaveBeenCalled();
      expect(result.access_token).toBe('test-access-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive/suspended users', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.SUSPENDED });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(false as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user by id', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test-user-id-123');

      expect(mockUsersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id-123' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(true as any);
      jest.spyOn(argon2, 'hash').mockResolvedValue('new-hashed-password' as any);
      mockUsersRepo.save.mockResolvedValue(mockUser);
      mockUsersRepo.findOneOrFail.mockResolvedValue(mockUser);

      const result = await service.changePassword('test-user-id-123', 'oldpass', 'newpass');

      expect(mockUsersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id-123' } });
      expect(mockUsersRepo.save).toHaveBeenCalled();
      // old sessions are revoked and the caller gets a fresh token
      expect(mockUsersRepo.increment).toHaveBeenCalledWith({ id: 'test-user-id-123' }, 'token_version', 1);
      expect(result.message).toBe('Password changed successfully');
      expect(result.access_token).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('non-existent', 'oldpass', 'newpass'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(false as any);

      await expect(
        service.changePassword('test-user-id-123', 'wrongpass', 'newpass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
