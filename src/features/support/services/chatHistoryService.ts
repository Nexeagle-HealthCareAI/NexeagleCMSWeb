import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';
import type { Message } from '../../../store/useSupportStore';

export interface ChatSessionListItem {
    sessionId: string;
    guestId: string;
    guestName: string | null;
    guestEmail: string | null;
    status: string;
    startedAt: string;
    closedAt: string | null;
    agentNames: string | null;
    messageCount: number;
}

export interface PagedResponse<T> {
    data: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export const getChatSessions = async (
    page: number,
    limit: number,
    from?: string,
    to?: string,
    search?: string
): Promise<PagedResponse<ChatSessionListItem>> => {
    const response = await api.get<PagedResponse<ChatSessionListItem>>(API_ENDPOINTS.CHAT.SESSIONS, {
        params: { page, limit, from: from || undefined, to: to || undefined, search: search || undefined }
    });
    return response.data;
};

export const getChatTranscript = async (sessionId: string): Promise<Message[]> => {
    const response = await api.get<Message[]>(`${API_ENDPOINTS.CHAT.HISTORY}/${sessionId}`);
    return response.data;
};
