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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listSectionAccess, updateSectionAccess } from '../sectionAccess.api.js';
import { listApprovalRoles } from '../../approvals/approvals.api.js';
import { MODULE_GROUPS } from '../sectionAccessModules.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, cn } from '../../../lib/utils.js';
import { SELF_SERVICE_GRANTABLE_KEYS } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Switch from '../../../components/ui/Switch.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import InfoTip from '../../../components/ui/InfoTip.jsx';

const idsFromServer = (section) => ({
  readApprovalRoles: (section.readApprovalRoles ?? []).map((r) => r._id),
  writeApprovalRoles: (section.writeApprovalRoles ?? []).map((r) => r._id),
  readAllStaff: Boolean(section.readAllStaff),
  writeAllStaff: Boolean(section.writeAllStaff),
  allStaffExceptRoles: (section.allStaffExceptRoles ?? []).map((r) => r._id),
});

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

const isDirty = (section, local) =>
  Boolean(local) &&
  (!sameIds(local.readApprovalRoles, section.readApprovalRoles.map((r) => r._id)) ||
    !sameIds(local.writeApprovalRoles, section.writeApprovalRoles.map((r) => r._id)) ||
    local.readAllStaff !== Boolean(section.readAllStaff) ||
    local.writeAllStaff !== Boolean(section.writeAllStaff) ||
    !sameIds(local.allStaffExceptRoles ?? [], (section.allStaffExceptRoles ?? []).map((r) => r._id)));

const ALL_STAFF_HINT =
  'Everyone with an office login (Admin, Manager, HR, Accounts, Coordinator, Executive, Office Secretary). Not Worker or Staff logins.';
const SEE_HINT =
  'If on, people in this role see this module in their menu and can open it. If off, it stays hidden and closed to them. Switching "Can change" on switches this on too.';
const CHANGE_HINT =
  'If on, they can make changes: create, edit or approve records. Deleting a record is Admin only. If off, they can look but not change anything.';
const ONLY_SEE_HINT = 'Only the roles switched on here (and Admin) have this. Everyone else never receives it.';
const ONLY_CHANGE_HINT = 'Only the roles switched on here (and Admin) can do this. Everyone else cannot.';
const EXCEPT_HINT =
  'Roles switched on here are left out of "All office staff" above. A person who is also switched on for a role on this card keeps that access.';

/** Roles down the side, one on/off switch per column. Used for Can see / Can
 *  change on every card and for the "left out" list under All office staff. */
