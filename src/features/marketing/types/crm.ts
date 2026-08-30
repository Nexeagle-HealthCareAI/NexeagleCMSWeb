export interface CrmLead {
    id: string;
    leadNumber: string;
    contactName: string;
    facilityName: string;
    facilityType: string;
    bedCount: number;
    city: string;
    state: string;
    phoneNumber: string;
    email?: string;
    sourceChannel: string;
    status: 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'NEGOTIATION' | 'WON' | 'LOST';
    aiIntentScore: number;
    aiPersonaSummary?: string;
    dealValue: number;
    createdAt: string;
    updatedAt: string;
}

export interface CrmLeadActivity {
    id: string;
    leadId: string;
    activityType: string;
    direction: 'INBOUND' | 'OUTBOUND';
    messageBody: string;
    templateName?: string;
    mediaUrl?: string;
    status: string;
    createdAt: string;
}

export interface AiSocialCampaign {
    instagram_carousel: string;
    facebook_ad_copy: string;
    youtube_shorts_script: string;
    twitter_thread: string;
}
