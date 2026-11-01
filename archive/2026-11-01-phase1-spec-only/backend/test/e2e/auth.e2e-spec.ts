/**
 * Integration Tests - Auth Controller
 * Tests: register, login, logout, me, change-password
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company } from '../../companies/entities/company.entity';
import * as argon2 from 'argon2';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test users
    await usersRepo.delete({ email: 'test@example.com' });
  });

  describe('POST /auth/register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201);

      // Duplicate
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('already registered');
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test' }) // missing email and password
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    const registerDto = {
      name: 'Test User',
      email: 'login@example.com',
      password: 'password123',
    };

    beforeEach(async () => {
      // Register user first
      const hash = await argon2.hash('password123');
      await usersRepo.save({
        name: 'Test User',
        email: 'login@example.com',
        password_hash: hash,
        status: UserStatus.ACTIVE,
      } as any);
    });

    afterEach(async () => {
      await usersRepo.delete({ email: 'login@example.com' });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.email).toBe('login@example.com');
    });

    it('should reject wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return user profile with valid token', async () => {
      const hash = await argon2.hash('password123');
      const user = await usersRepo.save({
        name: 'Me Test',
        email: 'me@example.com',
        password_hash: hash,
        status: UserStatus.ACTIVE,
        platform_role: 'platform_admin',
      } as any);

      const token = jwtService.sign({
        sub: user.id,
        email: user.email,
        company_id: user.company_id,
        platform_role: user.platform_role,
      });

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${token}`])
        .expect(200);

      expect(response.body.email).toBe('me@example.com');

      await usersRepo.delete({ id: user.id });
    });
  });
});
