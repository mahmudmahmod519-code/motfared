/**
 * Unit Tests - PlanPrices Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanPricesService } from './plan-prices.service';
import { PlanPrice } from './entities/plan-price.entity';
import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { NotFoundException } from '@nestjs/common';

describe('PlanPricesService', () => {
  let service: PlanPricesService;
  let repo: Repository<PlanPrice>;

  const mockPrice: PlanPrice = {
    id: 'test-price-id',
    plan_id: 'test-plan-id',
    amount: 99.00,
    currency: 'EGP',
    interval: 'month',
    stripe_price_id: 'price_123',
    paymob_plan_id: null,
    is_active: true,
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
        PlanPricesService,
        { provide: getRepositoryToken(PlanPrice), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PlanPricesService>(PlanPricesService);
    repo = module.get(getRepositoryToken(PlanPrice));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreatePlanPriceDto = {
      plan_id: 'test-plan-id',
      amount: 199.00,
      currency: 'EGP',
      interval: 'year',
      is_active: true,
    };

    it('should create a price variant successfully', async () => {
      mockRepo.create.mockReturnValue(mockPrice);
      mockRepo.save.mockResolvedValue(mockPrice);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockPrice);
      expect(result).toEqual(mockPrice);
    });
  });

  describe('findAll', () => {
    it('should return all price variants', async () => {
      mockRepo.find.mockResolvedValue([mockPrice]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockPrice]);
    });
  });

  describe('findOne', () => {
    it('should return a price by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockPrice);

      const result = await service.findOne('test-price-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-price-id' } });
      expect(result).toEqual(mockPrice);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdatePlanPriceDto = { amount: 149.00 };

    it('should update a price variant successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockPrice);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockPrice, amount: 149.00 });

      const result = await service.update('test-price-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-price-id', dto);
      expect(result.amount).toBe(149.00);
    });
  });

  describe('remove', () => {
    it('should delete a price variant successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockPrice);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-price-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-price-id');
      expect(result.message).toBe('Price deleted');
    });
  });
});
