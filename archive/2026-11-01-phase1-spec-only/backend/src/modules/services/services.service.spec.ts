/**
 * Unit Tests - Services Module Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServicesService } from './services.service';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { NotFoundException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: Repository<Service>;

  const mockService: Service = {
    id: 'test-service-id',
    company_id: 'test-company-id',
    name: 'Consultation',
    description: 'Medical consultation',
    price: 150.00,
    currency: 'EGP',
    status: 'active',
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
        ServicesService,
        { provide: getRepositoryToken(Service), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    repo = module.get(getRepositoryToken(Service));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateServiceDto = {
      company_id: 'test-company-id',
      name: 'New Service',
      description: 'Service description',
      price: 200.00,
      currency: 'EGP',
      status: 'active',
    };

    it('should create a service successfully', async () => {
      mockRepo.create.mockReturnValue(mockService);
      mockRepo.save.mockResolvedValue(mockService);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockService);
      expect(result).toEqual(mockService);
    });
  });

  describe('findAll', () => {
    it('should return all services', async () => {
      mockRepo.find.mockResolvedValue([mockService]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockService]);
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockService);

      const result = await service.findOne('test-service-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-service-id' } });
      expect(result).toEqual(mockService);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateServiceDto = { price: 175.00 };

    it('should update a service successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockService);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      mockRepo.findOne.mockResolvedValue({ ...mockService, price: 175.00 });

      const result = await service.update('test-service-id', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('test-service-id', dto);
      expect(result.price).toBe(175.00);
    });
  });

  describe('remove', () => {
    it('should delete a service successfully', async () => {
      mockRepo.findOne.mockResolvedValue(mockService);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove('test-service-id');

      expect(mockRepo.delete).toHaveBeenCalledWith('test-service-id');
      expect(result.message).toBe('Service deleted');
    });
  });
});
