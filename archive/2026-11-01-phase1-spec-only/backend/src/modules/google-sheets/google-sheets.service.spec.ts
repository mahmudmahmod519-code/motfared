/**
 * Unit Tests - GoogleSheets Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GoogleSheetsService } from './google-sheets.service';

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleSheetsService],
    }).compile();

    service = module.get<GoogleSheetsService>(GoogleSheetsService);
  });

  describe('getAuthUrl', () => {
    it('should return Google OAuth authorization URL', async () => {
      const result = await service.getAuthUrl();

      expect(result.auth_url).toBeDefined();
      expect(result.auth_url).toContain('accounts.google.com');
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback', async () => {
      const result = await service.handleCallback({
        code: 'test-auth-code',
        state: 'test-state',
      });

      expect(result.success).toBeDefined();
    });
  });

  describe('syncLeads', () => {
    it('should sync leads from Google Sheet', async () => {
      const result = await service.syncLeads('test-lead-id');

      expect(result.job_id).toBeDefined();
      expect(result.status).toBe('queued');
    });

    it('should return sync status', async () => {
      const result = await service.getSyncStatus('test-lead-id', 'test-sync-id');

      expect(result.status).toBeDefined();
      expect(result.processed).toBeDefined();
      expect(result.total).toBeDefined();
    });
  });
});
