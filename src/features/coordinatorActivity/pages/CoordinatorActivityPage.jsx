/**
 * Coordinator Activity — a single place for Admin/Manager/HR to see
 * everything every Coordinator has added themselves: employees (live
 * immediately) and clients (need approval). This is oversight, not a
 * separate write surface — every record here also already appears in the
 * normal Employees/Clients lists (with the same "Added by" column); this
 * page just answers "what have my coordinators been doing" in one screen
 * instead of hunting through both lists.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listEmployees } from '../../employees/employees.api.js';
import { listClients } from '../../clients/clients.api.js';
import { listStaffUsers } from '../../users/users.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { CLIENT_APPROVAL_VARIANT } from '../../../lib/constants.js';
import { formatDate, cn } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import DecideClientModal from '../../clients/components/DecideClientModal.jsx';
import { canDecideClient } from '../../clients/clients.permissions.js';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function CoordinatorActivityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('clients');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [deciding, setDeciding] = useState(null);

  const { data: coordinators, isError: coordinatorsError } = useQuery({
    queryKey: ['users', { role: 'Coordinator' }],
    queryFn: () => listStaffUsers({ role: 'Coordinator' }),
  });

  const { data: clientData, isPending: clientsPending } = useQuery({
    queryKey: ['clients', { createdByRole: 'Coordinator' }],
    queryFn: () => listClients({ createdByRole: 'Coordinator', limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: tab === 'clients',
  });
  const { data: employeeData, isPending: employeesPending } = useQuery({
    queryKey: ['employees', { createdByRole: 'Coordinator' }],
    queryFn: () => listEmployees({ createdByRole: 'Coordinator', limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: tab === 'employees',
  });

  const clients = useMemo(() => {
    const items = clientData?.items ?? [];
    return coordinatorId ? items.filter((c) => c.createdBy?._id === coordinatorId) : items;
  }, [clientData, coordinatorId]);
  const employees = useMemo(() => {
    const items = employeeData?.items ?? [];
    return coordinatorId ? items.filter((e) => e.createdBy?._id === coordinatorId) : items;
  }, [employeeData, coordinatorId]);

  const pendingCount = (clientData?.items ?? []).filter((c) => c.approvalStatus === 'Pending').length;

  const clientColumns = [
    {
      key: 'companyName',
      header: 'Client',
      render: (c) => (
        <Link to={`/clients/${c._id}`} className="font-medium text-text hover:text-primary">
          {c.companyName}
        </Link>
      ),
    },
    { key: 'createdBy', header: 'Added by', render: (c) => c.createdBy?.name ?? '—' },
    { key: 'createdAt', header: 'Added', render: (c) => formatDate(c.createdAt) },
    {
      key: 'approvalStatus',
      header: 'Approval',
      render: (c) => <Badge variant={CLIENT_APPROVAL_VARIANT[c.approvalStatus]}>{c.approvalStatus}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) =>
        canDecideClient(user, c) ? (
          <Button size="sm" onClick={() => setDeciding(c)}>
            Review
          </Button>
        ) : null,
    },
  ];

  const employeeColumns = [
    {
      key: 'fullName',
      header: 'Employee',
      render: (e) => (
        <Link to={`/employees/${e._id}`} className="font-medium text-text hover:text-primary">
          {e.fullName}
          <span className="block text-xs font-normal text-muted">{e.employeeId}</span>
        </Link>
      ),
    },
    { key: 'designation', header: 'Designation', render: (e) => e.designation },
    { key: 'createdBy', header: 'Added by', render: (e) => e.createdBy?.name ?? '—' },
    { key: 'createdAt', header: 'Added', render: (e) => formatDate(e.createdAt) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Coordinator Activity"
        description="Employees and clients your Coordinators have added themselves."
        onBack={() => navigate(-1)}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 border-b border-border sm:border-0">
          {[
            { key: 'clients', label: 'Clients', badge: pendingCount > 0 ? pendingCount : null },
            { key: 'employees', label: 'Employees' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
              )}
            >
              {t.label}
              {t.badge && <Badge variant="warning">{t.badge}</Badge>}
            </button>
          ))}
        </div>
        <PickerLoadWarning failed={[{ label: 'the coordinator filter list', isError: coordinatorsError }]} />
        <Select
          value={coordinatorId}
          onChange={(e) => setCoordinatorId(e.target.value)}
          className="sm:max-w-[220px]"
          aria-label="Filter by coordinator"
        >
          <option value="">All coordinators</option>
          {(coordinators ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {tab === 'clients' ? (
        <Table
          columns={clientColumns}
          rows={clients}
          rowKey={(c) => c._id}
          loading={clientsPending}
          emptyState={
            <EmptyState
              title="No clients added by coordinators yet"
              description="Clients a Coordinator submits will show up here, pending approval."
            />
          }
        />
      ) : (
        <Table
          columns={employeeColumns}
          rows={employees}
          rowKey={(e) => e._id}
          loading={employeesPending}
          emptyState={
            <EmptyState
              title="No employees added by coordinators yet"
              description="Employees a Coordinator adds to their own team will show up here."
            />
          }
        />
      )}

      <DecideClientModal client={deciding} onClose={() => setDeciding(null)} />
    </div>
  );
}
