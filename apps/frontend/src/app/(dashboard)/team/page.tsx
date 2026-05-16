'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Role } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const roleBadge: Record<Role, string> = {
  OWNER:  'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  ADMIN:  'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  MEMBER: 'bg-gray-700/60 text-gray-400 border border-gray-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-gray-300 uppercase">{name.charAt(0)}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-gray-800/60">
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 rounded w-24" />
        </td>
      ))}
    </tr>
  );
}

export default function TeamPage() {
  const { success, error: toastError } = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [members, setMembers]         = useState<TeamMember[]>([]);
  const [loading, setLoading]         = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm]           = useState({ name: '', email: '', role: 'MEMBER' as 'ADMIN' | 'MEMBER', password: '' });
  const [inviting, setInviting]               = useState(false);
  const [inviteErrors, setInviteErrors]       = useState<Partial<typeof inviteForm>>({});

  const [confirmRemoveId, setConfirmRemoveId]     = useState<string | null>(null);
  const [removing, setRemoving]                   = useState(false);
  const [changingRole, setChangingRole]           = useState<string | null>(null);

  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    Promise.all([
      api.get('/auth/me').then(r => r.data as CurrentUser),
      api.get('/team').then(r => r.data as TeamMember[]),
    ])
      .then(([me, team]) => { setCurrentUser(me); setMembers(team); })
      .catch(() => toastError('Failed to load team'))
      .finally(() => setLoading(false));
  }, []);

  const refreshMembers = async () => {
    const r = await api.get('/team');
    setMembers(r.data);
  };

  const validateInvite = () => {
    const errs: Partial<typeof inviteForm> = {};
    if (!inviteForm.name.trim())                    errs.name     = 'Name is required';
    if (!inviteForm.email.trim())                   errs.email    = 'Email is required';
    if (!inviteForm.password)                       errs.password = 'Password is required';
    else if (inviteForm.password.length < 8)        errs.password = 'Minimum 8 characters';
    setInviteErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInvite = async () => {
    if (!validateInvite()) return;
    setInviting(true);
    try {
      await api.post('/team/invite', inviteForm);
      await refreshMembers();
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'MEMBER', password: '' });
      setInviteErrors({});
      success('Team member invited');
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to invite member');
    } finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId: string, role: Role) => {
    setChangingRole(memberId);
    try {
      await api.patch(`/team/${memberId}/role`, { role });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
      success('Role updated');
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to update role');
    } finally { setChangingRole(null); }
  };

  const handleRemove = async () => {
    if (!confirmRemoveId) return;
    setRemoving(true);
    try {
      await api.delete(`/team/${confirmRemoveId}`);
      setMembers(prev => prev.filter(m => m.id !== confirmRemoveId));
      setConfirmRemoveId(null);
      success('Member removed');
    } catch (err: any) {
      toastError(err?.response?.data?.error ?? 'Failed to remove member');
    } finally { setRemoving(false); }
  };

  const canActOn = (member: TeamMember) => {
    if (!currentUser) return false;
    if (member.id === currentUser.id) return false;
    if (currentUser.role === 'ADMIN' && member.role === 'OWNER') return false;
    return canManage;
  };

  const owners = members.filter(m => m.role === 'OWNER');
  const confirmMember = members.find(m => m.id === confirmRemoveId);

  return (
    <>
      <Topbar title="Team" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl">
          <Card padding="none">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-800/60">
              <div>
                <h2 className="text-sm font-semibold text-white">Members</h2>
                {!loading && (
                  <p className="text-xs text-gray-500 mt-0.5">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
                )}
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setShowInviteModal(true)}>
                  Invite Member
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800/60">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    {canManage && <th className="px-4 py-3 text-left font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-gray-500 text-sm">
                        No team members yet.
                      </td>
                    </tr>
                  ) : (
                    members.map(member => (
                      <tr key={member.id} className="border-t border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={member.name} />
                            <span className="font-medium text-white">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{member.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[member.role]}`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(member.createdAt)}</td>
                        {canManage && (
                          <td className="px-4 py-3">
                            {canActOn(member) ? (
                              <div className="flex items-center gap-2">
                                {currentUser?.role === 'OWNER' && (
                                  <select
                                    value={member.role}
                                    disabled={changingRole === member.id}
                                    onChange={e => handleRoleChange(member.id, e.target.value as Role)}
                                    className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                                  >
                                    <option value="MEMBER">MEMBER</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="OWNER">OWNER</option>
                                  </select>
                                )}
                                <button
                                  onClick={() => setConfirmRemoveId(member.id)}
                                  className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Remove member"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-700 text-xs">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {/* Invite Member Modal */}
      <Modal open={showInviteModal} onClose={() => { setShowInviteModal(false); setInviteErrors({}); }} title="Invite Team Member" size="md">
        <div className="space-y-3">
          <Input
            label="Name"
            placeholder="Jane Smith"
            value={inviteForm.name}
            onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
            error={inviteErrors.name}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jane@company.com"
            value={inviteForm.email}
            onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
            error={inviteErrors.email}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Role</label>
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as 'ADMIN' | 'MEMBER' }))}
              className="block w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20 hover:border-gray-600 transition-all"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={inviteForm.password}
            onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))}
            error={inviteErrors.password}
            hint="Minimum 8 characters"
          />
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleInvite}
              loading={inviting}
              disabled={!inviteForm.name || !inviteForm.email || !inviteForm.password}
              className="flex-1"
            >
              Send Invite
            </Button>
            <Button variant="secondary" onClick={() => { setShowInviteModal(false); setInviteErrors({}); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Remove Modal */}
      <Modal open={!!confirmRemoveId} onClose={() => setConfirmRemoveId(null)} title="Remove Member" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Remove <span className="text-white font-medium">{confirmMember?.name}</span> from the team? This action cannot be undone.
          </p>
          {confirmMember?.role === 'OWNER' && owners.length <= 1 && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              Cannot remove the last owner.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={removing}
              disabled={confirmMember?.role === 'OWNER' && owners.length <= 1}
              onClick={handleRemove}
              className="flex-1"
            >
              Remove
            </Button>
            <Button variant="secondary" onClick={() => setConfirmRemoveId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
