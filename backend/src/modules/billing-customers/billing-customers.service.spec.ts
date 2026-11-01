/**
 * Unit Tests - BillingCustomers Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCustomersService } from './billing-customers.service';
import { BillingCustomer } from './entities/billing-customer.entity';
import { CreateBillingCustomerDto } from './dto/create-billing-customer.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('BillingCustomersService', () => {
  let service: BillingCustomersService;
  let repo: Repository<BillingCustomer>;

  const mockCustomer: BillingCustomer = {
    id: 'test-billing-id',
    company_id: 'test-company-id',
    provider: 'stripe',
    provider_customer_id: 'cus_1234567890',
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
        BillingCustomersService,
        { provide: getRepositoryToken(BillingCustomer), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BillingCustomersService>(BillingCustomersService);
    repo = module.get(getRepositoryToken(BillingCustomer));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateBillingCustomerDto = {
      company_id: 'test-company-id',
      provider: 'stripe',
      provider_customer_id: 'cus_1234567890',
    };

    it('should create a billing customer successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockCustomer);
      mockRepo.save.mockResolvedValue(mockCustomer);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockCustomer);
      expect(result).toEqual(mockCustomer);
    });

    it('should throw ConflictException if provider+customer_id exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockCustomer);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all billing customers', async () => {
      mockRepo.find.mockResolvedValue([mockCustomer]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockCustomer]);
    });
  });

  describe('findOne', () => {
    it('should return a billing customer by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockCustomer);

      const result = await service.findOne('test-billing-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-billing-id' } });
      expect(result).toEqual(mockCustomer);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a billing customer successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockCustomer);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-billing-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-billing-id');
      expect(result.message).toBe('Billing customer deleted');
    });
  });
});
