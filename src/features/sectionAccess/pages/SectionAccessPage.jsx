/**
 * SectionAccessPage — Admin-only. The generic "who else can open this
 * section" control panel (see server/sectionAccess.model.js): each governed
 * section gets two independent grants — literal login roles, and
 * admin-named ApprovalRoles (e.g. a "Financial Manager" or "COO" role) for
 * a grant tied to a real person regardless of their login role. Admin
 * always has full access to every section; this page only controls who
 * ELSE gets in.
 *
 * ~20 sections now (started at 2) — grouped under the same
 * Workforce/Sales/Financial/Admin categories as the sidebar itself
 * (navConfig.js's NAV_GROUPS) so the page stays scannable, each collapsible
 * via native <details> (no new dependency for a one-off grouping need).
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSectionAccess, updateSectionAccess } from '../sectionAccess.api.js';
import { listApprovalRoles } from '../../approvals/approvals.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { SECTION_ACCESS_GRANTABLE_ROLES } from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { PillChecklist } from '../../../components/ui/TogglePill.jsx';

/** Mirrors navConfig.js's NAV_GROUPS membership for the same sections —
 *  a section not listed here (shouldn't happen once every key is mapped)
 *  falls into 'Other' rather than silently disappearing from the page. */
const SECTION_CATEGORY = {
  attendanceManage: 'Workforce',
  eosb: 'Workforce',
  employeeCreate: 'Workforce',
  ramadanManage: 'Workforce',
  clientsManage: 'Sales & Clients',
  deploymentsHours: 'Sales & Clients',
  deploymentsRelease: 'Sales & Clients',
  quotationsManage: 'Sales & Clients',
  mobilisationsViewer: 'Sales & Clients',
  mobilisationsSelfMobilise: 'Sales & Clients',
  subcontractorsManage: 'Sales & Clients',
  invoices: 'Financial',
  payroll: 'Financial',
  expenses: 'Financial',
  financialRequests: 'Financial',
  companySettings: 'Admin & Tools',
  documentsManage: 'Admin & Tools',
  assetsManage: 'Admin & Tools',
  team: 'Admin & Tools',
  approvalHierarchy: 'Admin & Tools',
  timesheetProcessor: 'Admin & Tools',
  nfc: 'Admin & Tools',
  auditLog: 'Admin & Tools',
};
const CATEGORY_ORDER = ['Workforce', 'Sales & Clients', 'Financial', 'Admin & Tools', 'Other'];

function groupByCategory(sections) {
  const byCategory = new Map();
  for (const section of sections) {
    const category = SECTION_CATEGORY[section.sectionKey] ?? 'Other';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(section);
  }
  return CATEGORY_ORDER.map((category) => ({ category, sections: byCategory.get(category) ?? [] })).filter(
    (g) => g.sections.length > 0
  );
}

function SectionCard({ section, approvalRoles, approvalRolesLoading }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState(section.allowedRoles ?? []);
  const [approvalRoleIds, setApprovalRoleIds] = useState((section.allowedApprovalRoles ?? []).map((r) => r._id));

  useEffect(() => {
    setRoles(section.allowedRoles ?? []);
    setApprovalRoleIds((section.allowedApprovalRoles ?? []).map((r) => r._id));
  }, [section]);

  const saveMutation = useMutation({
    mutationFn: () => updateSectionAccess(section.sectionKey, { allowedRoles: roles, allowedApprovalRoles: approvalRoleIds }),
    onSuccess: () => {
      toast.success(`${section.label} access saved.`);
      queryClient.invalidateQueries({ queryKey: ['section-access'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function toggleRole(role) {
    setRoles((list) => (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]));
  }
  function toggleApprovalRole(id) {
    setApprovalRoleIds((list) => (list.includes(id) ? list.filter((r) => r !== id) : [...list, id]));
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{section.label}</h2>
        <p className="mt-1 text-xs text-muted">{section.description}</p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium text-text">Login roles</h3>
        <PillChecklist
          items={SECTION_ACCESS_GRANTABLE_ROLES}
          selected={roles}
          onToggle={toggleRole}
          getId={(r) => r}
          getLabel={(r) => r}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium text-text">Approval roles</h3>
        <p className="mb-2 text-xs text-muted">
          Any member of these gets in too, regardless of their login role — e.g. a "Financial Manager" or "COO" role
          you've named on the Approval Hierarchy page.
        </p>
        {approvalRolesLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <PillChecklist
            items={approvalRoles ?? []}
            selected={approvalRoleIds}
            onToggle={toggleApprovalRole}
            emptyMessage="No approval roles configured yet — add one on the Approval Hierarchy page first."
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
          Save
        </Button>
      </div>
    </Card>
  );
}

export default function SectionAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sections, isPending, isError, error, refetch } = useQuery({
    queryKey: ['section-access'],
    queryFn: listSectionAccess,
  });
  const { data: approvalRoles, isPending: approvalRolesLoading } = useQuery({
    queryKey: ['approval-roles'],
    queryFn: listApprovalRoles,
  });

  if (user.role !== 'Admin') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Section Access"
        description="Admin always has full access everywhere. Choose who else can open a governed section — by login role, or by an approval role you've named (e.g. Financial Manager, COO)."
        onBack={() => navigate(-1)}
      />

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load section access settings"
          description={apiMessage(error) || 'Please try again.'}
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <div className="space-y-4">
          {groupByCategory(sections).map(({ category, sections: categorySections }) => (
            <details key={category} className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-text transition-colors hover:border-primary/40">
                <span>
                  {category} <span className="font-normal text-muted">({categorySections.length})</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="mt-4 space-y-4 pl-1">
                {categorySections.map((section) => (
                  <SectionCard
                    key={section.sectionKey}
                    section={section}
                    approvalRoles={approvalRoles}
                    approvalRolesLoading={approvalRolesLoading}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
