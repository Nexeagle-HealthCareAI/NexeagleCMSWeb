import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { waService, waError } from '../services/waService';
import type { WaMessage } from '../types';

// A picture, video, voice note or document in a message. Fetched through the API (Meta's own links need the token).
export default function MediaView({ message }: { message: WaMessage }) {
  const isPicture = (message.mediaMime ?? '').startsWith('image/') || message.type === 'image' || message.type === 'sticker';
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const blob = await waService.media(message.messageId);
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return u;
    } catch (e) {
      setError(waError(e));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPicture) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.messageId]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const save = async () => {
    const u = url ?? (await load());
    if (!u) return;
    const a = document.createElement('a');
    a.href = u;
    a.download = message.mediaName || `${message.type}-${message.messageId.slice(0, 8)}`;
    a.click();
  };

  if (error) return <div className="wa-media wa-media-err">{error}</div>;
  if (isPicture && url) return <img className="wa-media-img" src={url} alt={message.body || 'Picture'} />;
  if (message.type === 'audio' && url) return <audio controls src={url} />;
  if (message.type === 'video' && url) return <video className="wa-media-img" controls src={url} />;
  return (
    <button type="button" className="wa-media" onClick={() => (message.type === 'audio' || message.type === 'video') && !url ? void load() : void save()} disabled={loading}>
      {message.type === 'audio' || message.type === 'video' ? null : <FileText size={16} />}
      <span>{loading ? 'Loading…' : message.mediaName || (message.type === 'audio' ? 'Play voice note' : message.type === 'video' ? 'Play video' : 'Document')}</span>
      {message.type !== 'audio' && message.type !== 'video' && <Download size={14} />}
    </button>
  );
}
