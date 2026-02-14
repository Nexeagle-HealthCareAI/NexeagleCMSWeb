import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { getDashboardStats } from '../services/hospitalService';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../services/hospitalService');

// Mock ResizeObserver for Recharts
window.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Dashboard Component', () => {
    const mockStats = {
        totalHospitals: { value: 10, change: 1, changeType: 'increase', period: 'this week' },
        totalDoctors: { value: 50, change: 0, changeType: 'nochange', period: 'this week' },
        totalPatients: { value: 100, change: -5, changeType: 'decrease', period: 'this week' },
        totalUsers: { value: 5, change: 1, changeType: 'increase', period: 'this week' },
        charts: {
            hospitals: { daily: [] },
            doctors: { daily: [] },
            patients: { daily: [] },
            users: { daily: [] }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (getDashboardStats as any).mockResolvedValue(mockStats);
    });

    it('should render dashboard header', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );
        expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    });

    it('should fetch and display stats', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Total Hospital OnBoarded')).toBeInTheDocument();
            // Checking values might need more specific queries if formating is applied (e.g. 10.toLocaleString())
            // But '10' should be present
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });
});
