import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

// Upload/transform calls run a CSV through pandas parsing and possibly a Groq call on the
// backend -- both can run well past the shared api.ts instance's default 15s timeout.
const LONG_REQUEST_TIMEOUT_MS = 120_000;

export interface ColumnMappingEntry {
    targetField: string;
    sourceHeader: string | null;
    confidence: number;
    source: 'deterministic' | 'groq' | 'manual';
}

export interface MigrationNarrative {
    outlook: string;
    insights: string[];
    groqUsed: boolean;
}

export interface MigrationSummary {
    totalRows: number;
    newPatients: number;
    reusedWithinBatch: number;
    matchedExistingDbPatients: number;
    flaggedRows: number;
    excludedRows: number;
    narrative: MigrationNarrative | null;
}

export interface BatchListItem {
    batchId: string;
    hospitalId: string;
    dataType: string;
    sourceFileName: string;
    sourceRowCount: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface BatchDetail extends BatchListItem {
    columnMapping: ColumnMappingEntry[];
    summary: MigrationSummary | null;
    errorMessage: string | null;
    rawHeaders: string[];
    sampleRawRows: Record<string, string | null>[];
    warnings: string[];
}

export interface MigrationRow {
    rowId: string;
    sourceRowNumber: number;
    raw: Record<string, string | null>;
    transformed: Record<string, string | null> | null;
    resolvedPatientId: string | null;
    isNewPatient: boolean;
    flags: string[];
    rowStatus: 'Pending' | 'Ready' | 'Flagged' | 'Excluded';
}

export interface DoctorMapEntry {
    mapId: string | null;
    sourceDoctorName: string;
    sourceDepartment: string | null;
    mappedDoctorId: string | null;
    mappedDoctorName: string | null;
}

export interface PagedResult<T> {
    data: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
    };
}

export const uploadBatch = async (hospitalId: string, dataType: string, file: File): Promise<BatchDetail> => {
    const form = new FormData();
    form.append('hospitalId', hospitalId);
    form.append('dataType', dataType);
    form.append('file', file);

    const response = await api.post<BatchDetail>(API_ENDPOINTS.DATA_MIGRATION.BATCHES, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: LONG_REQUEST_TIMEOUT_MS,
    });
    return response.data;
};

export const getBatches = async (hospitalId?: string, page = 1, limit = 20): Promise<PagedResult<BatchListItem>> => {
    const response = await api.get<PagedResult<BatchListItem>>(API_ENDPOINTS.DATA_MIGRATION.BATCHES, {
        params: { hospitalId: hospitalId || undefined, page, limit },
    });
    return response.data;
};

export const getBatch = async (batchId: string): Promise<BatchDetail> => {
    const response = await api.get<BatchDetail>(`${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}`);
    return response.data;
};

export const updateColumnMapping = async (batchId: string, columnMapping: ColumnMappingEntry[]): Promise<void> => {
    await api.put(`${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}/column-mapping`, { columnMapping });
};

export const transformBatch = async (batchId: string): Promise<BatchDetail> => {
    const response = await api.post<BatchDetail>(
        `${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}/transform`,
        {},
        { timeout: LONG_REQUEST_TIMEOUT_MS }
    );
    return response.data;
};

export const getRows = async (
    batchId: string, page = 1, limit = 50, status?: string
): Promise<PagedResult<MigrationRow>> => {
    const response = await api.get<PagedResult<MigrationRow>>(`${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}/rows`, {
        params: { page, limit, status: status || undefined },
    });
    return response.data;
};

export const getDoctorMap = async (batchId: string): Promise<DoctorMapEntry[]> => {
    const response = await api.get<DoctorMapEntry[]>(`${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}/doctor-map`);
    return response.data;
};

export const updateDoctorMap = async (batchId: string, entries: DoctorMapEntry[]): Promise<void> => {
    await api.put(`${API_ENDPOINTS.DATA_MIGRATION.BATCHES}/${batchId}/doctor-map`, { entries });
};
