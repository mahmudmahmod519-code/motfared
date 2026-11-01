/**
 * Unit Tests - Payments Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: Repository<Payment>;

  const mockPayment: Payment = {
    id: 'test-payment-id',
    subscription_id: 'test-sub-id',
    provider: 'stripe',
    provider_payment_id: 'pi_1234567890',
    provider_invoice_id: 'in_1234567890',
    provider_customer_id: 'cus_1234567890',
    amount: 99.00,
    currency: 'EGP',
    status: 'succeeded',
    idempotency_key: 'idem-123',
    paid_at: new Date(),
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
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    repo = module.get(getRepositoryToken(Payment));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreatePaymentDto = {
      subscription_id: 'test-sub-id',
      provider: 'stripe',
      amount: 99.00,
      currency: 'EGP',
      idempotency_key: 'idem-123',
    };

    it('should create a payment successfully', async () => {
      mockRepo.findOne.mockResolvedValue(null); // no existing idempotency key
      mockRepo.create.mockReturnValue(mockPayment);
      mockRepo.save.mockResolvedValue(mockPayment);

      const result = await service.create(dto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { idempotency_key: 'idem-123' } });
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockPayment);
      expect(result).toEqual(mockPayment);
    });

    it('should throw ConflictException if idempotency key exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockPayment);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne('test-payment-id');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-payment-id' } });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
