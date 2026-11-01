/**
 * Unit Tests - SubscriptionProviderRefs Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionProviderRefsService } from './subscription-provider-refs.service';
import { SubscriptionProviderRef } from './entities/subscription-provider-ref.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('SubscriptionProviderRefsService', () => {
  let service: SubscriptionProviderRefsService;
  let repo: Repository<SubscriptionProviderRef>;

  const mockRef: SubscriptionProviderRef = {
    id: 'test-ref-id',
    subscription_id: 'test-sub-id',
    provider: 'stripe',
    provider_subscription_id: 'sub_1234567890',
    provider_price_id: 'price_123',
    provider_plan_id: 'plan_123',
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
        SubscriptionProviderRefsService,
        { provide: getRepositoryToken(SubscriptionProviderRef), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SubscriptionProviderRefsService>(SubscriptionProviderRefsService);
    repo = module.get(getRepositoryToken(SubscriptionProviderRef));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a provider ref successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockRef);
      mockRepo.save.mockResolvedValue(mockRef);

      const result = await service.create({
        subscription_id: 'test-sub-id',
        provider: 'stripe',
        provider_subscription_id: 'sub_1234567890',
        provider_price_id: 'price_123',
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(mockRef);
      expect(result).toEqual(mockRef);
    });

    it('should throw ConflictException if provider+subscription_id exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockRef);

      await expect(
        service.create({
          subscription_id: 'test-sub-id',
          provider: 'stripe',
          provider_subscription_id: 'sub_1234567890',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all provider refs', async () => {
      mockRepo.find.mockResolvedValue([mockRef]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockRef]);
    });
  });

  describe('findOne', () => {
    it('should return a ref by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockRef);

      const result = await service.findOne('test-ref-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-ref-id' } });
      expect(result).toEqual(mockRef);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a ref successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockRef);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-ref-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-ref-id');
      expect(result.message).toBe('Provider ref deleted');
    });
  });
});
