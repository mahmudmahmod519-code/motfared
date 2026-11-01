/**
 * Unit Tests - LeadItems Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadItemsService } from './lead-items.service';
import { LeadItem } from './entities/lead-item.entity';
import { CreateLeadItemDto } from './dto/create-lead-item.dto';
import { UpdateLeadItemDto } from './dto/update-lead-item.dto';
import { NotFoundException } from '@nestjs/common';

describe('LeadItemsService', () => {
  let service: LeadItemsService;
  let repo: Repository<LeadItem>;

  const mockItem: LeadItem = {
    id: 'test-item-id',
    lead_id: 'test-lead-id',
    plan_sales_id: 'test-plan-id',
    status: 'active',
    lead: null,
    lead_item_call_centers: [],
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
        LeadItemsService,
        { provide: getRepositoryToken(LeadItem), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LeadItemsService>(LeadItemsService);
    repo = module.get(getRepositoryToken(LeadItem));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateLeadItemDto = {
      lead_id: 'test-lead-id',
      plan_sales_id: 'test-plan-id',
      status: 'active',
    };

    it('should create a lead item successfully', async () => {
      mockRepo.create.mockReturnValue(mockItem);
      mockRepo.save.mockResolvedValue(mockItem);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockItem);
      expect(result).toEqual(mockItem);
    });
  });

  describe('findAll', () => {
    it('should return all lead items', async () => {
      mockRepo.find.mockResolvedValue([mockItem]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockItem]);
    });
  });

  describe('findOne', () => {
    it('should return a lead item by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockItem);

      const result = await service.findOne('test-item-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-item-id' } });
      expect(result).toEqual(mockItem);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLeadItemDto = { status: 'completed' };

    it('should update a lead item successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockItem);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockItem, status: 'completed' });

      const result = await service.update('test-item-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-item-id', dto);
      expect(result.status).toBe('completed');
    });
  });

  describe('remove', () => {
    it('should delete a lead item successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockItem);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-item-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-item-id');
      expect(result.message).toBe('Lead item deleted');
    });
  });
});
