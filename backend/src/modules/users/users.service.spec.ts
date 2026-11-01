/**
 * Unit Tests - Users Service
 * Tests: CRUD operations for users
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CompanyMembership } from '../company-memberships/entities/company-membership.entity';
import { RbacService } from '../rbac/rbac.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let repo: Repository<User>;

  const mockUser: User = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed-password',
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

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockMemberships = { create: jest.fn((v) => v), save: jest.fn() };
  const admin = { id: 'admin-id', platform_role: 'platform_admin' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(CompanyMembership), useValue: mockMemberships },
        { provide: RbacService, useValue: { assertCanAssign: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      company_id: 'test-company-id',
      role: 'owner',
    };

    it('should create a user successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockUser);
      mockRepo.save.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException if email exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('test-user-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id' } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated User',
    };

    it('should update a user successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockUser, name: 'Updated User' });

      const result = await service.update('test-user-id', updateDto, admin);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id' } });
      expect(mockRepo.update).toHaveBeenCalledWith('test-user-id', updateDto);
      expect(result.name).toBe('Updated User');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto, admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a user successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-user-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id' } });
      expect(mockRepo.delete).toHaveBeenCalledWith('test-user-id');
      expect(result.message).toBe('User deleted');
    });
  });
});
