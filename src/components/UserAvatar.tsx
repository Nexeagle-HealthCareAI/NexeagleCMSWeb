import { initialsOf } from './nav/navHelpers';
import { useUserPhoto } from './userPhoto';
import './UserAvatar.css';

interface Props {
    userId?: string | null;
    name?: string | null;
    /** From the person's record; leave out (or empty) when they have no photo. */
    photoVersion?: string | null;
    size?: number;
    className?: string;
}

/** A person's photo, or their initials on a colour picked from their name. */
export default function UserAvatar({ userId, name, photoVersion, size = 32, className = '' }: Props) {
    const url = useUserPhoto(userId, photoVersion);
    const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };
    if (url) return <img className={`ne-avatar ${className}`} src={url} alt="" style={style} />;
    return (
        <span className={`ne-avatar ne-avatar-${hue(name)} ${className}`} style={style} aria-hidden="true">
            {initialsOf(name)}
        </span>
    );
}

const hue = (name?: string | null) => {
    let n = 0;
    for (const ch of name ?? '') n = (n * 31 + ch.charCodeAt(0)) % 6;
    return n;
};
