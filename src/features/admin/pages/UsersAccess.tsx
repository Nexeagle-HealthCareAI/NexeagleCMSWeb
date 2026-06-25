import React, { useEffect, useMemo, useState } from 'react';
import { Users, ShieldCheck, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import '../../dashboard/pages/Dashboard.css';
import {
    adminService,
    type PermissionDto,
    type RoleDto,
    type UserSummary,
    type UserDetail,
    type Effect,
} from '../services/adminService';

type OverrideState = Record<string, 'inherit' | Effect>;

const btn = (bg: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
    border: 'none', background: bg, color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
});
const ghostBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px',
    border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
};
const input: React.CSSProperties = { padding: '9px 11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' };
const th: React.CSSProperties = { textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', padding: '8px 10px', letterSpacing: '0.5px' };
const td: React.CSSProperties = { padding: '10px', borderTop: '1px solid #eef2f7', fontSize: '14px', color: '#334155' };

const UsersAccess: React.FC = () => {
    const [tab, setTab] = useState<'users' | 'roles'>('users');
    const [permissions, setPermissions] = useState<PermissionDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const permsByCategory = useMemo(() => {
        const map: Record<string, PermissionDto[]> = {};
        for (const p of permissions) (map[p.category || 'Other'] ||= []).push(p);
        return map;
    }, [permissions]);

    const reloadUsers = async () => {
        try { setUsers(await adminService.getUsers()); }
        catch (e) { fail(e); }
    };
    const reloadRoles = async () => {
        try { setRoles(await adminService.getRoles()); }
        catch (e) { fail(e); }
    };

    useEffect(() => {
        (async () => {
            try {
                const [perms, rls, usrs] = await Promise.all([
                    adminService.getPermissions(),
                    adminService.getRoles(),
                    adminService.getUsers(),
                ]);
                setPermissions(perms);
                setRoles(rls);
                setUsers(usrs);
            } catch {
                setError('Failed to load users & access data.');
            }
        })();
    }, []);

    const flash = (m: string) => { setMsg(m); setError(null); setTimeout(() => setMsg(null), 3000); };
    const fail = (e: any) => setError(e?.response?.data?.message || e?.message || 'Action failed.');

    // ---------- create user ----------
    const [nuOpen, setNuOpen] = useState(false);
    const [nu, setNu] = useState({ email: '', fullName: '', password: '', roleIds: new Set<string>() });

    const createUser = async () => {
        if (nu.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        try {
            await adminService.createUser({ email: nu.email.trim(), fullName: nu.fullName.trim(), password: nu.password, roleIds: [...nu.roleIds] });
            setNu({ email: '', fullName: '', password: '', roleIds: new Set() });
            setNuOpen(false);
            await reloadUsers();
            flash('User created. They must change their password on first login.');
        } catch (e) { fail(e); }
    };

    // ---------- edit user access ----------
    const [edit, setEdit] = useState<UserDetail | null>(null);
    const [editRoleIds, setEditRoleIds] = useState<Set<string>>(new Set());
    const [editOverrides, setEditOverrides] = useState<OverrideState>({});

    const openEdit = async (id: string) => {
        try {
            const d = await adminService.getUser(id);
            setEdit(d);
            setEditRoleIds(new Set(d.roleIds));
            const ov: OverrideState = {};
            for (const o of d.overrides) ov[o.key] = o.effect;
            setEditOverrides(ov);
        } catch (e) { fail(e); }
    };

    const saveEdit = async () => {
        if (!edit) return;
        const overrides = Object.entries(editOverrides)
            .filter(([, v]) => v !== 'inherit')
            .map(([key, v]) => ({ key, effect: v as Effect }));
        try {
            await adminService.updateUser(edit.userId, { roleIds: [...editRoleIds], overrides });
            setEdit(null);
            await reloadUsers();
            flash('Access updated.');
        } catch (e) { fail(e); }
    };

    const toggleActive = async (u: UserSummary) => {
        try { await adminService.updateUser(u.userId, { isActive: !u.isActive }); await reloadUsers(); }
        catch (e) { fail(e); }
    };

    const resetPw = async (u: UserSummary) => {
        const pw = window.prompt(`Set a temporary password for ${u.email} (min 8 chars):`);
        if (!pw) return;
        try { await adminService.resetPassword(u.userId, pw); flash('Password reset; user must change it on next login.'); }
        catch (e) { fail(e); }
    };

    // ---------- roles ----------
    const emptyRoleForm = { id: '', name: '', description: '', permKeys: new Set<string>() };
    const [roleForm, setRoleForm] = useState<{ id: string; name: string; description: string; permKeys: Set<string> }>(emptyRoleForm);
    const [roleFormOpen, setRoleFormOpen] = useState(false);

    const openNewRole = () => { setRoleForm({ ...emptyRoleForm, permKeys: new Set() }); setRoleFormOpen(true); };
    const openEditRole = (r: RoleDto) => { setRoleForm({ id: r.roleId, name: r.name, description: r.description || '', permKeys: new Set(r.permissionKeys) }); setRoleFormOpen(true); };

    const saveRole = async () => {
        try {
            if (roleForm.id) {
                await adminService.updateRole(roleForm.id, { name: roleForm.name.trim(), description: roleForm.description, permissionKeys: [...roleForm.permKeys] });
            } else {
                await adminService.createRole({ name: roleForm.name.trim(), description: roleForm.description, permissionKeys: [...roleForm.permKeys] });
            }
            setRoleFormOpen(false);
            await reloadRoles();
            flash('Role saved.');
        } catch (e) { fail(e); }
    };

    const removeRole = async (r: RoleDto) => {
        if (!window.confirm(`Delete role "${r.name}"? Users keep their other roles.`)) return;
        try { await adminService.deleteRole(r.roleId); await reloadRoles(); flash('Role deleted.'); }
        catch (e) { fail(e); }
    };

    const toggleSet = (set: Set<string>, key: string) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><Users size={26} style={{ marginRight: 10, verticalAlign: 'middle' }} />Users &amp; Access</h1>
                    <p className="dashboard-subtitle">Add staff, assign roles, and fine-tune page access.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['users', 'roles'] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)} style={{ ...ghostBtn, ...(tab === t ? { background: '#0f52ba', color: 'white', borderColor: '#0f52ba' } : {}) }}>
                            {t === 'users' ? <Users size={16} /> : <ShieldCheck size={16} />}{t === 'users' ? 'Users' : 'Roles'}
                        </button>
                    ))}
                </div>
            </header>

            {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{msg}</div>}
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            {tab === 'users' && (
                <div className="table-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 15 }}>{users.length} user(s)</h3>
                        <button style={btn('#0f52ba')} onClick={() => setNuOpen((v) => !v)}><Plus size={16} />New user</button>
                    </div>

                    {nuOpen && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, background: '#f8fafc' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                <input style={input} placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
                                <input style={input} placeholder="Full name" value={nu.fullName} onChange={(e) => setNu({ ...nu, fullName: e.target.value })} />
                                <input style={input} type="text" placeholder="Temp password (min 8)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Roles</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {roles.map((r) => (
                                        <label key={r.roleId} style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                            <input type="checkbox" checked={nu.roleIds.has(r.roleId)} onChange={() => setNu({ ...nu, roleIds: toggleSet(nu.roleIds, r.roleId) })} />{r.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                <button style={btn('#16a34a')} onClick={createUser}><Save size={16} />Create</button>
                                <button style={ghostBtn} onClick={() => setNuOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Roles</th><th style={th}>Status</th><th style={th}></th></tr></thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.userId}>
                                    <td style={td}>{u.fullName}</td>
                                    <td style={td}>{u.email}</td>
                                    <td style={td}>{u.roles.join(', ') || <span style={{ color: '#94a3b8' }}>none</span>}</td>
                                    <td style={td}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: u.isActive ? '#166534' : '#991b1b' }}>{u.isActive ? 'Active' : 'Disabled'}</span>
                                    </td>
                                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                        <button style={{ ...ghostBtn, padding: '5px 9px' }} onClick={() => openEdit(u.userId)}>Edit access</button>{' '}
                                        <button style={{ ...ghostBtn, padding: '5px 9px' }} onClick={() => toggleActive(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>{' '}
                                        <button style={{ ...ghostBtn, padding: '5px 9px' }} onClick={() => resetPw(u)}><RotateCcw size={13} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'roles' && (
                <div className="table-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 15 }}>{roles.length} role(s)</h3>
                        <button style={btn('#0f52ba')} onClick={openNewRole}><Plus size={16} />New role</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Role</th><th style={th}>Description</th><th style={th}>Pages/actions</th><th style={th}></th></tr></thead>
                        <tbody>
                            {roles.map((r) => (
                                <tr key={r.roleId}>
                                    <td style={td}>{r.name}{r.isSystemDefined && <span style={{ marginLeft: 6, fontSize: 10, background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>system</span>}</td>
                                    <td style={td}>{r.description}</td>
                                    <td style={td}>{r.permissionKeys.length}</td>
                                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                        <button style={{ ...ghostBtn, padding: '5px 9px' }} onClick={() => openEditRole(r)}>Edit</button>{' '}
                                        {!r.isSystemDefined && <button style={{ ...ghostBtn, padding: '5px 9px', color: '#991b1b' }} onClick={() => removeRole(r)}><Trash2 size={13} /></button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit-user drawer */}
            {edit && (
                <Drawer title={`Access — ${edit.fullName}`} onClose={() => setEdit(null)} onSave={saveEdit}>
                    <Section title="Roles">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {roles.map((r) => (
                                <label key={r.roleId} style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                    <input type="checkbox" checked={editRoleIds.has(r.roleId)} onChange={() => setEditRoleIds(toggleSet(editRoleIds, r.roleId))} />{r.name}
                                </label>
                            ))}
                        </div>
                    </Section>
                    <Section title="Per-user overrides (Deny wins over roles)">
                        {Object.entries(permsByCategory).map(([cat, perms]) => (
                            <div key={cat} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>{cat}</div>
                                {perms.map((p) => (
                                    <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                        <span style={{ fontSize: 13 }}>{p.displayName}</span>
                                        <select value={editOverrides[p.key] || 'inherit'} onChange={(e) => setEditOverrides({ ...editOverrides, [p.key]: e.target.value as any })} style={{ ...input, width: 130, padding: '5px 8px' }}>
                                            <option value="inherit">Inherit</option>
                                            <option value="Allow">Allow</option>
                                            <option value="Deny">Deny</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </Section>
                </Drawer>
            )}

            {/* Role create/edit drawer */}
            {roleFormOpen && (
                <Drawer title={roleForm.id ? 'Edit role' : 'New role'} onClose={() => setRoleFormOpen(false)} onSave={saveRole}>
                    <input style={{ ...input, marginBottom: 10 }} placeholder="Role name" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
                    <input style={{ ...input, marginBottom: 14 }} placeholder="Description" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
                    <Section title="Permissions">
                        {Object.entries(permsByCategory).map(([cat, perms]) => (
                            <div key={cat} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>{cat}</div>
                                {perms.map((p) => (
                                    <label key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '3px 0' }}>
                                        <input type="checkbox" checked={roleForm.permKeys.has(p.key)} onChange={() => setRoleForm({ ...roleForm, permKeys: toggleSet(roleForm.permKeys, p.key) })} />{p.displayName}
                                    </label>
                                ))}
                            </div>
                        ))}
                    </Section>
                </Drawer>
            )}
        </div>
    );
};

const Drawer: React.FC<{ title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }> = ({ title, onClose, onSave, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} onClick={onClose}>
        <div style={{ width: 460, maxWidth: '92vw', height: '100%', background: 'white', padding: 22, overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
                <button style={{ ...ghostBtn, padding: 6 }} onClick={onClose}><X size={16} /></button>
            </div>
            {children}
            <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
                <button style={btn('#16a34a')} onClick={onSave}><Save size={16} />Save</button>
                <button style={ghostBtn} onClick={onClose}>Cancel</button>
            </div>
        </div>
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{title}</div>
        {children}
    </div>
);

export default UsersAccess;
