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
 * ~25 sections now (started at 2) — drilled down through the SAME structure
 * the real sidebar uses (see sectionAccessModules.js's MODULE_GROUPS, built
 * from navConfig.js's NAV_GROUPS): a category grid (Workforce/Sales &
 * Clients/Financial/Admin & Tools) → that category's module grid, in the
 * exact order/naming the real hub pages already show (Employees, Attendance,
 * Leave, ...) → the module's own Read/Write editor(s). Added 2026-09-13 per
 * the user's own ask, after the flat "~20 cards under a few `<details>`"
 * layout this replaced grew too long to scan at a glance — most modules own
 * exactly one section key; a couple (Deployments, Mobilisations) own several
 * distinct permissions that appear as separate cards once you drill into
 * that one module.
 *
 * State lives HERE, not per-card (added 2026-09-13, the user's own ask for
 * a "save all changes" option): every card's Read/Write selection is one
 * entry in `localValues`, keyed by sectionKey. A card is "dirty" when its
 * local entry differs from the section's own fresh server data — that's
 * the only thing driving both an individual card's Save button and the
 * page-level "Save all changes" button (which stays available at every
 * drill-down level, since it counts ALL unsaved sections, not just the ones
 * currently in view), so the two can never disagree about what's actually
 * unsaved. `localValues` is lazily seeded from server data per key (see the
 * effect below) and never force-reset wholesale — saving one card (or
 * several, via Save All) refetches the section-access query, which
 * naturally makes that card's local value match the server again (and so no
 * longer dirty) WITHOUT touching any other card's still-unsaved edits
 * sitting in the same state object.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSectionAccess, updateSectionAccess } from '../sectionAccess.api.js';
import { listApprovalRoles } from '../../approvals/approvals.api.js';
import { MODULE_GROUPS } from '../sectionAccessModules.js';
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
import Icon from '../../../components/ui/Icon.jsx';

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
function TierChecklist({ title, hint, approvalRoleIds, onToggleApprovalRole, approvalRoles, approvalRolesLoading, approvalRolesError }) {
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
          emptyMessage={
            approvalRolesError
              ? "Couldn't load approval roles — try refreshing the page."
              : 'No approval roles configured yet — add one on the Approval Hierarchy page first.'
          }
        />
      )}
    </div>
  );
}

function SectionCard({ section, local, dirty, onToggleRead, onToggleWrite, onSave, saving, approvalRoles, approvalRolesLoading, approvalRolesError }) {
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
        hint="If granted, users in this role can view the data inside this module. If not granted, the module remains completely hidden and inaccessible to them. (Note: Anyone granted Write access below can automatically read too)."
        approvalRoleIds={local.readApprovalRoles}
        onToggleApprovalRole={onToggleRead}
        approvalRoles={approvalRoles}
        approvalRolesLoading={approvalRolesLoading}
        approvalRolesError={approvalRolesError}
      />
      <TierChecklist
        title="Write"
        hint="If granted, users can actively make changes (like creating, editing, approving, or deleting records). If not granted, they cannot make any changes."
        approvalRoleIds={local.writeApprovalRoles}
        onToggleApprovalRole={onToggleWrite}
        approvalRoles={approvalRoles}
        approvalRolesLoading={approvalRolesLoading}
        approvalRolesError={approvalRolesError}
      />

      <div className="flex justify-end">
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} onClick={onSave} isLoading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </Card>
  );
}

/** One clickable tile in the category/module grid (level 1 and 2) —
 *  deliberately not a <Card>: square-ish and icon-first so 3-4 fit per row,
 *  unlike the single-column Read/Write editor cards shown at level 3. A
 *  small warning-colored badge surfaces unsaved edits sitting inside this
 *  tile (a category or a module can hide dirty sections you're not
 *  currently looking at, since Save state is global — see this file's own
 *  top doc comment). */
