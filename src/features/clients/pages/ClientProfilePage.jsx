/**
 * Client profile — tabbed view.
 *
 * Tabs, each backed by REAL data (no placeholder tabs):
 *   - Overview   — the client record, including its sites.
 *   - Workers    — employees currently assigned here (live query on the
 *                  employee endpoint filtered by client).
 *   - Documents  — this client's files (M8).
 *
 * Quotations/Invoices tabs (M9/P2-M6) were removed 2026-09-27 alongside
 * those modules — real accounting/billing is ERPNext's job; see
 * docs/CHANGELOG.md.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getClient, deleteClient } from '../clients.api.js';
import { listDeployments } from '../../deployments/deployments.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { CLIENT_DELETE_ROLES, CLIENT_APPROVAL_VARIANT } from '../../../lib/constants.js';
import { canDecideClient, canEditClient } from '../clients.permissions.js';
import { apiMessage, cn, formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import DecideClientModal from '../components/DecideClientModal.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ProfileField from '../../../components/ui/ProfileField.jsx';
import DocumentsPanel from '../../documents/components/DocumentsPanel.jsx';

const STATUS_VARIANT = { Active: 'success', Inactive: 'default' };

/** Overview tab — the client record. */
function OverviewTab({ client }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {client.approvalStatus === 'Rejected' && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-3">
            <Badge variant="danger">{t('common.status.Rejected')}</Badge>
            <div>
              <p className="text-sm font-medium">{t('staffClients.form.rejectedTitle')}</p>
              {client.decisionNote && <p className="mt-1 text-sm text-muted">{client.decisionNote}</p>}
              {client.decidedBy?.name && (
                <p className="mt-1 text-xs text-muted">
                  {t('staffClients.profile.rejectedBy', { name: client.decidedBy.name, date: formatDate(client.decidedAt) })}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
      {client.approvalStatus === 'Pending' && (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-center gap-3">
            <Badge variant="warning">{t('staffClients.form.pendingBadge')}</Badge>
            <p className="text-sm text-muted">{t('staffClients.form.pendingHint')}</p>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffClients.profile.companyDetails')}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField label={t('staffClients.profile.fields.contactPerson')}>{client.contactPerson}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.phone')}>{client.phone}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.email')}>{client.email}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.industry')}>{client.industry}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.vatNumber')}>{client.vatNumber}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.crNumber')}>{client.crNumber}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.address')}>{client.address}</ProfileField>
          <ProfileField label={t('staffClients.profile.fields.addedBy')}>
            {client.createdBy?.name && (
              <>
                {client.createdBy.name}
                {client.createdBy.role === 'Coordinator' && (
                  <Badge variant="primary" className="ml-1.5">
                    {t('staffClients.list.coordinatorBadge')}
                  </Badge>
                )}
              </>
            )}
          </ProfileField>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          {t('staffClients.profile.sitesTitle')} {client.sites?.length ? `(${client.sites.length})` : ''}
        </h2>
        {client.sites?.length ? (
          <div className="divide-y divide-border">
            {client.sites.map((site) => (
              <div key={site._id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{site.name}</p>
                <p className="text-xs text-muted">
                  {[site.city, site.address].filter(Boolean).join(' · ') || t('staffClients.profile.noLocationDetails')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t('staffClients.profile.noSitesRecorded')}</p>
        )}
      </Card>

      {client.notes && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffClients.profile.notes')}</h2>
          <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
        </Card>
      )}
    </div>
  );
}

/** WorkersTab: now backed by active deployments instead of an employee list, to include subcontractors */
function WorkersTab({ clientId }) {
  const { t } = useTranslation();
  const [workerType, setWorkerType] = useState('');

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', { client: clientId, status: 'Active' }],
    queryFn: () => listDeployments({ client: clientId, status: 'Active', limit: 500 }),
  });

  const rows = (data?.items ?? []).filter((d) => !workerType || d.workerType === workerType);

  const columns = [
    {
      key: 'workerName',
      header: t('staffClients.profile.workersColumns.worker', 'Worker'),
      render: (d) => (
        <Link to={d.workerType === 'Employee' ? `/employees/${d.worker?._id}` : `/deployments/${d._id}`} className="font-medium text-text hover:text-primary">
          {d.workerName}
          {d.workerType === 'Employee' && d.worker?.employeeId && (
            <span className="block text-xs font-normal text-muted">
              {d.worker.employeeId}
            </span>
          )}
        </Link>
      ),
    },
    { 
      key: 'workerType', 
      header: t('staffDeployments.list.columns.type', 'Type'), 
      render: (d) => {
        let label = d.workerType;
        if (d.workerType === 'SupplierEmployee') label = 'Subcontractor Employee';
        else if (d.workerType === 'Employee') label = 'Own Employee';
        return <Badge variant="secondary">{label}</Badge>;
      }
    },
    {
      key: 'supplierName',
      header: t('staffDeployments.list.columns.subcontractor', 'Subcontractor'),
      render: (d) => {
        if (d.workerType === 'SupplierEmployee') return d.subcontractorName || '';
        if (d.workerType === 'Freelancer') return 'Freelancer';
        return '';
      }
    },
    { key: 'designation', header: t('staffClients.profile.workersColumns.designation', 'Designation'), render: (d) => d.mobilisation?.jobTitle || '' },
    { key: 'site', header: t('staffClients.profile.workersColumns.site', 'Site'), render: (d) => d.site || '' },
  ];

  if (isError) {
    return <EmptyState title={t('staffClients.profile.couldNotLoadWorkers')} description={t('common.tryAgain')} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          value={workerType}
          onChange={(e) => setWorkerType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="Employee">Own Employee</option>
          <option value="SupplierEmployee">Subcontractor Employee</option>
          <option value="Freelancer">Freelancer</option>
        </select>
      </div>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(d) => d._id}
        loading={isPending}
        emptyState={
          <EmptyState
            title={t('staffClients.profile.noWorkersTitle')}
            description={t('staffClients.profile.noWorkersDescription')}
          />
        }
      />
    </div>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const canDelete = CLIENT_DELETE_ROLES.includes(user.role);

  const { data: client, isPending, isError } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      toast.success(t('staffClients.profile.deletedToast', { name: client.companyName }));
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients', { replace: true });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffClients.profile.notFoundTitle')}
        description={t('staffClients.profile.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/clients')} />}
      />
    );
  }

  const tabs = [
    { key: 'overview', label: t('staffClients.profile.tabs.overview') },
    { key: 'workers', label: t('staffClients.profile.tabs.workers') },
    { key: 'documents', label: t('staffClients.profile.tabs.documents') },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={client.companyName}
        description={client.industry}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant={STATUS_VARIANT[client.status]} className="mr-1">
              {t(`common.status.${client.status}`, client.status)}
            </Badge>
            {client.approvalStatus !== 'Approved' && (
              <Badge variant={CLIENT_APPROVAL_VARIANT[client.approvalStatus]} className="mr-1">
                {t(`common.status.${client.approvalStatus}`, client.approvalStatus)}
              </Badge>
            )}
            {canDecideClient(user, client) && <Button onClick={() => setDeciding(true)}>{t('staffClients.list.review')}</Button>}
            {canEditClient(user, client) && (
              <Button variant="secondary" onClick={() => navigate(`/clients/${id}/edit`)}>
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

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === tabItem.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text'
            )}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab client={client} />}
      {tab === 'workers' && <WorkersTab clientId={id} />}
      {tab === 'documents' && (
        <DocumentsPanel ownerType="Client" ownerId={id} ownerName={client.companyName} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffClients.list.deleteConfirmTitle')}
        message={t('staffClients.list.deleteConfirmMessage', { name: client.companyName })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />

      <DecideClientModal client={deciding ? client : null} onClose={() => setDeciding(false)} />
    </div>
  );
}
