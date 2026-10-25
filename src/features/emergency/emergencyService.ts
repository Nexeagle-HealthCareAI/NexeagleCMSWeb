import { api } from '../../services/api';

// Vita's emergency takeover (vision Phase 3), CMS side. CMS API /api/v1/emergency (emergency.manage) relays to 1HMSAPI, which keeps
// the hospitals' opt-ins, the places added here and the alert log. Answers are { success, data } with 1HMS's own shapes in data.

export const EMERGENCY_PERMISSION = 'emergency.manage';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface EmergencyPlace {
  settingId: string;
  hospitalId?: string | null;
  source: 'HOSPITAL' | 'CMS';
  name?: string | null;
  kind: 'HOSPITAL' | 'AMBULANCE';
  isEnabled: boolean;
  emergencyPhone?: string | null;
  alternatePhone?: string | null;
  alertWhatsApp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  landmark?: string | null;
  address?: string | null;
  city?: string | null;
  is24x7: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  capabilities: string[];
  dutyContactName?: string | null;
  dutyContactPhone?: string | null;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verificationNote?: string | null;
  updatedAt?: string | null;
  listed: boolean;
}

export interface PlaceList {
  items: EmergencyPlace[];
  pending: number;
  verified: number;
  rejected: number;
}

export interface NewPlace {
  name: string;
  kind: 'HOSPITAL' | 'AMBULANCE';
  emergencyPhone: string;
  alternatePhone?: string;
  alertWhatsApp?: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  address?: string;
  city?: string;
  is24x7: boolean;
  openTime?: string;
  closeTime?: string;
  capabilities: string[];
  isEnabled: boolean;
}

export interface AlertLogPlace {
  settingId: string;
  name: string;
  distanceKm?: number | null;
  whatsAppSent: boolean;
  inApp: boolean;
  callTaps: number;
  acknowledged?: string | null;
}

export interface AlertLogEvent {
  eventId: string;
  at: string;
  reason?: string | null;
  channel?: string | null;
  sharedMobile?: string | null;
  places: AlertLogPlace[];
}

/** 1HMS's message from a refused request, else a generic one. */
export function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || 'Something went wrong. Please try again.';
}

export const emergencyService = {
  async places(status?: VerificationStatus): Promise<PlaceList> {
    const r = await api.get('/emergency/places', { params: status ? { status } : undefined });
    const d = r.data?.data ?? {};
    return { items: d.items ?? [], pending: d.pending ?? 0, verified: d.verified ?? 0, rejected: d.rejected ?? 0 };
  },
  async verify(settingId: string, decision: 'VERIFIED' | 'REJECTED', note?: string): Promise<void> {
    await api.post(`/emergency/places/${settingId}/verify`, { decision, note: note || null });
  },
  async add(place: NewPlace): Promise<EmergencyPlace | null> {
    const r = await api.post('/emergency/places', place);
    return r.data?.data?.items?.[0] ?? null;
  },
  async setEnabled(place: EmergencyPlace, isEnabled: boolean): Promise<void> {
    await api.put(`/emergency/places/${place.settingId}`, { ...place, isEnabled });
  },
  async alerts(): Promise<AlertLogEvent[]> {
    const r = await api.get('/emergency/alerts');
    return r.data?.data?.events ?? [];
  },
};
