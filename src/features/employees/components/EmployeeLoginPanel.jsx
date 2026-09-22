/**
 * EmployeeLoginPanel — the admin-only "Account" card on an employee profile.
 * The ONE place a login gets created in this app: pick a role (any except
 * Admin), create. On creation the server returns a one-time temporary
 * password, surfaced in a modal for the admin to copy and hand over — it is
 * never shown again (only its hash is stored).
 *
 * Rendered only for ACCOUNT_PROVISION_ROLES by the parent, so this component
 * assumes the viewer may provision.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEmployeeLogin, resetEmployeeLoginPassword, updateEmployeeLoginRole } from '../employees.api.js';
import { EMPLOYEE_LOGIN_ROLES } from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { useCopyToClipboard } from '../../../lib/useCopyToClipboard.js';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Modal from '../../../components/ui/Modal.jsx';

export default function EmployeeLoginPanel({ employee }) {
  const toast = useToast();
  const copyToClipboard = useCopyToClipboard();
  const queryClient = useQueryClient();
  // Holds the just-created credentials for the one-time reveal modal.
  const [created, setCreated] = useState(null);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  // Holds the in-progress new role while the "Change role" modal is open —
  // separate from `role` above, which is only for the no-login-yet form.
  const [editingRole, setEditingRole] = useState(null);

  const mutation = useMutation({
    mutationFn: () => createEmployeeLogin(employee._id, { role, ...(email ? { email } : {}) }),
    onSuccess: (data) => {
      setCreated(data);
      setRole('');
      setEmail('');
      // Flip the card to "has login" — getEmployee now returns a login summary.
      queryClient.invalidateQueries({ queryKey: ['employee', employee._id] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  // Same reveal modal, reused: the reset response is just { tempPassword },
  // so `user.email` is filled in from the login already known to this card.
  const resetMutation = useMutation({
    mutationFn: () => resetEmployeeLoginPassword(employee._id),
    onSuccess: (data) => setCreated({ user: { email: employee.login.email }, ...data, reset: true }),
    onError: (error) => toast.error(apiMessage(error)),
  });

  const changeRoleMutation = useMutation({
    mutationFn: () => updateEmployeeLoginRole(employee._id, editingRole),
    onSuccess: () => {
      toast.success('Role updated. They will need to sign in again.');
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ['employee', employee._id] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const copyPassword = () => copyToClipboard(created.tempPassword, { successMessage: 'Temporary password copied.' });

  const login = employee.login;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Account</h2>
        {login ? (
          <Badge variant={login.isActive ? 'success' : 'default'}>
            {login.isActive ? 'Login active' : 'Login disabled'}
          </Badge>
        ) : (
          <Badge variant="default">No login</Badge>
        )}
      </div>

      {login ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-muted">Sign-in email: </span>
              <span className="font-medium">{login.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted">Role:</span>
              <Badge variant="primary">{login.role}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingRole(login.role)}>
              Change role
            </Button>
            <Button size="sm" variant="secondary" onClick={() => resetMutation.mutate()} isLoading={resetMutation.isPending}>
              Reset password
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted">
              This employee has no login. Pick a role and create one so they can sign in with their own credentials.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="sm:max-w-[200px]">
                <option value="">Choose a role…</option>
                {EMPLOYEE_LOGIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              {!employee.email && (
                <Input
                  label="Email"
                  type="email"
                  placeholder="No email on file — required"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:max-w-[220px]"
                />
              )}
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!role || (!employee.email && !email)}>
            Create login
          </Button>
        </div>
      )}

      {/* One-time credential reveal. `created` is cleared on close. */}
      <Modal open={!!created} onClose={() => setCreated(null)} title={created?.reset ? 'Password reset' : 'Login created'}>
        {created && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {created.reset ? (
                <>
                  Their old password no longer works. Hand this new one to{' '}
                  <span className="font-medium text-text">{employee.fullName}</span> — it&apos;s shown{' '}
                  <span className="font-medium text-text">once</span>, copy it now.
                </>
              ) : (
                <>
                  Hand these to <span className="font-medium text-text">{employee.fullName}</span>.
                  The temporary password is shown <span className="font-medium text-text">once</span> —
                  copy it now.
                </>
              )}
            </p>
            <div className="rounded-lg border border-border bg-bg p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Email</p>
              <p className="mt-0.5 font-medium">{created.user.email}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted">Temporary password</p>
              <p className="mt-0.5 select-all break-all font-mono text-base font-semibold">
                {created.tempPassword}
              </p>
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

      {/* Change role — the role picked at provisioning time (e.g. Worker vs
          Staff for an internal employee) isn't always the right one. */}
      <Modal open={editingRole !== null} onClose={() => setEditingRole(null)} title="Change role">
        {login && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Changing <span className="font-medium text-text">{employee.fullName}</span>&apos;s role signs them
              out everywhere — they&apos;ll need to log in again for the new role to take effect.
            </p>
            <Select label="Role" value={editingRole ?? ''} onChange={(e) => setEditingRole(e.target.value)}>
              {EMPLOYEE_LOGIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => changeRoleMutation.mutate()}
                isLoading={changeRoleMutation.isPending}
                disabled={!editingRole || editingRole === login.role}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
