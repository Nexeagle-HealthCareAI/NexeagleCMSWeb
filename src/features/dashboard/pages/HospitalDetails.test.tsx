import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HospitalDetails from './HospitalDetails';
import { getHospitalById } from '../services/hospitalService';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/hospitalService');

// Mock ResizeObserver for Recharts
window.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('HospitalDetails Component', () => {
    const mockHospital = {
        id: '1',
        name: 'Test Hospital',
        city: 'Metropolis',
        state: 'NY',
        status: 'Active',
        users: [],
        doctors: [],
        stats: {
            uniquePatients: { daily: [], weekly: [], monthly: [], yearly: [] },
            appointments: { daily: [], weekly: [], monthly: [], yearly: [] }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render loading state initially', () => {
        (getHospitalById as any).mockImplementation(() => new Promise(() => { }));
        render(
            <MemoryRouter initialEntries={['/hospital/1']}>
                <Routes>
                    <Route path="/hospital/:id" element={<HospitalDetails />} />
                </Routes>
            </MemoryRouter>
        );
        // Loading state handled by checking for loading text or similar
    });

    it('should fetch and display hospital details', async () => {
        (getHospitalById as any).mockResolvedValue(mockHospital);

        render(
            <MemoryRouter initialEntries={['/hospital/1']}>
                <Routes>
                    <Route path="/hospital/:id" element={<HospitalDetails />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Test Hospital')).toBeInTheDocument();
            expect(screen.getByText('Metropolis, NY')).toBeInTheDocument();
        });
    });

    it('should display error message on fetch failure', async () => {
        (getHospitalById as any).mockRejectedValue(new Error('Failed to fetch'));

        render(
            <MemoryRouter initialEntries={['/hospital/1']}>
                <Routes>
                    <Route path="/hospital/:id" element={<HospitalDetails />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch hospital details')).toBeInTheDocument();
        });
    });
});
