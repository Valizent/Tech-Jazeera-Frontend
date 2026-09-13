/**
 * MODULE_GROUPS — the real navigation's own categories and module names (see
 * app/navConfig.js's NAV_GROUPS), reused here so the Section Access page can
 * never drift from the sidebar's own labels/icons/order. Each module lists
 * every real Section Access `sectionKey` it owns — most own exactly one; a
 * few (Deployments, Mobilisations) own several distinct permissions that
 * were previously separate top-level cards and now show as separate cards
 * INSIDE that one module once you drill into it.
 *
 * Two modules have no nav hub tile whose `sectionKey` already points here:
 * Ramadan Periods lives inside the Attendance page, not its own sidebar
 * item, so its label/icon are given directly; Holidays DOES have its own
 * nav tile (`/holidays`) but that tile intentionally carries no
 * `sectionKey` — its Read stays open to every login including Workers, only
 * Write is governed by this mechanism (see holiday.routes.js) — so its
 * label/icon are still read off the real nav item, just not its (absent)
 * `sectionKey`.
 */
import { NAV_GROUPS } from '../../app/navConfig.js';

function navGroup(groupKey) {
  return NAV_GROUPS.find((g) => g.key === groupKey);
}

function navItem(groupKey, to) {
  const item = navGroup(groupKey).items.find((i) => i.to === to);
  return { label: item.label, labelKey: item.labelKey, description: item.description, descriptionKey: item.descriptionKey, icon: item.icon };
}

export const MODULE_GROUPS = [
  {
    key: 'workforce',
    label: navGroup('workforce').label,
    labelKey: navGroup('workforce').labelKey,
    icon: navGroup('workforce').icon,
    modules: [
      { ...navItem('workforce', '/employees'), sectionKeys: ['employeeCreate'] },
      { ...navItem('workforce', '/attendance'), sectionKeys: ['attendanceRecords', 'attendanceSignInOut', 'attendanceOfficeLocation'] },
      { ...navItem('workforce', '/leave'), sectionKeys: ['leaveRequests'] },
      { ...navItem('workforce', '/holidays'), sectionKeys: ['holidays'] },
      { ...navItem('workforce', '/timesheets'), sectionKeys: ['timesheetRequests'] },
      { ...navItem('workforce', '/eosb'), sectionKeys: ['eosb'] },
      { ...navItem('workforce', '/exit-documents'), sectionKeys: ['exitDocuments'] },
      // No nav hub tile of its own — reached from inside the Attendance page.
      {
        label: 'Ramadan Periods',
        description: 'The configurable Ramadan work-hour calendar (inside Attendance).',
        icon: navItem('workforce', '/attendance').icon,
        sectionKeys: ['ramadanManage'],
      },
    ],
  },
  {
    key: 'sales',
    label: navGroup('sales').label,
    labelKey: navGroup('sales').labelKey,
    icon: navGroup('sales').icon,
    modules: [
      { ...navItem('sales', '/clients'), sectionKeys: ['clientsManage'] },
      { ...navItem('sales', '/deployments'), sectionKeys: ['deploymentsRelease', 'deploymentsHours', 'deploymentsHoursDecide'] },
      { ...navItem('sales', '/quotations'), sectionKeys: ['quotationsManage'] },
      { ...navItem('sales', '/mobilisations'), sectionKeys: ['mobilisationsViewer', 'mobilisationsSelfMobilise'] },
      { ...navItem('sales', '/subcontractors'), sectionKeys: ['subcontractorsManage'] },
    ],
  },
  {
    key: 'financial',
    label: navGroup('financial').label,
    labelKey: navGroup('financial').labelKey,
    icon: navGroup('financial').icon,
    modules: [
      { ...navItem('financial', '/invoices'), sectionKeys: ['invoices'] },
      { ...navItem('financial', '/payroll'), sectionKeys: ['payroll'] },
      { ...navItem('financial', '/expenses'), sectionKeys: ['expenses'] },
      { ...navItem('financial', '/financial-requests'), sectionKeys: ['financialRequests'] },
    ],
  },
  {
    key: 'admin',
    label: navGroup('admin').label,
    labelKey: navGroup('admin').labelKey,
    icon: navGroup('admin').icon,
    modules: [
      { ...navItem('admin', '/company-settings'), sectionKeys: ['companySettings'] },
      { ...navItem('admin', '/documents'), sectionKeys: ['documentsManage'] },
      { ...navItem('admin', '/assets'), sectionKeys: ['assetsManage'] },
      { ...navItem('admin', '/team'), sectionKeys: ['team'] },
      { ...navItem('admin', '/approvals'), sectionKeys: ['approvalHierarchy'] },
      { ...navItem('admin', '/timesheet-processor'), sectionKeys: ['timesheetProcessor'] },
      { ...navItem('admin', '/nfc'), sectionKeys: ['nfc'] },
      { ...navItem('admin', '/security-log'), sectionKeys: ['auditLog'] },
      // Mobilisation Settings, Approval Log, and Coordinator Activity are
      // deliberately absent — none has a Section Access key of its own
      // (each is gated by a fixed login-role list instead, see navConfig.js).
    ],
  },
];
