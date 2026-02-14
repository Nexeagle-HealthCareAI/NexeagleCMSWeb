import { describe, it, expect, vi } from 'vitest';
import { login } from './authService';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

describe('authService', () => {
    it('should login successfully and return user data', async () => {
        const mockResponse = {
            data: {
                token: 'fake-token',
                user: {
                    id: '1',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'admin'
                }
            }
        };

        (api.post as any).mockResolvedValue(mockResponse);

        const result = await login('test@example.com', 'password');

        expect(api.post).toHaveBeenCalledWith('/auth/login', {
            email: 'test@example.com',
            password: 'password'
        });
        expect(result).toEqual(mockResponse.data);
    });

    it('should throw an error on login failure', async () => {
        const mockError = new Error('Login failed');
        (api.post as any).mockRejectedValue(mockError);

        await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow('Login failed');
    });
});
