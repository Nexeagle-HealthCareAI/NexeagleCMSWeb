import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHospitals, getHospitalById, getDashboardStats } from './hospitalService';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

describe('hospitalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch hospitals successfully', async () => {
        const mockData = {
            data: {
                hospitals: [{ id: '1', name: 'Test Hospital' }],
                currentPage: 1,
                totalPages: 10,
                totalItems: 100
            }
        };
        (api.get as any).mockResolvedValue(mockData);

        const result = await getHospitals(1, 10);
        expect(api.get).toHaveBeenCalledWith('/hospitals?page=1&limit=10');
        expect(result).toEqual(mockData.data);
    });

    it('should fetch hospital by id successfully', async () => {
        const mockHospital = { id: '1', name: 'Test Hospital' };
        (api.get as any).mockResolvedValue({ data: mockHospital });

        const result = await getHospitalById('1');
        expect(api.get).toHaveBeenCalledWith('/hospitals/1');
        expect(result).toEqual(mockHospital);
    });

    it('should fetch dashboard stats successfully', async () => {
        const mockStats = { totalHospitals: { value: 10 } };
        (api.get as any).mockResolvedValue({ data: mockStats });

        const result = await getDashboardStats();
        expect(api.get).toHaveBeenCalledWith('/dashboard/stats');
        expect(result).toEqual(mockStats);
    });
});
