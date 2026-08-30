import axios from 'axios';
import { type CrmLead, type AiSocialCampaign } from '../types/crm';

// Base URL for the CMS API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5242';

// Ensure the token is attached
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        Authorization: `Bearer ${token}`
    };
};

export const crmService = {
    // ---------------------------------
    // LEADS
    // ---------------------------------
    getLeads: async (): Promise<CrmLead[]> => {
        const response = await axios.get(`${API_URL}/crm/leads`, { headers: getAuthHeaders() });
        return response.data;
    },

    updateLeadStage: async (id: string, stage: string): Promise<void> => {
        await axios.patch(`${API_URL}/crm/leads/${id}/stage`, { stage }, { headers: getAuthHeaders() });
    },

    // ---------------------------------
    // AI CO-PILOT
    // ---------------------------------
    generatePitch: async (leadId: string): Promise<string> => {
        const response = await axios.post(`${API_URL}/crm/ai/pitch`, { leadId }, { headers: getAuthHeaders() });
        return response.data.pitch;
    },

    resolveObjection: async (leadId: string, objection: string): Promise<string> => {
        const response = await axios.post(`${API_URL}/crm/ai/objection`, { leadId, objection }, { headers: getAuthHeaders() });
        return response.data.response;
    },

    generateSocialCampaign: async (topic: string): Promise<AiSocialCampaign> => {
        const response = await axios.post(`${API_URL}/crm/ai/social`, { topic }, { headers: getAuthHeaders() });
        return response.data;
    },

    // ---------------------------------
    // WHATSAPP
    // ---------------------------------
    dispatchTemplate: async (leadId: string, templateName: string): Promise<void> => {
        await axios.post(`${API_URL}/crm/whatsapp/dispatch-template`, { leadId, templateName }, { headers: getAuthHeaders() });
    }
};
