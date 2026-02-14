import { describe, it, expect, vi } from 'vitest';
import { getApplicationHealth } from './healthService';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

describe('healthService', () => {
    it('should fetch health status successfully', async () => {
        const mockHealth = { status: 'Healthy', version: '1.0.0' };
        (api.get as any).mockResolvedValue({ data: mockHealth });

        const result = await getApplicationHealth();
        expect(api.get).toHaveBeenCalledWith('../health');
        expect(result).toEqual(mockHealth);
    });
});

