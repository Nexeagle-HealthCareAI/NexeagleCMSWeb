import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface DoctorListItem {
    doctorId: string;
    fullName: string | null;
    hospitalId: string;
    hospitalName: string | null;
    departmentName: string | null;
    opdConsultFee: number | null;
    isPubliclyListed: boolean;
    isFeatured: boolean;
    isDelistedByAdmin: boolean;
    discountPercent: number | null;
    discountStartAt: string | null;
    discountEndAt: string | null;
}

export interface DoctorsResponse {
    data: DoctorListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export interface UpdateDoctorMarketingPayload {
    isFeatured: boolean;
    isDelistedByAdmin: boolean;
    discountPercent: number | null;
    discountStartAt: string | null;
    discountEndAt: string | null;
}

export const getDoctors = async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc'
): Promise<DoctorsResponse> => {
    const response = await api.get<DoctorsResponse>(API_ENDPOINTS.DOCTORS.GET_ALL, {
        params: { page, limit, search: search || undefined, sortBy: sortBy || undefined, sortDir: sortDir || undefined }
    });
    return response.data;
};

export const updateDoctorMarketing = async (
    doctorId: string,
    payload: UpdateDoctorMarketingPayload
): Promise<{ success: boolean; message: string }> => {
    const response = await api.put(`${API_ENDPOINTS.DOCTORS.UPDATE_MARKETING}/${doctorId}/marketing`, payload);
    return response.data;
};
