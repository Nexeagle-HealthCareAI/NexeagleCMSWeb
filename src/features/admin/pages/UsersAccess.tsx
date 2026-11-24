import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, ShieldCheck, Users } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { adminService, type PermissionDto, type RoleDto, type UserSummary } from '../services/adminService';
import PeopleList from '../components/PeopleList';
import PersonPanel from '../components/PersonPanel';
import NewPersonDialog from '../components/NewPersonDialog';
import RolesView from '../components/RolesView';
import '../../profile/profile.css';
import './UsersAccess.css';

/**
 * Users & access. People: everyone who can sign in, with their details, photo, roles and what
 * they can open. Roles: what each role lets people do.
 *
 * The page needs user-management.view; every change needs user-management.manage (checked again
 * by the API), so a view-only person gets the same page without the controls.
 */
export default function UsersAccess() {
    const canManage = useAuthStore(s => s.hasAccess('user-management.manage'));
    const meId = useAuthStore(s => s.user?.id);
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'roles' ? 'roles' : 'people';
    const openId = params.get('person');

    const [catalog, setCatalog] = useState<PermissionDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [users, setUsers] = useState<UserSummary[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [adding, setAdding] = useState(false);

    const reload = useCallback(() =>
        Promise.all([adminService.getPermissions(), adminService.getRoles(), adminService.getUsers()])
            .then(([perms, rls, usrs]) => {
                setCatalog(perms);
                setRoles(rls);
                setUsers(usrs);
                setFailed(false);
            })
            .catch(() => setFailed(true)), []);
    useEffect(() => { void reload(); }, [reload]);

    const go = (next: { tab?: string; person?: string | null }) => {
        const p = new URLSearchParams(params);
        if (next.tab !== undefined) { if (next.tab === 'people') p.delete('tab'); else p.set('tab', next.tab); }
        if (next.person !== undefined) { if (next.person) p.set('person', next.person); else p.delete('person'); }
        setParams(p, { replace: true });
    };

    return (
        <div className="ua-page">
            <header className="ua-head">
                <div>
                    <h1>Users &amp; access</h1>
                    <p>Who can sign in to the CMS, and what each person can open.</p>
                </div>
                {canManage && tab === 'people' && (
                    <button type="button" className="pf-btn pf-btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add a person</button>
                )}
            </header>

            <div className="ua-tabs" role="tablist" aria-label="Users and access">
                <button type="button" role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'is-on' : ''} onClick={() => go({ tab: 'people' })}>
                    <Users size={16} aria-hidden="true" /> People{users ? ` (${users.length})` : ''}
                </button>
                <button type="button" role="tab" aria-selected={tab === 'roles'} className={tab === 'roles' ? 'is-on' : ''} onClick={() => go({ tab: 'roles', person: null })}>
                    <ShieldCheck size={16} aria-hidden="true" /> Roles
                </button>
            </div>

            {failed ? (
                <p className="pf-error" role="alert">People and roles could not be loaded. <button type="button" className="pf-btn pf-btn-quiet" onClick={() => void reload()}>Try again</button></p>
            ) : !users ? (
                <p className="pf-hint">Loading…</p>
            ) : tab === 'people' ? (
                <PeopleList users={users} roles={roles} selectedId={openId} onOpen={id => go({ person: id })} />
            ) : (
                <RolesView roles={roles} catalog={catalog} users={users} canManage={canManage} onChanged={() => void reload()}
                    onOpenPerson={id => go({ tab: 'people', person: id })} />
            )}

            {openId && tab === 'people' && users && (
                <PersonPanel
                    key={openId}
                    userId={openId} catalog={catalog} roles={roles} canManage={canManage} meId={meId}
                    onClose={() => go({ person: null })} onSaved={() => void reload()}
                />
            )}
            {adding && (
                <NewPersonDialog
                    roles={roles}
                    onCancel={() => setAdding(false)}
                    onCreated={person => {
                        setAdding(false);
                        toast.success(`${person.fullName} added. Give them their temporary password; they choose a new one when they sign in.`);
                        void reload();
                        go({ person: person.userId });
                    }}
                />
            )}
        </div>
    );
}
