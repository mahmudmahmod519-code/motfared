/**
 * Unit Tests - Companies Service
 * Tests: create, findAll, findOne, update, remove
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company, CompanyStatus } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { NotFoundException } from '@nestjs/common';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repo: Repository<Company>;

  const mockCompany: Company = {
    id: 'test-company-id',
    name: 'Test Company',
    type_company: 'sales',
    description: 'Test description',
    client_label: 'Client',
    call_center_label: 'Call Center',
    crm_manager_label: 'CRM Manager',
    owner_user_id: 'owner-id',
    address: '123 Test St',
    phone_whatsapp: '+1234567890',
    phone_telephone: '+1234567891',
    status: CompanyStatus.ACTIVE,
    social_links: { facebook: 'https://facebook.com/test' },
    memberships: [],
    subscriptions: [],
    billing_customers: [],
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
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    repo = module.get(getRepositoryToken(Company));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCompanyDto = {
      name: 'New Company',
      type_company: 'sales',
      description: 'A new company',
    };

    it('should create a company successfully', async () => {
      mockRepo.create.mockReturnValue(mockCompany);
      mockRepo.save.mockResolvedValue(mockCompany);

      const result = await service.create(createDto);

      expect(mockRepo.create).toHaveBeenCalledWith(createDto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockCompany);
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findAll', () => {
    it('should return all companies', async () => {
      mockRepo.find.mockResolvedValue([mockCompany]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockCompany]);
      expect(result.length).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockCompany);

      const result = await service.findOne('test-company-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-company-id' } });
      expect(result).toEqual(mockCompany);
    });

    it('should throw NotFoundException if company not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCompanyDto = {
      name: 'Updated Company',
    };

    it('should update a company successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockCompany);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockCompany, name: 'Updated Company' });

      const result = await service.update('test-company-id', updateDto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-company-id' } });
      expect(mockRepo.update).toHaveBeenCalledWith('test-company-id', updateDto);
      expect(result.name).toBe('Updated Company');
    });

    it('should throw NotFoundException if company not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a company successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockCompany);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-company-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-company-id' } });
      expect(mockRepo.delete).toHaveBeenCalledWith('test-company-id');
      expect(result.message).toBe('Company deleted');
    });

    it('should throw NotFoundException if company not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
