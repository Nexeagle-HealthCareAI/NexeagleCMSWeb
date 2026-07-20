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
    // From UserAuth.LastLoginTime (UTC ISO string) — null if the doctor has never logged in.
    lastLoginTime: string | null;
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

export interface DoctorHospitalAffiliation {
    hospitalId: string;
    hospitalName: string | null;
    departmentName: string | null;
    opdConsultFee: number | null;
    ipdVisitFee: number | null;
    emergencyFee: number | null;
}

// Full "A to Z" profile — every hospital this doctor is affiliated with, not just the one
// GET /doctors' list row deterministically picks.
export interface DoctorDetail {
    doctorId: string;
    userId: string;
    fullName: string | null;
    mobileNumber: string | null;
    email: string | null;
    photoUrl: string | null;
    licenseNumber: string;
    medicalCouncil: string | null;
    registrationYear: number | null;
    qualification: string | null;
    experienceYears: number | null;
    bio: string | null;
    profileCompletionPercent: number;
    specializations: string[];
    languages: string[];
    publicContactEmail: string | null;
    publicContactPhone: string | null;
    isPubliclyListed: boolean;
    isFeatured: boolean;
    isDelistedByAdmin: boolean;
    discountPercent: number | null;
    discountStartAt: string | null;
    discountEndAt: string | null;
    createdAt: string;
    // From UserAuth.LastLoginTime (UTC ISO string) — null if the doctor has never logged in.
    lastLoginTime: string | null;
    hospitals: DoctorHospitalAffiliation[];
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

export const getDoctorDetail = async (doctorId: string): Promise<DoctorDetail> => {
    const response = await api.get<DoctorDetail>(`${API_ENDPOINTS.DOCTORS.GET_DETAIL}/${doctorId}`);
    return response.data;
};

export const updateDoctorMarketing = async (
    doctorId: string,
    payload: UpdateDoctorMarketingPayload
): Promise<{ success: boolean; message: string }> => {
    const response = await api.put(`${API_ENDPOINTS.DOCTORS.UPDATE_MARKETING}/${doctorId}/marketing`, payload);
    return response.data;
};
