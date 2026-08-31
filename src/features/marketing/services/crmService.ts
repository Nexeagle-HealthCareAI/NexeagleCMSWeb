import { api } from '../../../services/api';
import { type AiSocialCampaign } from '../types/crm';

export const crmService = {
    // ---------------------------------
    // AI CO-PILOT
    // ---------------------------------
    generatePitch: async (leadId: string): Promise<string> => {
        const response = await api.post(`/crm/ai/pitch`, { leadId });
        return response.data.pitch;
    },

    resolveObjection: async (leadId: string, objection: string): Promise<string> => {
        const response = await api.post(`/crm/ai/objection`, { leadId, objection });
        return response.data.response;
    },

    generateSocialCampaign: async (topic: string): Promise<AiSocialCampaign> => {
        const response = await api.post(`/crm/ai/social`, { topic });
        return response.data;
    }
};
