/**
 * Unit Tests - Plans Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlansService } from './plans.service';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { NotFoundException } from '@nestjs/common';

describe('PlansService', () => {
  let service: PlansService;
  let repo: Repository<Plan>;

  const mockPlan: Plan = {
    id: 'test-plan-id',
    name: 'Pro Plan',
    slug: 'pro',
    description: 'Professional plan',
    features: { max_users: 10, max_lead_sources: 5 },
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
        PlansService,
        { provide: getRepositoryToken(Plan), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    repo = module.get(getRepositoryToken(Plan));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreatePlanDto = {
      name: 'Enterprise Plan',
      slug: 'enterprise',
      description: 'Enterprise plan',
      features: { max_users: 100, max_lead_sources: 50 },
      is_active: true,
    };

    it('should create a plan successfully', async () => {
      mockRepo.create.mockReturnValue(mockPlan);
      mockRepo.save.mockResolvedValue(mockPlan);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockPlan);
      expect(result).toEqual(mockPlan);
    });
  });

  describe('findAll', () => {
    it('should return all plans', async () => {
      mockRepo.find.mockResolvedValue([mockPlan]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockPlan]);
    });
  });

  describe('findOne', () => {
    it('should return a plan by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockPlan);

      const result = await service.findOne('test-plan-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-plan-id' } });
      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdatePlanDto = { name: 'Updated Plan' };

    it('should update a plan successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockPlan);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockPlan, name: 'Updated Plan' });

      const result = await service.update('test-plan-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-plan-id', dto);
      expect(result.name).toBe('Updated Plan');
    });
  });

  describe('remove', () => {
    it('should delete a plan successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockPlan);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-plan-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-plan-id');
      expect(result.message).toBe('Plan deleted');
    });
  });
});
