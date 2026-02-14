import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../../store/useAuthStore';
import * as authService from './authService';

vi.mock('./authService');

describe('useAuthStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useAuthStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
        });
        vi.clearAllMocks();
    });

    it('should have initial state', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should set loading state updates correctly during login', async () => {
        (authService.login as any).mockImplementation(() => new Promise(() => { })); // never resolves
        useAuthStore.getState().login('test@test.com', 'password');
        expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('should update state on successful login', async () => {
        const mockUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'admin' };
        const mockResponse = { user: mockUser, token: 'fake-token' };
        (authService.login as any).mockResolvedValue(mockResponse);

        await useAuthStore.getState().login('test@test.com', 'password');

        const state = useAuthStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.token).toBe('fake-token');
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should update state on failed login', async () => {
        const errorMessage = 'Invalid credentials';
        (authService.login as any).mockRejectedValue(new Error(errorMessage));

        await expect(useAuthStore.getState().login('test@test.com', 'password')).rejects.toThrow(errorMessage);

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(errorMessage);
    });

    it('should clear state on logout', () => {
        useAuthStore.setState({
            user: { id: '1', name: 'Test', email: 'test@test.com', role: 'admin' },
            token: 'fake-token',
            isAuthenticated: true
        });

        useAuthStore.getState().logout();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });
});
