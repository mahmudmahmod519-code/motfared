/**
 * Unit Tests - Webhook Events Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { NotFoundException } from '@nestjs/common';

describe('WebhookEventsService', () => {
  let service: WebhookEventsService;
  let repo: Repository<WebhookEvent>;

  const mockEvent: WebhookEvent = {
    id: 'test-event-id',
    provider: 'stripe',
    provider_event_id: 'evt_1234567890',
    event_type: 'invoice.payment_succeeded',
    payload: { id: 'evt_1234567890', type: 'invoice.payment_succeeded' },
    processed: true,
    processed_at: new Date(),
    processing_error: null,
    received_at: new Date(),
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
        WebhookEventsService,
        { provide: getRepositoryToken(WebhookEvent), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<WebhookEventsService>(WebhookEventsService);
    repo = module.get(getRepositoryToken(WebhookEvent));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook event successfully', async () => {
      mockRepo.create.mockReturnValue(mockEvent);
      mockRepo.save.mockResolvedValue(mockEvent);

      const result = await service.create({
        provider: 'stripe',
        provider_event_id: 'evt_1234567890',
        event_type: 'invoice.payment_succeeded',
        payload: { id: 'evt_1234567890' },
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual(mockEvent);
    });

    it('should be idempotent - not create duplicate events', async () => {
      mockRepo.findOne.mockResolvedValue(mockEvent); // Event already exists

      const result = await service.create({
        provider: 'stripe',
        provider_event_id: 'evt_1234567890',
        event_type: 'invoice.payment_succeeded',
        payload: { id: 'evt_1234567890' },
      });

      // Should return existing event, not create new one
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockEvent);
    });
  });

  describe('findAll', () => {
    it('should return all webhook events', async () => {
      mockRepo.find.mockResolvedValue([mockEvent]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockEvent]);
    });
  });

  describe('findOne', () => {
    it('should return a webhook event by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockEvent);

      const result = await service.findOne('test-event-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-event-id' } });
      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markProcessed', () => {
    it('should mark an event as processed', async () => {
      mockRepo.findOne.mockResolvedValue(mockEvent);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.markProcessed('test-event-id');

      expect(mockRepo.update).toHaveBeenCalledWith('test-event-id', {
        processed: true,
        processed_at: expect.any(Date),
      });
    });
  });

  describe('markFailed', () => {
    it('should mark an event as failed with error', async () => {
      mockRepo.findOne.mockResolvedValue(mockEvent);
      mockRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.markFailed('test-event-id', 'Signature verification failed');

      expect(mockRepo.update).toHaveBeenCalledWith('test-event-id', {
        processed: true,
        processing_error: 'Signature verification failed',
        processed_at: expect.any(Date),
      });
    });
  });
});
