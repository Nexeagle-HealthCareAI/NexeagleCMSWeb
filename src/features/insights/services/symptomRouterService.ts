import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';
import type { PagedResponse } from './insightsService';

// ── Training data editor ─────────────────────────────────────────────────────
export interface TrainingExampleItem {
    id: string;
    text: string;
    specialist: string;
    type: string | null;
    source: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

export interface UpsertTrainingExampleRequest {
    text: string;
    specialist: string;
    type?: string | null;
}

export const getTrainingExamples = async (
    page: number,
    limit: number,
    specialist?: string,
    search?: string
): Promise<PagedResponse<TrainingExampleItem>> => {
    const response = await api.get<PagedResponse<TrainingExampleItem>>(API_ENDPOINTS.SYMPTOM_ROUTER.TRAINING_EXAMPLES, {
        params: { page, limit, specialist: specialist || undefined, search: search || undefined }
    });
    return response.data;
};

export const addTrainingExample = async (payload: UpsertTrainingExampleRequest): Promise<TrainingExampleItem> => {
    const response = await api.post<TrainingExampleItem>(API_ENDPOINTS.SYMPTOM_ROUTER.TRAINING_EXAMPLES, payload);
    return response.data;
};

export const updateTrainingExample = async (id: string, payload: UpsertTrainingExampleRequest): Promise<TrainingExampleItem> => {
    const response = await api.put<TrainingExampleItem>(`${API_ENDPOINTS.SYMPTOM_ROUTER.TRAINING_EXAMPLES}/${id}`, payload);
    return response.data;
};

export const deleteTrainingExample = async (id: string): Promise<void> => {
    await api.delete(`${API_ENDPOINTS.SYMPTOM_ROUTER.TRAINING_EXAMPLES}/${id}`);
};

// The 32 specialist labels the router outputs — kept in sync manually with
// specialty_mapping.py / SymptomRouterConstants.cs (both repos don't share code).
export const SYMPTOM_ROUTER_SPECIALISTS = [
    'General Physician', 'Paediatrician', 'Cardiologist (Heart)', 'Dermatologist (Skin)',
    'Orthopaedic Surgeon (Bone)', 'Gynaecologist', 'Dentist', 'ENT Specialist',
    'Ophthalmologist (Eye)', 'Neurologist', 'Psychiatrist', 'Urologist', 'Gastroenterologist',
    'Endocrinologist (Hormones/Diabetes)', 'Pulmonologist (Chest/Lungs)', 'Nephrologist (Kidney)',
    'Oncologist (Cancer)', 'Rheumatologist', 'Physiotherapist / Rehab', 'General Surgeon',
    'Neurosurgeon', 'Plastic Surgeon', 'Vascular Surgeon', 'Cardiothoracic Surgeon',
    'Anaesthesiologist', 'Radiologist', 'Pathologist', 'Emergency Medicine Specialist',
    'Geriatrician', 'Sports Medicine Specialist', 'GI/Surgical Gastroenterologist', 'Veterinarian',
] as const;

// ── Feedback log ──────────────────────────────────────────────────────────────
export interface FeedbackLogItem {
    occurredAt: string;
    sessionId: string | null;
    query: string;
    predictedSpecialtyId: string | null;
    method: string | null;
    confidence: number | null;
    hasBooking: boolean;
    actualBookedSpecialtyId: string | null;
    wasCorrection: boolean;
}

export const getFeedbackLog = async (
    page: number,
    limit: number,
    from?: string,
    to?: string,
    correctionsOnly?: boolean
): Promise<PagedResponse<FeedbackLogItem>> => {
    const response = await api.get<PagedResponse<FeedbackLogItem>>(API_ENDPOINTS.SYMPTOM_ROUTER.FEEDBACK_LOG, {
        params: { page, limit, from: from || undefined, to: to || undefined, correctionsOnly: correctionsOnly || undefined }
    });
    return response.data;
};

// ── Model info / retrain ──────────────────────────────────────────────────────
export interface ValidationMetrics {
    top1Accuracy: number;
    topKAccuracy: number;
    confidentlyWrongRate: number;
}

export interface ModelInfo {
    modelVersion: string | null;
    lastRetrainedAt: string | null;
    trainingRowCount: number | null;
    validationRowCount: number | null;
    validationMetrics: ValidationMetrics | null;
}

export const getModelInfo = async (): Promise<ModelInfo> => {
    const response = await api.get<ModelInfo>(API_ENDPOINTS.SYMPTOM_ROUTER.MODEL_INFO);
    return response.data;
};

export const triggerRetrain = async (): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(API_ENDPOINTS.SYMPTOM_ROUTER.RETRAIN, {});
    return response.data;
};