function GridTile({ icon, label, hint, dirtyCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-5 text-center shadow-sm transition-all duration-200 ease-out-expo hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon d={icon} size="md" />
        {dirtyCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
            {dirtyCount}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-text group-hover:text-primary">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </button>
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
  const { data: approvalRoles, isPending: approvalRolesLoading, isError: approvalRolesError } = useQuery({
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

  // Drill-down position: null/null = the category grid; a groupKey with no
  // module index = that category's module grid; both set = one module's own
  // Read/Write editor(s). Kept as plain component state, not a route, since
  // this is a three-level zoom into one page, not three separate pages.
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(null);
  const activeGroup = activeGroupKey ? MODULE_GROUPS.find((g) => g.key === activeGroupKey) : null;
  const activeModule = activeGroup && activeModuleIndex != null ? activeGroup.modules[activeModuleIndex] : null;
  const openGroup = (key) => {
    setActiveGroupKey(key);
    setActiveModuleIndex(null);
  };
  const closeGroup = () => {
    setActiveGroupKey(null);
    setActiveModuleIndex(null);
  };
  const closeModule = () => setActiveModuleIndex(null);

  const sectionFor = (key) => sections?.find((s) => s.sectionKey === key);
  const moduleDirtyCount = (module) =>
    module.sectionKeys.filter((key) => {
      const section = sectionFor(key);
      return section && isDirty(section, localValues[key]);
    }).length;
  const groupDirtyCount = (group) => group.modules.reduce((sum, m) => sum + moduleDirtyCount(m), 0);

  if (user.role !== 'Admin') return <Navigate to="/" replace />;

  const headerTitle = activeModule ? activeModule.label : activeGroup ? activeGroup.label : 'Section Access';
  const headerDescription = activeModule
    ? activeModule.description
    : activeGroup
      ? 'Choose a module below to control who can read or write its data — click one to see its Read/Write editor.'
      : "Section Access is your security control center. It lets you strictly govern who can see or change sensitive data across the system. It exists to ensure privacy and prevent unauthorized edits. Admins always have full access. Pick a category below, then choose a module to grant Read or Write permissions to your custom Approval Roles.";
  const handleBack = activeModule ? closeModule : activeGroup ? closeGroup : () => navigate(-1);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        onBack={handleBack}
        actions={
          dirtySections.length > 0 && (
            <Button size="sm" onClick={saveAll} isLoading={savingAll}>
              Save all changes ({dirtySections.length})
            </Button>
          )
        }
      />

      {activeGroup && (
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <button type="button" onClick={closeGroup} className="hover:text-primary hover:underline">
            Section Access
          </button>
          <span>/</span>
          {activeModule ? (
            <>
              <button type="button" onClick={closeModule} className="hover:text-primary hover:underline">
                {activeGroup.label}
              </button>
              <span>/</span>
              <span className="text-text">{activeModule.label}</span>
            </>
          ) : (
            <span className="text-text">{activeGroup.label}</span>
          )}
        </nav>
      )}

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
      ) : !activeGroup ? (
        // Level 1 — categories, same four as the sidebar's own groups.
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MODULE_GROUPS.map((group) => (
            <GridTile
              key={group.key}
              icon={group.icon}
              label={group.label}
              hint={`${group.modules.length} module${group.modules.length === 1 ? '' : 's'}`}
              dirtyCount={groupDirtyCount(group)}
              onClick={() => openGroup(group.key)}
            />
          ))}
        </div>
      ) : !activeModule ? (
        // Level 2 — this category's modules, in the exact order/naming its
        // real hub page already uses.
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activeGroup.modules.map((module, index) => (
            <GridTile
              key={module.label}
              icon={module.icon}
              label={module.label}
              hint={module.sectionKeys.length > 1 ? `${module.sectionKeys.length} permissions` : null}
              dirtyCount={moduleDirtyCount(module)}
              onClick={() => setActiveModuleIndex(index)}
            />
          ))}
        </div>
      ) : (
        // Level 3 — the module's own Read/Write editor(s). Most modules own
        // exactly one section key; a few (e.g. Deployments) own several,
        // each its own card.
        <div className="space-y-4">
          {activeModule.sectionKeys.map((key) => {
            const section = sectionFor(key);
            const local = localValues[key];
            if (!section || !local) return null; // not yet seeded (first render tick)
            return (
              <SectionCard
                key={key}
                section={section}
                local={local}
                dirty={isDirty(section, local)}
                onToggleRead={toggleIn(key, 'readApprovalRoles')}
                onToggleWrite={toggleIn(key, 'writeApprovalRoles')}
                onSave={() => {
                  setSavingKey(key);
                  saveMutation.mutate(key);
                }}
                saving={savingKey === key && saveMutation.isPending}
                approvalRoles={approvalRoles}
                approvalRolesLoading={approvalRolesLoading}
                approvalRolesError={approvalRolesError}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
