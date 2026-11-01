/**
 * Integration Tests - Companies Controller
 * Tests: CRUD operations for companies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('CompaniesController (Integration)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let companiesRepo: Repository<Company>;
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    companiesRepo = moduleFixture.get(getRepositoryToken(Company));
    jwtService = moduleFixture.get(JwtService);

    // Create platform admin user
    const admin = await usersRepo.save({
      name: 'Admin User',
      email: 'admin@test.com',
      password_hash: 'hashed',
      status: UserStatus.ACTIVE,
      platform_role: 'platform_admin',
    } as any);

    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      company_id: admin.company_id,
      platform_role: 'platform_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await companiesRepo.delete({});
  });

  describe('POST /api/companies', () => {
    const dto = {
      name: 'Test Company',
      type_company: 'sales',
      description: 'A test company',
    };

    it('should create a company as platform admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/companies')
        .set('Cookie', [`access_token=${adminToken}`])
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Test Company');
    });

    it('should reject non-admin users', async () => {
      const ceoToken = jwtService.sign({
        sub: 'owner-id',
        email: 'owner@test.com',
        company_id: 'company-id',
        platform_role: 'owner',
      });

      await request(app.getHttpServer())
        .post('/api/companies')
        .set('Cookie', [`access_token=${ceoToken}`])
        .send(dto)
        .expect(403);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/companies')
        .send(dto)
        .expect(401);
    });
  });

  describe('GET /api/companies', () => {
    it('should return list of companies', async () => {
      await companiesRepo.save({
        name: 'Company 1',
        type_company: 'sales',
        status: CompanyStatus.ACTIVE,
      } as any);

      const response = await request(app.getHttpServer())
        .get('/api/companies')
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/companies/:id', () => {
    it('should return a company by id', async () => {
      const company = await companiesRepo.save({
        name: 'Test Company',
        type_company: 'sales',
        status: CompanyStatus.ACTIVE,
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/companies/${company.id}`)
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200);

      expect(response.body.id).toBe(company.id);
      expect(response.body.name).toBe('Test Company');
    });

    it('should return 404 for non-existent company', async () => {
      await request(app.getHttpServer())
        .get('/api/companies/non-existent-id')
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(404);
    });
  });

  describe('PATCH /api/companies/:id', () => {
    it('should update a company', async () => {
      const company = await companiesRepo.save({
        name: 'Original Name',
        type_company: 'sales',
        status: CompanyStatus.ACTIVE,
      } as any);

      const response = await request(app.getHttpServer())
        .patch(`/api/companies/${company.id}`)
        .set('Cookie', [`access_token=${adminToken}`])
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/companies/:id', () => {
    it('should delete a company', async () => {
      const company = await companiesRepo.save({
        name: 'To Delete',
        type_company: 'sales',
        status: CompanyStatus.ACTIVE,
      } as any);

      await request(app.getHttpServer())
        .delete(`/api/companies/${company.id}`)
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200);

      const found = await companiesRepo.findOne({ where: { id: company.id } });
      expect(found).toBeNull();
    });
  });
});
