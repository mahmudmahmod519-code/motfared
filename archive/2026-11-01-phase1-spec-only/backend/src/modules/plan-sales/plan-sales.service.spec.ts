/**
 * Unit Tests - PlanSales Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanSalesService } from './plan-sales.service';
import { PlanSales } from './entities/plan-sales.entity';
import { CreatePlanSalesDto } from './dto/create-plan-sales.dto';
import { UpdatePlanSalesDto } from './dto/update-plan-sales.dto';
import { NotFoundException } from '@nestjs/common';

describe('PlanSalesService', () => {
  let service: PlanSalesService;
  let repo: Repository<PlanSales>;

  const mockTask: PlanSales = {
    id: 'test-task-id',
    company_id: 'test-company-id',
    name: 'Weekly Call Task',
    created_by: 'crm-manager-id',
    status: 'draft',
    info: 'Task info',
    description: 'Weekly calling task',
    limit_calls: 100,
    limit_bonus_calls: 20,
    period_start: new Date(),
    period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lead_items: [],
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
        PlanSalesService,
        { provide: getRepositoryToken(PlanSales), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PlanSalesService>(PlanSalesService);
    repo = module.get(getRepositoryToken(PlanSales));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreatePlanSalesDto = {
      company_id: 'test-company-id',
      name: 'New Task',
      created_by: 'crm-manager-id',
      limit_calls: 50,
      limit_bonus_calls: 10,
    };

    it('should create a task successfully', async () => {
      mockRepo.create.mockReturnValue(mockTask);
      mockRepo.save.mockResolvedValue(mockTask);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockTask);
      expect(result).toEqual(mockTask);
    });
  });

  describe('activate', () => {
    it('should activate a task', async () => {
      mockRepo.findOne.mockResolvedValue(mockTask);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockTask, status: 'active' });

      const result = await service.activate('test-task-id');

      expect(mockRepo.update).toHaveBeenCalledWith('test-task-id', { status: 'active' });
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException if task not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.activate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('pause', () => {
    it('should pause a task', async () => {
      mockRepo.findOne.mockResolvedValue(mockTask);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockTask, status: 'paused' });

      const result = await service.pause('test-task-id');

      expect(result.status).toBe('paused');
    });
  });

  describe('complete', () => {
    it('should complete a task', async () => {
      mockRepo.findOne.mockResolvedValue(mockTask);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockTask, status: 'completed' });

      const result = await service.complete('test-task-id');

      expect(result.status).toBe('completed');
    });
  });
});
