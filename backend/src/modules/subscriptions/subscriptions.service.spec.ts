/**
 * Unit Tests - Subscriptions Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { NotFoundException } from '@nestjs/common';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let repo: Repository<Subscription>;

  const mockSubscription: Subscription = {
    id: 'test-sub-id',
    company_id: 'test-company-id',
    plan_price_id: 'test-price-id',
    status: 'active',
    starts_at: new Date(),
    current_period_start: new Date(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    trial_ends_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
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
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    repo = module.get(getRepositoryToken(Subscription));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateSubscriptionDto = {
      company_id: 'test-company-id',
      plan_price_id: 'test-price-id',
    };

    it('should create a subscription successfully', async () => {
      mockRepo.create.mockReturnValue(mockSubscription);
      mockRepo.save.mockResolvedValue(mockSubscription);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockSubscription);
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('cancel', () => {
    it('should cancel a subscription', async () => {
      mockRepo.findOne.mockResolvedValue(mockSubscription);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockSubscription, status: 'canceled', canceled_at: new Date() });

      const result = await service.cancel('test-sub-id');

      expect(mockRepo.update).toHaveBeenCalledWith('test-sub-id', {
        status: 'canceled',
        canceled_at: expect.any(Date),
      });
      expect(result.status).toBe('canceled');
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resume', () => {
    it('should resume a canceled subscription', async () => {
      const canceledSub = { ...mockSubscription, status: 'canceled', canceled_at: new Date() };
      mockRepo.findOne.mockResolvedValue(canceledSub);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...canceledSub, status: 'active', canceled_at: null });

      const result = await service.resume('test-sub-id');

      expect(result.status).toBe('active');
      expect(result.canceled_at).toBeNull();
    });
  });
});
