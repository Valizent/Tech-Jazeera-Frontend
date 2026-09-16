/**
 * UserListPage — login management (P2-M2, restructured). Every login now
 * starts from an Employee record (see EmployeeLoginPanel on the Employee
 * profile), so this page's job is managing EXISTING logins: reset password,
 * deactivate/reactivate, delete. No "create" flow lives here anymore.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listStaffUsers, updateStaffUser, resetStaffPassword, deleteStaffUser } from '../users.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { STAFF_USER_MANAGE_ROLES } from '../../../lib/constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function UserListPage() {
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canManage = STAFF_USER_MANAGE_ROLES.includes(viewer.role);

  const { data: users, isPending, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => listStaffUsers(),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateStaffUser(id, { isActive }),
    onSuccess: () => {
      toast.success('User updated.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const [created, setCreated] = useState(null); // one-time credential reveal, from a password reset
  // Reveals through the same one-time-password modal — the response only
  // carries { tempPassword }, so the row's own name/email (already in hand
  // at click time) fills in the rest of that modal's shape.
  const resetPasswordMutation = useMutation({
    mutationFn: (u) => resetStaffPassword(u._id).then((data) => ({ user: u, ...data, reset: true })),
    onSuccess: (data) => setCreated(data),
    onError: (error) => toast.error(apiMessage(error)),
  });

  const [toDelete, setToDelete] = useState(null);
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStaffUser(id),
    onSuccess: () => {
      toast.success(`${toDelete.name} deleted.`);
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      toast.success('Temporary password copied.');
    } catch {
      toast.error('Could not copy — select and copy it manually.');
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <span className="font-medium text-text">
          {u.name}
          <span className="block text-xs font-normal text-muted">{u.email}</span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant="primary">{u.role}</Badge>
          {u.employee?.manager && <span className="text-xs text-muted">reports to {u.employee.manager.name}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>,
    },
    { key: 'createdAt', header: 'Created', hideOnMobile: true, render: (u) => formatDate(u.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) =>
        canManage && u._id !== viewer.id ? (
          <span className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              isLoading={resetPasswordMutation.isPending}
              onClick={() => resetPasswordMutation.mutate(u)}
            >
              Reset password
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={u.isActive ? 'hover:text-danger' : ''}
              isLoading={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate({ id: u._id, isActive: !u.isActive })}
            >
              {u.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(u)}>
              Delete
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Team"
        description="Every staff and worker login. To create a new one, open the person's Employee profile."
        onBack={() => navigate(-1)}
      />

      {isError ? (
        <EmptyState
          title="Could not load users"
          description="Check your connection and try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <Table columns={columns} rows={users ?? []} rowKey={(u) => u._id} loading={isPending} />
      )}

      <Modal open={!!created} onClose={() => setCreated(null)} title="Password reset">
        {created && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Their old password no longer works. Hand this new one to{' '}
              <span className="font-medium text-text">{created.user.name}</span> — it&apos;s shown{' '}
              <span className="font-medium text-text">once</span>, copy it now.
            </p>
            <div className="rounded-lg border border-border bg-bg p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Email</p>
              <p className="mt-0.5 font-medium">{created.user.email}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted">Temporary password</p>
              <p className="mt-0.5 select-all break-all font-mono text-base font-semibold">{created.tempPassword}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={copyPassword}>
                Copy password
              </Button>
              <Button onClick={() => setCreated(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete login?"
        message={`${toDelete?.name} (${toDelete?.email}) will be permanently removed — this cannot be undone. To just remove access while keeping the account, use Deactivate instead.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
