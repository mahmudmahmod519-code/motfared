/**
 * Unit Tests - LeadContacts Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadContactsService } from './lead-contacts.service';
import { LeadContact } from './entities/lead-contact.entity';
import { CreateLeadContactDto } from './dto/create-lead-contact.dto';
import { UpdateLeadContactDto } from './dto/update-lead-contact.dto';
import { NotFoundException } from '@nestjs/common';

describe('LeadContactsService', () => {
  let service: LeadContactsService;
  let repo: Repository<LeadContact>;

  const mockContact: LeadContact = {
    id: 'test-contact-id',
    company_id: 'test-company-id',
    lead_id: 'test-lead-id',
    external_row_id: 'row-1',
    source_reference: 'FB-AD-001',
    name: 'John Doe',
    phone: '+1234567890',
    telephone: '+1234567891',
    email: 'john@example.com',
    age: 30,
    status: 'new',
    lead: null,
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
        LeadContactsService,
        { provide: getRepositoryToken(LeadContact), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LeadContactsService>(LeadContactsService);
    repo = module.get(getRepositoryToken(LeadContact));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateLeadContactDto = {
      company_id: 'test-company-id',
      lead_id: 'test-lead-id',
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
    };

    it('should create a contact successfully', async () => {
      mockRepo.create.mockReturnValue(mockContact);
      mockRepo.save.mockResolvedValue(mockContact);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockContact);
      expect(result).toEqual(mockContact);
    });
  });

  describe('findAll', () => {
    it('should return all contacts', async () => {
      mockRepo.find.mockResolvedValue([mockContact]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockContact]);
    });
  });

  describe('findOne', () => {
    it('should return a contact by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockContact);

      const result = await service.findOne('test-contact-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-contact-id' } });
      expect(result).toEqual(mockContact);
    });

    it('should throw NotFoundException if contact not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLeadContactDto = { name: 'Jane Doe' };

    it('should update a contact successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockContact);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockContact, name: 'Jane Doe' });

      const result = await service.update('test-contact-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-contact-id', dto);
      expect(result.name).toBe('Jane Doe');
    });
  });

  describe('remove', () => {
    it('should delete a contact successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockContact);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-contact-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-contact-id');
      expect(result.message).toBe('Contact deleted');
    });
  });
});
