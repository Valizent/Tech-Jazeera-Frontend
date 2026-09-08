/**
 * Employee profile — the full record in read view: personal + employment
 * details, all five documents with expiry badges, assignment (managed by
 * deployments from M6), emergency contact, notes. Edit/Delete role-gated.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEmployee, deleteEmployee } from '../employees.api.js';
import { listAssetsByEmployee } from '../../assets/assets.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import {
  EMPLOYEE_WRITE_ROLES,
  EMPLOYEE_DELETE_ROLES,
  ACCOUNT_PROVISION_ROLES,
} from '../../../lib/constants.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import ExpiryBadge from '../../../components/shared/ExpiryBadge.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import WorkerDeploymentPanel from '../../deployments/components/WorkerDeploymentPanel.jsx';
import DocumentsPanel from '../../documents/components/DocumentsPanel.jsx';
import EmployeeLoginPanel from '../components/EmployeeLoginPanel.jsx';

const STATUS_VARIANT = { Active: 'success', 'On Leave': 'warning', Exited: 'default' };

const DOCUMENTS = [
  ['passport', 'Passport'],
  ['visa', 'Visa'],
  ['iqama', 'Iqama'],
  ['medical', 'Medical'],
  ['drivingLicense', 'Driving License'],
];

/** One label/value line in a detail card. */
function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

/** Read-only summary of assigned assets — full assign/return actions live
 *  on the dedicated Assets page (P3-D); this is a discoverability panel. */
function AssignedAssetsPanel({ employeeId }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['assets', 'by-employee', employeeId],
    queryFn: () => listAssetsByEmployee(employeeId),
  });
  const current = (data ?? []).filter((a) => a.status === 'Active');
  if (data && data.length === 0) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.profile.assignedAssets')}</h2>
        <Link to="/assets" className="text-xs font-medium text-primary hover:underline">
          {t('staffEmployees.profile.manageAssets')}
        </Link>
      </div>
      {!data ? (
        <p className="text-sm text-muted">{t('staffEmployees.profile.loading')}</p>
      ) : current.length === 0 ? (
        <p className="text-sm text-muted">{t('staffEmployees.profile.nothingAssigned')}</p>
      ) : (
        <div className="divide-y divide-border">
          {current.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>{a.assetName}</span>
              <span className="text-xs text-muted">{a.assetTag}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canWrite = EMPLOYEE_WRITE_ROLES.includes(user.role);
  const canDelete = EMPLOYEE_DELETE_ROLES.includes(user.role);
  const canProvisionAccount = ACCOUNT_PROVISION_ROLES.includes(user.role);
  const canComputeEosb = Boolean(user.sectionAccessWrite?.includes('eosb'));

  const { data: employee, isPending, isError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployee(id),
    onSuccess: () => {
      toast.success(t('common.deletedSuccess', { name: employee.fullName }));
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/employees', { replace: true });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffEmployees.editPage.notFound')}
        description={t('staffEmployees.editPage.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/employees')} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeId} · ${employee.designation}`}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant="default" className="mr-1">
              {t(`common.employeeType.${employee.type}`, employee.type)}
            </Badge>
            <Badge variant={STATUS_VARIANT[employee.status]} className="mr-1">
              {t(`common.status.${employee.status}`, employee.status)}
            </Badge>
            {canComputeEosb && (
              <Button variant="secondary" onClick={() => navigate(`/eosb/new?employee=${id}`)}>
                {t('staffEmployees.profile.calculateEosb')}
              </Button>
            )}
            {canWrite && (
              <Button variant="secondary" onClick={() => navigate(`/employees/${id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.profile.overview')}</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('staffEmployees.profile.fields.nationality')}>{employee.nationality}</Field>
            <Field label={t('staffEmployees.profile.fields.mobile')}>{employee.mobile}</Field>
            <Field label={t('staffEmployees.profile.fields.email')}>{employee.email}</Field>
            <Field label={t('staffEmployees.profile.fields.joiningDate')}>{formatDate(employee.joiningDate)}</Field>
            <Field label={t('staffEmployees.profile.fields.department')}>{employee.department}</Field>
            <Field label={t('staffEmployees.profile.fields.salary')}>{employee.salary != null ? `SAR ${employee.salary.toLocaleString()}` : null}</Field>
            <Field label={t('staffEmployees.profile.fields.accommodation')}>{employee.accommodation}</Field>
            <Field label={t('staffEmployees.profile.fields.coordinator')}>{employee.coordinator?.name}</Field>
            <Field label={t('staffEmployees.profile.fields.manager')}>{employee.manager?.name}</Field>
            <Field label={t('staffEmployees.profile.fields.addedBy')}>
              {employee.createdBy?.name && (
                <>
                  {employee.createdBy.name}
                  {employee.createdBy.role === 'Coordinator' && (
                    <Badge variant="primary" className="ml-1.5">
                      {t('staffEmployees.list.coordinator')}
                    </Badge>
                  )}
                </>
              )}
            </Field>
          </dl>
        </Card>

        {/* Login (any role) — Admin/HR only. Create/inspect this
            employee's account. Own-type only (Milestone 4): the ESS portal
            no longer accepts an Outsourced/Subcontracted login at all, so
            provisioning one is never offered from here in the first place. */}
        {canProvisionAccount && employee.type === 'Own' && <EmployeeLoginPanel employee={employee} />}

        {/* Current deployment, actions (transfer/end/assign) and history —
            owns its own data; populates from the M6 deployment workflow.
            Workforce types only (Outsourced or Subcontracted) — an internal
            Own-type employee is never deployed. */}
        {employee.type !== 'Own' && <WorkerDeploymentPanel employee={employee} />}

        <AssignedAssetsPanel employeeId={id} />

        <Card>
          {/* Identity metadata (numbers + expiry) — distinct from uploaded
              files, which live in the Documents panel below. */}
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('staffEmployees.profile.identityDocuments')}
          </h2>
          <div className="divide-y divide-border">
            {DOCUMENTS.map(([key]) => {
              const doc = employee[key];
              const label = t(`staffEmployees.form.documents.${key}`);
              return (
                <div key={key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted">
                      {doc?.number || t('staffEmployees.profile.noNumber')} ·{' '}
                      {t('staffEmployees.profile.expires', { date: formatDate(doc?.expiry) })}
                    </p>
                  </div>
                  <ExpiryBadge date={doc?.expiry} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Uploaded files (scans, contracts, certificates) via the M8 center. */}
        <DocumentsPanel ownerType="Employee" ownerId={employee._id} ownerName={employee.fullName} />

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('staffEmployees.profile.emergencyContact')}
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t('staffEmployees.profile.fields.name')}>{employee.emergencyContact?.name}</Field>
            <Field label={t('staffEmployees.profile.fields.phone')}>{employee.emergencyContact?.phone}</Field>
            <Field label={t('staffEmployees.profile.fields.relation')}>{employee.emergencyContact?.relation}</Field>
          </dl>
        </Card>

        {employee.notes && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.profile.notes')}</h2>
            <p className="whitespace-pre-wrap text-sm">{employee.notes}</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffEmployees.list.deleteTitle')}
        message={t('staffEmployees.list.deleteMessage', { name: employee.fullName, code: employee.employeeId })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
