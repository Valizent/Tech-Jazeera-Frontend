/**
 * EmployeeApprovalsPanel — Approval Hierarchy > Employees. Everyone follows the company default for each
 * module; here an individual can be given a different hierarchy for one module (and put back). The
 * server keeps one entry per employee per module (approvals.service.js).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listEmployeeApprovals, listApprovalWorkflows, setEmployeeApprovalOverride } from '../approvals.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { EMPLOYEE_APPROVAL_TYPES, APPROVAL_REQUEST_TYPE_LABELS } from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Table from '../../../components/ui/Table.jsx';

/** The default hierarchy for a module, following the department route when the employee's department has one. */
function defaultFor(workflows, type, department) {
  const base = workflows.find((w) => w.isActive && w.appliesTo?.includes(type));
  const route = base?.departmentRoutes?.find((r) => r.department === department);
  return route?.workflow?.isActive ? route.workflow : base ?? null;
}

function EmployeeModal({ employee, workflows, canManage, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ requestType, workflow }) => setEmployeeApprovalOverride(employee._id, { requestType, workflow }),
    onSuccess: () => {
      toast.success('Approval hierarchy updated.');
      queryClient.invalidateQueries({ queryKey: ['employee-approvals'] });
    },
    onError: (error) => {
      console.error('[approvals] employee override failed', error);
      toast.error(apiMessage(error));
    },
  });
  const overrides = new Map(employee.overrides.map((o) => [o.requestType, o.workflow]));

  return (
    <Modal open onClose={onClose} title={`${employee.fullName} (${employee.employeeId})`}>
      <p className="mb-4 text-sm text-muted">
        Each module follows the company default unless you choose another hierarchy for this person.
      </p>
      <div className="space-y-4">
        {EMPLOYEE_APPROVAL_TYPES.map((type) => {
          const own = overrides.get(type);
          const fallback = defaultFor(workflows, type, employee.department);
          return (
            <Select
              key={type}
              label={APPROVAL_REQUEST_TYPE_LABELS[type]}
              value={own?._id ?? ''}
              disabled={!canManage || mutation.isPending}
              onChange={(e) => mutation.mutate({ requestType: type, workflow: e.target.value || null })}
            >
              <option value="">
                {fallback ? `Default: ${fallback.name}` : 'Default: none set (a single review step)'}
              </option>
              {workflows
                .filter((w) => w.isActive || w._id === own?._id)
                .map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                    {w.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
            </Select>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

export default function EmployeeApprovalsPanel() {
  const { user } = useAuth();
  const canManage = Boolean(user.sectionAccessWrite?.includes('approvalHierarchy'));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isPending } = useQuery({
    queryKey: ['employee-approvals', { search, page }],
    queryFn: () => listEmployeeApprovals({ search: search || undefined, page, limit: 25 }),
    placeholderData: (previous) => previous,
  });
  const { data: workflows } = useQuery({ queryKey: ['approval-workflows'], queryFn: listApprovalWorkflows });
  const items = data?.items ?? [];
  const selected = items.find((e) => e._id === selectedId) ?? null;

  const columns = [
    { key: 'fullName', header: 'Employee', render: (e) => `${e.fullName} (${e.employeeId})` },
    { key: 'department', header: 'Department', render: (e) => e.department ?? '-' },
    {
      key: 'overrides',
      header: 'Approval hierarchy',
      render: (e) =>
        e.overrides.length === 0 ? (
          <Badge>Default for everything</Badge>
        ) : (
          <span className="flex flex-wrap gap-1">
            {e.overrides.map((o) => (
              <Badge key={o.requestType} variant="primary">
                {APPROVAL_REQUEST_TYPE_LABELS[o.requestType]}: {o.workflow.name}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (e) => (
        <Button icon="eye" size="sm" variant="soft" onClick={() => setSelectedId(e._id)}>
          {canManage ? 'Change' : 'View'}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Employees Approval Hierarchy</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Everyone follows the company default hierarchy for each module. Give an employee a different one for a single
        module if needed.
      </p>
      <Input
        className="mb-4 max-w-sm"
        placeholder="Search by name or employee ID"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Table columns={columns} rows={items} loading={isPending} rowKey={(e) => e._id} emptyState={<p className="p-6 text-center text-sm text-muted">No employees found.</p>} />
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted">
            Page {data.page} of {data.pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      {selected && workflows && (
        <EmployeeModal employee={selected} workflows={workflows} canManage={canManage} onClose={() => setSelectedId(null)} />
      )}
    </Card>
  );
}
