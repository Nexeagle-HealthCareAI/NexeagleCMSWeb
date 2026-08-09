import { api } from '../../../services/api';

export type RewardKind = 'PercentageOff' | 'ExtraMonths';

export interface ReferralCodeType {
  referralCodeTypeId: string;
  name: string;
  rewardKind: RewardKind;
  rewardValue: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReferralCodeTypePayload {
  name: string;
  rewardKind: RewardKind;
  rewardValue: number;
}

export interface UpdateReferralCodeTypePayload extends CreateReferralCodeTypePayload {
  isActive: boolean;
}

export interface ReferralCode {
  referralCodeId: string;
  referralCodeTypeId: string;
  referralCodeTypeName: string;
  rewardKind: RewardKind;
  rewardValue: number;
  code: string;
  isActive: boolean;
  redeemedByHospitalId: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

export interface CreateReferralCodePayload {
  referralCodeTypeId: string;
  // Blank/undefined = auto-generate a unique code server-side.
  code?: string;
}

export const referralCodeService = {
  getAllTypes: async () => {
    const response = await api.get('/ReferralCodes/types');
    return response.data.data as ReferralCodeType[];
  },

  createType: async (payload: CreateReferralCodeTypePayload) => {
    const response = await api.post('/ReferralCodes/types', payload);
    return response.data.data as ReferralCodeType;
  },

  updateType: async (referralCodeTypeId: string, payload: UpdateReferralCodeTypePayload) => {
    const response = await api.put(`/ReferralCodes/types/${referralCodeTypeId}`, payload);
    return response.data.data as ReferralCodeType;
  },

  getAllCodes: async () => {
    const response = await api.get('/ReferralCodes');
    return response.data.data as ReferralCode[];
  },

  createCode: async (payload: CreateReferralCodePayload) => {
    const response = await api.post('/ReferralCodes', payload);
    return response.data.data as ReferralCode;
  },

  activateCode: async (referralCodeId: string) => {
    const response = await api.post(`/ReferralCodes/${referralCodeId}/activate`);
    return response.data.data as ReferralCode;
  },

  deactivateCode: async (referralCodeId: string) => {
    const response = await api.post(`/ReferralCodes/${referralCodeId}/deactivate`);
    return response.data.data as ReferralCode;
  },
};
