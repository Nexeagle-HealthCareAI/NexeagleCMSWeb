import React from 'react';
import { Navigation } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface HospitalLocationMapProps {
    latitude: number;
    longitude: number;
    label?: string;
}

// Read-only location preview for CMS admins -- a static Mapbox image, same approach as
// NexEagleWebsite's DoctorLocationMap.tsx (no interactive mapbox-gl JS needed for a single
// fixed pin), since CMS has no location EDIT path -- hospitals set their own GPS via
// easyHMSWeb's HospitalBrandingConfig.tsx, not here.
const HospitalLocationMap: React.FC<HospitalLocationMapProps> = ({ latitude, longitude, label }) => {
    if (!MAPBOX_TOKEN) {
        return (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Map preview unavailable (no Mapbox token configured for CMS).
            </div>
        );
    }

    const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+2563eb(${longitude},${latitude})/${longitude},${latitude},15,0/640x300@2x?access_token=${MAPBOX_TOKEN}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    return (
        <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                position: 'relative',
                display: 'block',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-color, #e2e8f0)',
                textDecoration: 'none',
            }}
            aria-label={label ? `Get directions to ${label}` : 'Get directions'}
        >
            <img
                src={src}
                alt={label ? `Map showing the location of ${label}` : 'Hospital location map'}
                style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
                loading="lazy"
            />
            <span
                style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
            >
                <Navigation size={13} />
                Get Directions
            </span>
        </a>
    );
};

export default HospitalLocationMap;
