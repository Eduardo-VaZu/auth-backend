import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { Container } from 'inversify';
import { createApp } from '../../src/app.js';
import { TYPES } from '../../src/container/types.js';

describe('Health API Integration', () => {
  it('should return 200 OK for health check', async () => {
    const testContainer = new Container();
    
    // Mocks mínimos necesarios para el arranque de App
    const mockLogger = { info: jest.fn(), error: jest.fn(), child: jest.fn(() => mockLogger) } as any;
    const mockRedis = { sendCommand: jest.fn().mockResolvedValue('OK') } as any;
    
    // Mocks para Auth (necesarios porque createApp inicializa todos los routers)
    const mockAuth = {} as any;
    const mockToken = {} as any;
    const mockSession = {} as any;
    const mockRepo = {} as any;
    const mockUseCase = {} as any;

    testContainer.bind(TYPES.Logger).toConstantValue(mockLogger);
    testContainer.bind(TYPES.RedisClient).toConstantValue(mockRedis);
    
    // Bindings de Health
    const mockHealthController = {
      getStatus: jest.fn((req: any, res: any) => {
        res.status(200).json({ status: 'ok' });
      }),
    };
    testContainer.bind(TYPES.HealthController).toConstantValue(mockHealthController);

    // Bindings de Auth (solo para que no falle la resolución de tipos en routers)
    testContainer.bind(TYPES.AuthController).toConstantValue(mockAuth);
    testContainer.bind(TYPES.ITokenService).toConstantValue(mockToken);
    testContainer.bind(TYPES.ISessionStore).toConstantValue(mockSession);
    testContainer.bind(TYPES.IUserSessionRepository).toConstantValue(mockRepo);
    testContainer.bind(TYPES.RegisterUseCase).toConstantValue(mockUseCase);
    testContainer.bind(TYPES.LoginUseCase).toConstantValue(mockUseCase);
    testContainer.bind(TYPES.RefreshTokenUseCase).toConstantValue(mockUseCase);
    testContainer.bind(TYPES.LogoutUseCase).toConstantValue(mockUseCase);
    testContainer.bind(TYPES.LogoutAllUseCase).toConstantValue(mockUseCase);
    testContainer.bind(TYPES.ChangePasswordUseCase).toConstantValue(mockUseCase);

    const app = createApp(testContainer);
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
