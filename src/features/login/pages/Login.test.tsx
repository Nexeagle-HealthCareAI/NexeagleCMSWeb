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
    });

    it('should render login form', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('admin@cms.com')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('admin')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should handle input changes', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        const emailInput = screen.getByPlaceholderText('admin@cms.com');
        const passwordInput = screen.getByPlaceholderText('admin');

        fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(emailInput).toHaveValue('test@test.com');
        expect(passwordInput).toHaveValue('password123');
    });

    it('should submit form with credentials', async () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        const emailInput = screen.getByPlaceholderText('admin@cms.com');
        const passwordInput = screen.getByPlaceholderText('admin');
        const submitButton = screen.getByRole('button', { name: /Sign In/i });

        fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
        });
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

        expect(screen.getByRole('button')).toBeDisabled();
    });
});
