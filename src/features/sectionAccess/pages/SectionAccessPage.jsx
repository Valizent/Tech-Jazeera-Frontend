/**
 * SectionAccessPage — Admin-only. The generic "who else can open this
 * section" control panel (see server/sectionAccess.model.js): each governed
 * section has two independent TIERS (Read, Write — Write always includes
 * Read), each granted only by admin-named ApprovalRoles (e.g. a "Financial
 * Manager" or "COO" role) — a grant tied to a real person regardless of
 * their login role. Admin always has full access to every section; this
 * page only controls who ELSE gets in. Login-role grants were removed
 * app-wide per the user's own instruction — see docs/SECTION-ACCESS-notes.md's
 * 2026-09-13 follow-up.
 *
 * ~20 sections now (started at 2) — grouped under the same
 * Workforce/Sales/Financial/Admin categories as the sidebar itself
 * (navConfig.js's NAV_GROUPS) so the page stays scannable, each collapsible
 * via native <details> (no new dependency for a one-off grouping need).
 *
 * State lives HERE, not per-card (added 2026-09-13, the user's own ask for
 * a "save all changes" option): every card's Read/Write selection is one
 * entry in `localValues`, keyed by sectionKey. A card is "dirty" when its
 * local entry differs from the section's own fresh server data — that's
 * the only thing driving both an individual card's Save button and the
 * page-level "Save all changes" button, so the two can never disagree about
 * what's actually unsaved. `localValues` is lazily seeded from server data
 * per key (see the effect below) and never force-reset wholesale — saving
 * one card (or several, via Save All) refetches the section-access query,
 * which naturally makes that card's local value match the server again
 * (and so no longer dirty) WITHOUT touching any other card's still-unsaved
 * edits sitting in the same state object.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSectionAccess, updateSectionAccess } from '../sectionAccess.api.js';
import { listApprovalRoles } from '../../approvals/approvals.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, cn } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Badge from '../../../components/ui/Badge.jsx';
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
  deploymentsHoursDecide: 'Sales & Clients',
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

const idsFromServer = (section) => ({
  readApprovalRoles: (section.readApprovalRoles ?? []).map((r) => r._id),
  writeApprovalRoles: (section.writeApprovalRoles ?? []).map((r) => r._id),
});

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

const isDirty = (section, local) =>
  Boolean(local) &&
  (!sameIds(local.readApprovalRoles, section.readApprovalRoles.map((r) => r._id)) ||
    !sameIds(local.writeApprovalRoles, section.writeApprovalRoles.map((r) => r._id)));

/** One tier's approval-role checklist, reused for both Read and Write below. */
function TierChecklist({ title, hint, approvalRoleIds, onToggleApprovalRole, approvalRoles, approvalRolesLoading }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {approvalRolesLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <PillChecklist
          items={approvalRoles ?? []}
          selected={approvalRoleIds}
          onToggle={onToggleApprovalRole}
          emptyMessage="No approval roles configured yet — add one on the Approval Hierarchy page first."
        />
      )}
    </div>
  );
}

function SectionCard({ section, local, dirty, onToggleRead, onToggleWrite, onSave, saving, approvalRoles, approvalRolesLoading }) {
  return (
    <Card className={cn('space-y-4', dirty && 'ring-2 ring-primary/50')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{section.label}</h2>
          <p className="mt-1 text-xs text-muted">{section.description}</p>
        </div>
        {dirty && <Badge variant="warning">Unsaved</Badge>}
      </div>

      <TierChecklist
        title="Read"
        hint="Can view this section. Anyone granted Write below can already read too — no need to add them here as well."
        approvalRoleIds={local.readApprovalRoles}
        onToggleApprovalRole={onToggleRead}
        approvalRoles={approvalRoles}
        approvalRolesLoading={approvalRolesLoading}
      />
      <TierChecklist
        title="Write"
        hint="Can create/edit/decide/delete (whatever this section's write action is) — and view it too."
        approvalRoleIds={local.writeApprovalRoles}
        onToggleApprovalRole={onToggleWrite}
        approvalRoles={approvalRoles}
        approvalRolesLoading={approvalRolesLoading}
      />

      <div className="flex justify-end">
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} onClick={onSave} isLoading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </Card>
  );
}

