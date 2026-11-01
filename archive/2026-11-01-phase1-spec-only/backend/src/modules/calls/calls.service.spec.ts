/**
 * Unit Tests - Calls Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallsService } from './calls.service';
import { Call } from './entities/call.entity';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { NotFoundException } from '@nestjs/common';

describe('CallsService', () => {
  let service: CallsService;
  let repo: Repository<Call>;

  const mockCall: Call = {
    id: 'test-call-id',
    company_id: 'test-company-id',
    lead_contact_id: 'test-contact-id',
    assignment_id: 'test-assignment-id',
    call_center_user_id: 'test-user-id',
    outcome: 'answered',
    customer_decision: 'interested',
    duration_seconds: 120,
    notes: 'Interested in product',
    called_at: new Date(),
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
        CallsService,
        { provide: getRepositoryToken(Call), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
    repo = module.get(getRepositoryToken(Call));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateCallDto = {
      company_id: 'test-company-id',
      lead_contact_id: 'test-contact-id',
      call_center_user_id: 'test-user-id',
      outcome: 'answered',
      customer_decision: 'interested',
      duration_seconds: 120,
      notes: 'Test call',
    };

    it('should create a call successfully', async () => {
      mockRepo.create.mockReturnValue(mockCall);
      mockRepo.save.mockResolvedValue(mockCall);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockCall);
      expect(result).toEqual(mockCall);
    });
  });

  describe('findAll', () => {
    it('should return all calls', async () => {
      mockRepo.find.mockResolvedValue([mockCall]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockCall]);
    });
  });

  describe('findOne', () => {
    it('should return a call by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockCall);

      const result = await service.findOne('test-call-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-call-id' } });
      expect(result).toEqual(mockCall);
    });

    it('should throw NotFoundException if call not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateCallDto = { outcome: 'no_answer' };

    it('should update a call successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockCall);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockCall, outcome: 'no_answer' });

      const result = await service.update('test-call-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-call-id', dto);
      expect(result.outcome).toBe('no_answer');
    });
  });

  describe('remove', () => {
    it('should delete a call successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockCall);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-call-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-call-id');
      expect(result.message).toBe('Call deleted');
    });
  });
});
