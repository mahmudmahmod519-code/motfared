/**
 * Unit Tests - Leads Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotFoundException } from '@nestjs/common';

describe('LeadsService', () => {
  let service: LeadsService;
  let repo: Repository<Lead>;

  const mockLead: Lead = {
    id: 'test-lead-id',
    name: 'Facebook Ads Campaign',
    source_type: 'facebook_ads',
    company_id: 'test-company-id',
    google_sheet_id: 'sheet-123',
    google_sheet_tab: 'Sheet1',
    source_reference_url: 'https://facebook.com/ads',
    source_config: null,
    is_active: true,
    notes: 'Test lead source',
    lead_contacts: [],
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
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    repo = module.get(getRepositoryToken(Lead));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateLeadDto = {
      name: 'New Lead Source',
      source_type: 'google_form',
      company_id: 'test-company-id',
      google_sheet_id: 'sheet-456',
    };

    it('should create a lead successfully', async () => {
      mockRepo.create.mockReturnValue(mockLead);
      mockRepo.save.mockResolvedValue(mockLead);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockLead);
      expect(result).toEqual(mockLead);
    });
  });

  describe('findAll', () => {
    it('should return all leads', async () => {
      mockRepo.find.mockResolvedValue([mockLead]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockLead]);
    });
  });

  describe('findOne', () => {
    it('should return a lead by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockLead);

      const result = await service.findOne('test-lead-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-lead-id' } });
      expect(result).toEqual(mockLead);
    });

    it('should throw NotFoundException if lead not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLeadDto = { name: 'Updated Lead' };

    it('should update a lead successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockLead);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockLead, name: 'Updated Lead' });

      const result = await service.update('test-lead-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-lead-id', dto);
      expect(result.name).toBe('Updated Lead');
    });
  });

  describe('remove', () => {
    it('should delete a lead successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockLead);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-lead-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-lead-id');
      expect(result.message).toBe('Lead deleted');
    });
  });
});
