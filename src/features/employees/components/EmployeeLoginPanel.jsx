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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.success(t('staffEmployees.login.roleUpdated'));
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ['employee', employee._id] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const copyPassword = () => copyToClipboard(created.tempPassword, { successMessage: t('staffEmployees.login.passwordCopied') });

  const login = employee.login;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.login.title')}</h2>
        {login ? (
          <Badge variant={login.isActive ? 'success' : 'default'}>
            {t(login.isActive ? 'staffEmployees.login.active' : 'staffEmployees.login.disabled')}
          </Badge>
        ) : (
          <Badge variant="default">{t('staffEmployees.login.none')}</Badge>
        )}
      </div>

      {login ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-muted">{t('staffEmployees.login.signInEmail')} </span>
              <span className="font-medium">{login.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted">{t('staffEmployees.login.role')}:</span>
              <Badge variant="primary">{login.role}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingRole(login.role)}>
              {t('staffEmployees.login.changeRole')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => resetMutation.mutate()} isLoading={resetMutation.isPending}>
              {t('staffEmployees.login.resetPassword')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted">
              {t('staffEmployees.login.noneHint')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select label={t('staffEmployees.login.role')} value={role} onChange={(e) => setRole(e.target.value)} className="sm:max-w-[200px]">
                <option value="">{t('staffEmployees.login.chooseRole')}</option>
                {EMPLOYEE_LOGIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              {!employee.email && (
                <Input
                  label={t('staffEmployees.login.email')}
                  type="email"
                  placeholder={t('staffEmployees.login.emailRequired')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:max-w-[220px]"
                />
              )}
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!role || (!employee.email && !email)}>
            {t('staffEmployees.login.create')}
          </Button>
        </div>
      )}

      {/* One-time credential reveal. `created` is cleared on close. */}
      <Modal open={!!created} onClose={() => setCreated(null)} title={t(created?.reset ? 'staffEmployees.login.resetDone' : 'staffEmployees.login.created')}>
        {created && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {t(created.reset ? 'staffEmployees.login.resetHandOver' : 'staffEmployees.login.handOver', { name: employee.fullName })}
            </p>
            <div className="rounded-lg border border-border bg-bg p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{t('staffEmployees.login.email')}</p>
              <p className="mt-0.5 font-medium">{created.user.email}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted">{t('staffEmployees.login.tempPassword')}</p>
              <p className="mt-0.5 select-all break-all font-mono text-base font-semibold">
                {created.tempPassword}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={copyPassword}>
                {t('staffEmployees.login.copyPassword')}
              </Button>
              <Button onClick={() => setCreated(null)}>{t('staffEmployees.login.done')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change role the role picked at provisioning time (e.g. Worker vs
          Staff for an internal employee) isn't always the right one. */}
      <Modal open={editingRole !== null} onClose={() => setEditingRole(null)} title={t('staffEmployees.login.changeRole')}>
        {login && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {t('staffEmployees.login.changeRoleHint', { name: employee.fullName })}
            </p>
            <Select label={t('staffEmployees.login.role')} value={editingRole ?? ''} onChange={(e) => setEditingRole(e.target.value)}>
              {EMPLOYEE_LOGIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingRole(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => changeRoleMutation.mutate()}
                isLoading={changeRoleMutation.isPending}
                disabled={!editingRole || editingRole === login.role}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
