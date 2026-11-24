import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Trash2 } from 'lucide-react';
import UserAvatar from '../../components/UserAvatar';
import { forgetPhotos, rememberPhoto } from '../../components/userPhoto';
import { checkImageFile, IMAGE_ACCEPT, ImageProblem } from '../healthWiki/components/prepareImage';
import PhotoEditor from './PhotoEditor';
import { problem } from './services/profileService';

interface Props {
    userId: string;
    name: string;
    photoVersion?: string | null;
    /** Heading of the crop window. */
    title: string;
    upload: (photo: File) => Promise<string>;
    remove: () => Promise<void>;
    onChanged: (photoVersion: string | null) => void;
    size?: number;
    readOnly?: boolean;
}

/** A person's photo with "Change photo" and "Remove": pick a picture, crop it square, save. */
export default function PhotoControl({ userId, name, photoVersion, title, upload, remove, onChanged, size = 96, readOnly }: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const chosen = (picked?: File) => {
        if (input.current) input.current.value = '';
        if (!picked) return;
        try { checkImageFile(picked); setFile(picked); }
        catch (e) { toast.error(e instanceof ImageProblem ? e.message : 'That file could not be used.'); }
    };

    const save = async (photo: File) => {
        try {
            const version = await upload(photo);
            rememberPhoto(userId, version, photo);
            onChanged(version);
            setFile(null);
            toast.success('Photo saved');
        } catch (e) {
            throw new Error(problem(e, 'The photo could not be saved. Try again.'));
        }
    };

    const drop = async () => {
        setBusy(true);
        try {
            await remove();
            forgetPhotos(userId);
            onChanged(null);
            toast.success('Photo removed');
        } catch (e) {
            toast.error(problem(e, 'The photo could not be removed. Try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="pf-photo">
            <UserAvatar userId={userId} name={name} photoVersion={photoVersion} size={size} />
            {!readOnly && (
                <div className="pf-photo-actions">
                    <button type="button" className="pf-btn" onClick={() => input.current?.click()} disabled={busy}>
                        <Camera size={16} aria-hidden="true" /> {photoVersion ? 'Change photo' : 'Add a photo'}
                    </button>
                    {photoVersion && (
                        <button type="button" className="pf-btn pf-btn-quiet" onClick={drop} disabled={busy}>
                            <Trash2 size={16} aria-hidden="true" /> Remove
                        </button>
                    )}
                    <span className="pf-hint">JPG, PNG, WebP or iPhone photo. You can crop it next.</span>
                    <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden aria-label={`Choose a photo for ${name}`}
                        onChange={e => chosen(e.target.files?.[0])} />
                </div>
            )}
            {file && <PhotoEditor file={file} title={title} onCancel={() => setFile(null)} onSave={save} />}
        </div>
    );
}
