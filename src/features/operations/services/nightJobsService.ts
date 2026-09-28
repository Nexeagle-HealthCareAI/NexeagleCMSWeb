import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface JobSettingItem {
    jobId: number;
    jobName: string;
    isActive: boolean;
    lastExecutionDateUTC: string | null;
    // Computed server-side in IST -- true only if the job actually did its work today, not just
    // that the nightly container reached that step.
    ranToday: boolean;
    canTestRun: boolean;
}

export interface UpdateJobActiveResult {
    success: boolean;
    message?: string | null;
}

export interface NightJobRunItem {
    runId: number;
    startedAtUtc: string;
    completedAtUtc: string | null;
    durationSeconds: number | null;
    status: string;
    machineName: string | null;
    environment: string | null;
    summary: string | null;
    error: string | null;
}

export interface RunJobNowResult {
    success: boolean;
    message?: string | null;
}

export const getNightJobs = async (): Promise<JobSettingItem[]> => {
    const response = await api.get<JobSettingItem[]>(API_ENDPOINTS.NIGHT_JOBS.LIST);
    return response.data;
};

export const setNightJobActive = async (jobName: string, isActive: boolean): Promise<UpdateJobActiveResult> => {
    const response = await api.put<UpdateJobActiveResult>(`${API_ENDPOINTS.NIGHT_JOBS.SET_ACTIVE}/${jobName}/active`, { isActive });
    return response.data;
};

export const getRecentNightJobRuns = async (take = 20): Promise<NightJobRunItem[]> => {
    const response = await api.get<NightJobRunItem[]>(`${API_ENDPOINTS.NIGHT_JOBS.RUNS}?take=${take}`);
    return response.data;
};

export const runNightJobNow = async (jobName: string): Promise<RunJobNowResult> => {
    const response = await api.post<RunJobNowResult>(`${API_ENDPOINTS.NIGHT_JOBS.RUN_NOW}/${jobName}/run-now`, {});
    return response.data;
};
