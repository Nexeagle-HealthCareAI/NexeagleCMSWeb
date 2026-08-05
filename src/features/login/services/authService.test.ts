import { describe, it, expect, vi } from 'vitest';
import { login } from './authService';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

describe('authService', () => {
    it('should login successfully and return user data', async () => {
        const mockResponse = {
            data: {
                token: 'fake-token',
                expiresInSeconds: 900,
                user: {
                    id: '1',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'admin'
                },
                permissions: ['insights.view'],
                mustChangePassword: false,
            }
        };

        (api.post as any).mockResolvedValue(mockResponse);

        const result = await login('test@example.com', 'password');

        expect(api.post).toHaveBeenCalledWith('/auth/login', {
            identifier: 'test@example.com',
            password: 'password'
        });
        expect(result).toEqual(mockResponse.data);
    });

    it('should also accept a phone number as the identifier', async () => {
        const mockResponse = {
            data: {
                token: 'fake-token', expiresInSeconds: 900,
                user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'admin' },
                permissions: [], mustChangePassword: false,
            }
        };
        (api.post as any).mockResolvedValue(mockResponse);

        await login('+919876543210', 'password');

        expect(api.post).toHaveBeenCalledWith('/auth/login', {
            identifier: '+919876543210',
            password: 'password'
        });
    });

    it('should throw an error on login failure', async () => {
        const mockError = new Error('Login failed');
        (api.post as any).mockRejectedValue(mockError);

        await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow('Network error or server unreachable');
    });

    it('should surface the server-provided message on a rejected axios error', async () => {
        const axiosError: any = new Error('Request failed');
        axiosError.isAxiosError = true;
        axiosError.response = { data: { message: 'Invalid credentials' } };
        (api.post as any).mockRejectedValue(axiosError);

        await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });
});
