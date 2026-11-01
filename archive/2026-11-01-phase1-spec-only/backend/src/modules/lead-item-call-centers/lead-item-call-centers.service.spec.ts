/**
 * Unit Tests - Lead Item Call Centers Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadItemCallCentersService } from './lead-item-call-centers.service';
import { LeadItemCallCenter } from './entities/lead-item-call-center.entity';
import { CreateLeadItemCallCenterDto } from './dto/create-lead-item-call-center.dto';
import { UpdateLeadItemCallCenterDto } from './dto/update-lead-item-call-center.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('LeadItemCallCentersService', () => {
  let service: LeadItemCallCentersService;
  let repo: Repository<LeadItemCallCenter>;

  const mockAssignment: LeadItemCallCenter = {
    id: 'test-assignment-id',
    lead_item_id: 'test-item-id',
    user_id: 'test-user-id',
    assignment_role: 'primary',
    priority_order: 1,
    status: 'active',
    target_calls: 10,
    bonus_calls_limit: 5,
    user: null,
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
        LeadItemCallCentersService,
        { provide: getRepositoryToken(LeadItemCallCenter), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LeadItemCallCentersService>(LeadItemCallCentersService);
    repo = module.get(getRepositoryToken(LeadItemCallCenter));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateLeadItemCallCenterDto = {
      lead_item_id: 'test-item-id',
      user_id: 'test-user-id',
      assignment_role: 'primary',
      priority_order: 1,
      target_calls: 10,
    };

    it('should create an assignment successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null); // No existing assignment
      mockRepo.create.mockReturnValue(mockAssignment);
      mockRepo.save.mockResolvedValue(mockAssignment);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockAssignment);
      expect(result).toEqual(mockAssignment);
    });

    it('should throw ConflictException if duplicate assignment', async () => {
      mockRepo.findOne.mockResolvedValue(mockAssignment);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all assignments', async () => {
      mockRepo.find.mockResolvedValue([mockAssignment]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockAssignment]);
    });
  });

  describe('findOne', () => {
    it('should return an assignment by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockAssignment);

      const result = await service.findOne('test-assignment-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-assignment-id' } });
      expect(result).toEqual(mockAssignment);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLeadItemCallCenterDto = { status: 'paused' };

    it('should update an assignment successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockAssignment);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockAssignment, status: 'paused' });

      const result = await service.update('test-assignment-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-assignment-id', dto);
      expect(result.status).toBe('paused');
    });
  });

  describe('remove', () => {
    it('should delete an assignment successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockAssignment);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-assignment-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-assignment-id');
      expect(result.message).toBe('Assignment deleted');
    });
  });
});
