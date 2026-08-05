import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import { useAuthStore } from '../../../store/useAuthStore';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../../../store/useAuthStore');
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Login Component', () => {
    const mockLogin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAuthStore as any).mockReturnValue({
            login: mockLogin,
            isLoading: false,
            error: null
        });
        // Login.tsx calls useAuthStore.getState().applyOtpSession(...) directly (not via the
        // hook return value) in the OTP flow -- give the mocked module a getState too.
        (useAuthStore as any).getState = vi.fn().mockReturnValue({ applyOtpSession: vi.fn() });
    });

    it('should render the password login form by default', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('email@nexeagle.com or +91…')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should handle input changes', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        const identifierInput = screen.getByPlaceholderText('email@nexeagle.com or +91…');
        const passwordInput = screen.getByPlaceholderText('••••••••');

        fireEvent.change(identifierInput, { target: { value: 'test@test.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(identifierInput).toHaveValue('test@test.com');
        expect(passwordInput).toHaveValue('password123');
    });

    it('should submit the password form with the identifier and password', async () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        const identifierInput = screen.getByPlaceholderText('email@nexeagle.com or +91…');
        const passwordInput = screen.getByPlaceholderText('••••••••');
        const submitButton = screen.getByRole('button', { name: /Sign In/i });

        fireEvent.change(identifierInput, { target: { value: 'test@test.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
        });
    });

    it('should navigate home after a successful login', async () => {
        mockLogin.mockResolvedValue(undefined);
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        fireEvent.change(screen.getByPlaceholderText('email@nexeagle.com or +91…'), { target: { value: 'test@test.com' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    });

    it('should display error message when login fails', () => {
        (useAuthStore as any).mockReturnValue({
            login: mockLogin,
            isLoading: false,
            error: 'Invalid credentials'
        });

        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );

        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    it('should show loading state', () => {
        (useAuthStore as any).mockReturnValue({
            login: mockLogin,
            isLoading: true,
            error: null
        });

        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );

        expect(screen.getByRole('button', { name: /Signing in/i })).toBeDisabled();
    });

    it('should switch to the OTP tab and show the "send OTP" step', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /^OTP$/i }));

        expect(screen.getByRole('button', { name: /Send OTP/i })).toBeInTheDocument();
        // Password field belongs to the password tab only -- it shouldn't be present here.
        expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
    });

    it('should switch to forgot-password mode from the password tab', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        fireEvent.click(screen.getByText(/Forgot password\?/i));

        expect(screen.getByText(/Reset password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Send Reset Code/i })).toBeInTheDocument();
    });
});
