import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface RadStaffItem {
    staffId: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    designation: string | null;
    specialization: string | null;
    status: string;
}

export interface RadHospitalItem {
    hospitalId: string;
    hospitalName: string;
    hospitalAddress: string;
    gstin: string | null;
    registrationNumber: string | null;
    nabhNumber: string | null;
    status: string;
    createdAt: string;
    subscriptionStatus: string;
    billingCycle: string;
    modules: string;
    staff: RadStaffItem[];
}

export const getRadHospitals = async (): Promise<RadHospitalItem[]> => {
    const response = await api.get<RadHospitalItem[]>(API_ENDPOINTS.RAD_HOSPITALS.LIST);
    return response.data;
};
