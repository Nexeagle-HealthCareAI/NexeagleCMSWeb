import { api } from '../../../services/api';

export interface Partner {
  partnerId: string;
  name: string;
  age: number;
  sex: string;
  highestQualification: string;
  currentProfession: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  email: string | null;
  phoneNumber: string | null;
  partnerCode: string;
  dashboardToken: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CreatePartnerPayload {
  name: string;
  age: number;
  sex: string;
  highestQualification: string;
  currentProfession: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  email?: string;
  phoneNumber?: string;
}

export const partnerService = {
  getAll: async () => {
    const response = await api.get('/partners');
    return response.data.data as Partner[];
  },
  
  create: async (payload: CreatePartnerPayload) => {
    const response = await api.post('/partners', payload);
    return response.data.data as Partner;
  },

  delete: async (partnerId: string) => {
    const response = await api.delete(`/partners/${partnerId}`);
    return response.data;
  },

  getDashboardStats: async (token: string) => {
    const response = await api.get(`/partners/dashboard/${token}`);
    return response.data.data;
  }
};