function SwitchTable({ columns, rows, loading, emptyMessage }) {
  if (loading) return <Skeleton className="h-10 w-full" />;
  if (rows.length === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  const grid = { gridTemplateColumns: `minmax(0,1fr) ${columns.map(() => '7.5rem').join(' ')}` };
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="grid items-center gap-x-3 bg-border/20 px-3 py-2 text-xs font-semibold text-muted" style={grid}>
        <span>Role</span>
        {columns.map((column) => (
          <span key={column.key} className="flex items-center justify-center gap-1">
            {column.title}
            <InfoTip text={column.hint} />
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn('grid items-center gap-x-3 border-t border-border/60 px-3 py-2', row.highlight && 'bg-primary/5')}
          style={grid}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text">
            <span className="truncate">{row.label}</span>
            <InfoTip text={row.hint} />
          </span>
          {columns.map((column) => (
            <span key={column.key} className="flex justify-center">
              <Switch
                checked={Boolean(row.values[column.key])}
                onChange={(on) => row.onChange(column.key, on)}
                label={`${row.label}: ${column.title}`}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section, local, dirty, onRole, onAllStaff, onToggleExcept, onSave, saving, approvalRoles: allRoles, approvalRolesLoading, approvalRolesError }) {
  // The reserved Worker/Staff roles can only be granted the safe list — elsewhere they are not offered.
  const safeForSelfService = SELF_SERVICE_GRANTABLE_KEYS.includes(section.sectionKey);
  const approvalRoles = (allRoles ?? []).filter((r) => !r.allowsSelfService || safeForSelfService);
  // A single yes/no permission shows one switch ("Who can do this"), not See and Change.
  const only = section.onlyTier;
  const columns =
    only === 'read'
      ? [{ key: 'see', title: 'Who can do this', hint: ONLY_SEE_HINT }]
      : only === 'write'
        ? [{ key: 'change', title: 'Who can do this', hint: ONLY_CHANGE_HINT }]
        : [
            { key: 'see', title: 'Can see', hint: SEE_HINT },
            { key: 'change', title: 'Can change', hint: CHANGE_HINT },
          ];
  const sees = (id) => local.readApprovalRoles.includes(id) || local.writeApprovalRoles.includes(id);
  const changes = (id) => local.writeApprovalRoles.includes(id);
  const rows = [
    {
      key: 'all-office-staff',
      label: 'All office staff',
      hint: ALL_STAFF_HINT,
      highlight: true,
      values: { see: local.readAllStaff || local.writeAllStaff, change: local.writeAllStaff },
      onChange: onAllStaff,
    },
    ...approvalRoles.map((role) => ({
      key: role._id,
      label: role.name,
      values: { see: sees(role._id), change: changes(role._id) },
      onChange: (column, on) => onRole(role._id, column, on),
    })),
  ];
  const exceptRows = approvalRoles.map((role) => ({
    key: role._id,
    label: role.name,
    values: { out: (local.allStaffExceptRoles ?? []).includes(role._id) },
    onChange: () => onToggleExcept(role._id),
  }));
  const emptyMessage = approvalRolesError
    ? "Couldn't load approval roles try refreshing the page."
    : 'No approval roles configured yet add one on the Approval Hierarchy page first.';

  return (
    <Card className={cn('space-y-4', dirty && 'ring-2 ring-primary/50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{section.label}</h2>
          <InfoTip text={section.description} />
        </div>
        {dirty && <Badge variant="warning">Unsaved</Badge>}
      </div>

      <SwitchTable columns={columns} rows={rows} loading={approvalRolesLoading} emptyMessage={emptyMessage} />

      {(local.readAllStaff || local.writeAllStaff) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text">Except these roles</h3>
            <InfoTip text={EXCEPT_HINT} />
          </div>
          <SwitchTable
            columns={[{ key: 'out', title: 'Left out', hint: EXCEPT_HINT }]}
            rows={exceptRows}
            loading={approvalRolesLoading}
            emptyMessage="No approval roles configured yet."
          />
        </div>
      )}

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
        <p className="text-sm font-semibold capitalize text-text group-hover:text-primary">{label}</p>
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

  // Fixed 2026-09-29, a real audit finding: a single shared `savingKey`
  // string (plus one shared `useMutation`) meant clicking Save on card A
  // then card B before A resolved cleared A's own "in flight" flag (only
  // the LATEST key was ever tracked) — A's button re-enabled mid-save and a
  // third click re-fired the same PATCH concurrently; separately, nothing
  // stopped clicking a card's own Save immediately followed by "Save all
  // changes" (which still counted that card as dirty), sending two
  // concurrent PATCHes for the same section. A `Set` of keys currently
  // saving — shared between the per-card save and the batch save below —
  // fixes both: each card's button disables independently, and either path
  // skips a key the other is already saving.
  const [savingKeys, setSavingKeys] = useState(() => new Set());

  async function saveSection(sectionKey) {
    if (savingKeys.has(sectionKey)) return;
    setSavingKeys((prev) => new Set(prev).add(sectionKey));
    try {
      await updateSectionAccess(sectionKey, localValues[sectionKey]);
      const label = sections.find((s) => s.sectionKey === sectionKey)?.label ?? sectionKey;
      toast.success(`${label} access saved.`);
      queryClient.invalidateQueries({ queryKey: ['section-access'] });
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(sectionKey);
        return next;
      });
    }
  }

  const [savingAll, setSavingAll] = useState(false);
  const dirtySections = useMemo(
    () => (sections ?? []).filter((s) => isDirty(s, localValues[s.sectionKey])),
    [sections, localValues]
  );

  async function saveAll() {
    // Skip anything already mid-save via the per-card button — same
    // mutual-exclusion `savingKeys` gives saveSection above.
    const keys = dirtySections.map((s) => s.sectionKey).filter((key) => !savingKeys.has(key));
    if (keys.length === 0) return;
    setSavingAll(true);
    setSavingKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      return next;
    });
    const results = await Promise.allSettled(keys.map((key) => updateSectionAccess(key, localValues[key])));
    setSavingAll(false);
    setSavingKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.delete(key));
      return next;
    });
    // Fixed 2026-09-29, a real audit finding: a failed batch used to report
    // only the FIRST rejected section's error message, with no way to tell
    // which section(s) failed short of checking every card's own "Unsaved"
    // badge by hand — now names every failed section by label.
    const failures = results
      .map((r, i) => (r.status === 'rejected' ? { key: keys[i], reason: r.reason } : null))
      .filter(Boolean);
    if (failures.length === 0) {
      toast.success(`${results.length} section${results.length === 1 ? '' : 's'} saved.`);
    } else {
      const names = failures.map((f) => sections.find((s) => s.sectionKey === f.key)?.label ?? f.key).join(', ');
      toast.error(
        `${results.length - failures.length} saved, ${failures.length} failed (${names}) ${apiMessage(failures[0].reason)}`
      );
    }
    queryClient.invalidateQueries({ queryKey: ['section-access'] });
  }

  // The Can see / Can change switches. Write always includes Read, so Can change on
  // also means Can see; Can see off removes both. A card that has only one tier
  // (`only`) flips just that list.
  const setRoleAccess = (sectionKey, only) => (roleId, column, on) =>
    setLocalValues((prev) => {
      const current = prev[sectionKey];
      let read = current.readApprovalRoles.filter((id) => id !== roleId);
      let write = current.writeApprovalRoles.filter((id) => id !== roleId);
      if (column === 'change' && on) write = [...write, roleId];
      else if (column === 'change' && only !== 'write') read = [...read, roleId]; // switched off: still sees it
      else if (column === 'see' && on) read = [...read, roleId];
      return { ...prev, [sectionKey]: { ...current, readApprovalRoles: read, writeApprovalRoles: write } };
    });

  // The same two switches for the "All office staff" row.
  const setAllStaffAccess = (sectionKey, only) => (column, on) =>
    setLocalValues((prev) => {
      const current = prev[sectionKey];
      let readAllStaff = false;
      let writeAllStaff = false;
      if (column === 'change' && on) writeAllStaff = true;
      else if (column === 'change' && only !== 'write') readAllStaff = true;
      else if (column === 'see' && on) readAllStaff = true;
      return { ...prev, [sectionKey]: { ...current, readAllStaff, writeAllStaff } };
    });

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
      ? 'Choose a module below, then switch on what each role can see or change in it.'
      : "Section Access is your security control center. It lets you strictly govern who can see or change sensitive data across the system. It exists to ensure privacy and prevent unauthorized edits. Admins always have full access. Pick a category below, then choose a module and switch on what each of your Approval Roles can see or change.";
  const handleBack = activeModule ? closeModule : activeGroup ? closeGroup : () => navigate(-1);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
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
                onRole={setRoleAccess(key, section.onlyTier)}
                onAllStaff={setAllStaffAccess(key, section.onlyTier)}
                onToggleExcept={toggleIn(key, 'allStaffExceptRoles')}
                onSave={() => saveSection(key)}
                saving={savingKeys.has(key)}
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
