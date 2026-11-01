/**
 * Unit Tests - CompanyMemberships Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyMembershipsService } from './company-memberships.service';
import { CompanyMembership } from './entities/company-membership.entity';
import { CreateCompanyMembershipDto } from './dto/create-company-membership.dto';
import { UpdateCompanyMembershipDto } from './dto/update-company-membership.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CompanyMembershipsService', () => {
  let service: CompanyMembershipsService;
  let repo: Repository<CompanyMembership>;

  const mockMembership: CompanyMembership = {
    id: 'test-membership-id',
    company_id: 'test-company-id',
    user_id: 'test-user-id',
    role: 'admin',
    status: 'active',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyMembershipsService,
        { provide: getRepositoryToken(CompanyMembership), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CompanyMembershipsService>(CompanyMembershipsService);
    repo = module.get(getRepositoryToken(CompanyMembership));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateCompanyMembershipDto = {
      company_id: 'test-company-id',
      user_id: 'test-user-id',
      role: 'admin',
    };

    it('should create a membership successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null); // No existing membership
      mockRepo.create.mockReturnValue(mockMembership);
      mockRepo.save.mockResolvedValue(mockMembership);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockMembership);
      expect(result).toEqual(mockMembership);
    });

    it('should throw ConflictException if membership already exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all memberships', async () => {
      mockRepo.find.mockResolvedValue([mockMembership]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockMembership]);
    });
  });

  describe('findOne', () => {
    it('should return a membership by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);

      const result = await service.findOne('test-membership-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-membership-id' } });
      expect(result).toEqual(mockMembership);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateCompanyMembershipDto = { role: 'sales' };

    it('should update a membership successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockMembership, role: 'sales' });

      const result = await service.update('test-membership-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-membership-id', dto);
      expect(result.role).toBe('sales');
    });
  });

  describe('remove', () => {
    it('should delete a membership successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-membership-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-membership-id');
      expect(result.message).toBe('Membership deleted');
    });
  });
});
