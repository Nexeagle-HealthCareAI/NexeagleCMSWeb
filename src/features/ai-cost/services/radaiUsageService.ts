import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

// Mirrors RadAiUsageResult from 1RadAPI (GET /assist/usage). Costs are USD at
// the rate configured server-side; token counts are measured/real.
export interface RadAiUsage {
    windowDays: number;
    totalRequests: number;
    cacheHits: number;
    cacheHitRatePct: number;
    billedInputTokens: number;
    billedOutputTokens: number;
    promptCacheReadTokens: number;
    responseCacheSavedInputTokens: number;
    responseCacheSavedOutputTokens: number;
    baselineCostUsd: number;
    actualCostUsd: number;
    savedCostUsd: number;
    savedPct: number;
    responseCacheSavedUsd: number;
    promptCacheSavedUsd: number;
    inputRatePerMTok: number;
    outputRatePerMTok: number;
    note: string;
}

export const getRadAiUsage = async (days = 30): Promise<RadAiUsage> => {
    const res = await api.get<RadAiUsage>(API_ENDPOINTS.ASSIST.USAGE, { params: { days } });
    return res.data;
};