export default function SectionAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: sections, isPending, isError, error, refetch } = useQuery({
    queryKey: ['section-access'],
    queryFn: listSectionAccess,
  });
  const { data: approvalRoles, isPending: approvalRolesLoading } = useQuery({
    queryKey: ['approval-roles'],
    queryFn: listApprovalRoles,
  });

  // { [sectionKey]: { readApprovalRoles: [id], writeApprovalRoles: [id] } } —
  // seeded lazily per key from fresh server data, never wholesale-reset (see
  // this file's own top doc comment on why).
  const [localValues, setLocalValues] = useState({});
  useEffect(() => {
    if (!sections) return;
    setLocalValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of sections) {
        if (!(section.sectionKey in next)) {
          next[section.sectionKey] = idsFromServer(section);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sections]);

  const [savingKey, setSavingKey] = useState(null); // single-card save in flight
  const saveMutation = useMutation({
    mutationFn: (sectionKey) => updateSectionAccess(sectionKey, localValues[sectionKey]),
    onSuccess: (_data, sectionKey) => {
      const label = sections.find((s) => s.sectionKey === sectionKey)?.label ?? sectionKey;
      toast.success(`${label} access saved.`);
      queryClient.invalidateQueries({ queryKey: ['section-access'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setSavingKey(null),
  });

  const [savingAll, setSavingAll] = useState(false);
  const dirtySections = useMemo(
    () => (sections ?? []).filter((s) => isDirty(s, localValues[s.sectionKey])),
    [sections, localValues]
  );

  async function saveAll() {
    setSavingAll(true);
    const results = await Promise.allSettled(
      dirtySections.map((s) => updateSectionAccess(s.sectionKey, localValues[s.sectionKey]))
    );
    setSavingAll(false);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      toast.success(`${results.length} section${results.length === 1 ? '' : 's'} saved.`);
    } else {
      toast.error(`${results.length - failed.length} saved, ${failed.length} failed — ${apiMessage(failed[0].reason)}`);
    }
    queryClient.invalidateQueries({ queryKey: ['section-access'] });
  }

  const toggleIn = (sectionKey, tier) => (value) =>
    setLocalValues((prev) => {
      const current = prev[sectionKey]?.[tier] ?? [];
      const nextList = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [sectionKey]: { ...prev[sectionKey], [tier]: nextList } };
    });

  if (user.role !== 'Admin') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Section Access"
        description="Admin always has full access everywhere. Each section has two independent tiers — Read (can view) and Write (can create/edit/decide/delete, and always includes Read) — granted by an approval role you've named (e.g. Financial Manager, COO)."
        onBack={() => navigate(-1)}
        actions={
          dirtySections.length > 0 && (
            <Button size="sm" onClick={saveAll} isLoading={savingAll}>
              Save all changes ({dirtySections.length})
            </Button>
          )
        }
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
                {categorySections.map((section) => {
                  const local = localValues[section.sectionKey];
                  if (!local) return null; // not yet seeded (first render tick)
                  return (
                    <SectionCard
                      key={section.sectionKey}
                      section={section}
                      local={local}
                      dirty={isDirty(section, local)}
                      onToggleRead={toggleIn(section.sectionKey, 'readApprovalRoles')}
                      onToggleWrite={toggleIn(section.sectionKey, 'writeApprovalRoles')}
                      onSave={() => {
                        setSavingKey(section.sectionKey);
                        saveMutation.mutate(section.sectionKey);
                      }}
                      saving={savingKey === section.sectionKey && saveMutation.isPending}
                      approvalRoles={approvalRoles}
                      approvalRolesLoading={approvalRolesLoading}
                    />
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
