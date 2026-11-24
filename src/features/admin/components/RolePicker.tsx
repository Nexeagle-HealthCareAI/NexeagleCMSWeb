import type { RoleDto } from '../services/adminService';

interface Props {
    roles: RoleDto[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    readOnly?: boolean;
    /** Shown above the cards, for screen readers and as the group's name. */
    label: string;
}

/** Roles as cards with what each one is for. Switched-off roles show only while someone still has them. */
export default function RolePicker({ roles, selected, onChange, readOnly, label }: Props) {
    const shown = roles.filter(r => r.isActive || selected.has(r.roleId));
    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        onChange(next);
    };
    return (
        <fieldset className="ua-roles" disabled={readOnly}>
            <legend className="ua-visually-hidden">{label}</legend>
            {shown.map(r => (
                <label key={r.roleId} className={`ua-role ${selected.has(r.roleId) ? 'is-on' : ''} ${r.isActive ? '' : 'is-retired'}`}>
                    <input type="checkbox" checked={selected.has(r.roleId)} onChange={() => toggle(r.roleId)} />
                    <span>
                        <strong>{r.name}{!r.isActive && ' (no longer used)'}</strong>
                        {r.description && <small>{r.description}</small>}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}
