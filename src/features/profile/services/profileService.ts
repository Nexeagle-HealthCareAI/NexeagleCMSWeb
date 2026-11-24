import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface Profile {
    userId: string;
    email: string;
    fullName: string;
    phoneNumber?: string | null;
    jobTitle?: string | null;
    photoVersion?: string | null;
    roles: string[];
    lastLoginAt?: string | null;
}

/** An empty string removes the phone number or job title; a missing field leaves it. */
export interface ProfileChange { fullName?: string; phoneNumber?: string; jobTitle?: string }

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

const photoForm = (photo: Blob) => {
    const form = new FormData();
    form.append('file', photo, photo.type === 'image/png' ? 'photo.png' : photo.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
    return form;
};

export const profileService = {
    get: () => api.get<Profile>(API_ENDPOINTS.PROFILE).then(r => r.data),
    update: (change: ProfileChange) => api.put<Profile>(API_ENDPOINTS.PROFILE, change).then(r => r.data),
    setPhoto: (photo: Blob) => api.put<{ photoVersion: string }>(`${API_ENDPOINTS.PROFILE}/photo`, photoForm(photo), multipart).then(r => r.data.photoVersion),
    removePhoto: () => api.delete(`${API_ENDPOINTS.PROFILE}/photo`).then(() => undefined),

    /** An administrator setting someone else's photo (user-management.manage). */
    setPhotoFor: (userId: string, photo: Blob) =>
        api.put<{ photoVersion: string }>(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/photo`, photoForm(photo), multipart).then(r => r.data.photoVersion),
    removePhotoFor: (userId: string) => api.delete(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/photo`).then(() => undefined),
};

/** The API's message for a failed request, or a plain fallback. */
export const problem = (err: unknown, fallback: string): string => {
    const e = err as { response?: { data?: { message?: string }; status?: number } };
    if (e?.response?.status === 413) return 'The photo is larger than 2 MB. Choose a smaller one.';
    return e?.response?.data?.message || fallback;
};
