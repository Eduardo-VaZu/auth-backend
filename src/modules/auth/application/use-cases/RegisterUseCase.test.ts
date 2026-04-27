import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RegisterUseCase } from './RegisterUseCase.js';
import { ConflictError } from '../../../../shared/errors/HttpErrors.js';
import { User } from '../../domain/entities/User.js';
import type { IAuthUnitOfWork } from '../../domain/services/IAuthUnitOfWork.js';

describe('RegisterUseCase', () => {
  let registerUseCase: RegisterUseCase;
  let mockAuthUnitOfWork: jest.Mocked<IAuthUnitOfWork>;
  let mockUserRepository: any;
  let mockUserCredentialRepository: any;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    mockUserCredentialRepository = {
      create: jest.fn(),
    };

    mockAuthUnitOfWork = {
      run: jest.fn((callback: any) => 
        callback({ 
          userRepository: mockUserRepository, 
          userCredentialRepository: mockUserCredentialRepository 
        })
      ),
    } as any;

    registerUseCase = new RegisterUseCase(mockAuthUnitOfWork);
  });

  const createMockUser = (props: Partial<any>) => new User({
    id: 'uuid',
    email: 'test@example.com',
    roles: ['user'],
    status: 'active',
    authzVersion: 1,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...props
  });

  it('should register a new user successfully', async () => {
    const input = { email: 'new@example.com', password: 'Password123!' };
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(createMockUser({ email: input.email }));

    const result = await registerUseCase.execute(input);

    expect(result.user.email).toBe(input.email);
    expect(mockUserRepository.create).toHaveBeenCalled();
    expect(mockUserCredentialRepository.create).toHaveBeenCalled();
  });

  it('should throw ConflictError if email is already in use', async () => {
    const input = { email: 'existing@example.com', password: 'Password123!' };
    mockUserRepository.findByEmail.mockResolvedValue(createMockUser({ email: input.email }));

    await expect(registerUseCase.execute(input)).rejects.toThrow(ConflictError);
  });
});
