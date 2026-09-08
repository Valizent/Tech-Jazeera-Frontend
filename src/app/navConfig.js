/**
 * Sidebar navigation, grouped. Single source of truth for both the sidebar
 * (DashboardLayout.jsx, which renders one link per group) and each group's
 * hub page (app/pages/*HubPage.jsx, which lists that group's real items) —
 * so a route's label/icon/role-gate is only ever defined once.
 *
 * Grouped because the flat list this replaced had grown to 22 top-level
 * items — genuinely too many for the sidebar's fixed-height column, which
 * had no scroll of its own (a real bug, not just visual clutter: items
 * past the fold were completely unreachable).
 */
import {
  COORDINATOR_ACTIVITY_VIEW_ROLES,
  FINANCIAL_REQUEST_VIEW_ROLES,
  MOBILISATION_SETTINGS_MANAGE_ROLES,
} from '../lib/constants.js';

// Inline SVG paths (24×24 outline, Heroicons-style) — an icon library isn't
// worth a dependency for this handful of glyphs (same call as the flat list
// this replaced).
const ICON = {
  dashboard:
    'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  users:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  building:
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  banknotes:
    'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.751.43.991l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.751-.43-.991l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15z',
  calendarOff:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  holidays:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5M8.25 14.25h1.5m3 0h1.5m-6 3h1.5m3 0h1.5',
  list: 'M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  eosb: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  exit: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z',
  map: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z',
  quotation:
    'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  invoice:
    'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0h.008v.008h-.008V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  expense:
    'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75V9',
  financialRequest:
    'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  document:
    'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  asset:
    'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  team: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  check:
    'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
  nfc: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  activity: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  hierarchy:
    'M3.375 19.5h6a1.125 1.125 0 001.125-1.125v-6a1.125 1.125 0 00-1.125-1.125h-6A1.125 1.125 0 002.25 12.375v6c0 .621.504 1.125 1.125 1.125zM3.375 6.75h6a1.125 1.125 0 001.125-1.125v-3a1.125 1.125 0 00-1.125-1.125h-6A1.125 1.125 0 002.25 2.625v3c0 .621.504 1.125 1.125 1.125zM13.5 19.5h6a1.125 1.125 0 001.125-1.125v-3a1.125 1.125 0 00-1.125-1.125h-6a1.125 1.125 0 00-1.125 1.125v3c0 .621.504 1.125 1.125 1.125zM13.5 6.75h6a1.125 1.125 0 001.125-1.125v-3A1.125 1.125 0 0019.5 1.5h-6a1.125 1.125 0 00-1.125 1.125v3c0 .621.504 1.125 1.125 1.125z',
};

export const DASHBOARD_ITEM = { to: '/', label: 'Dashboard', labelKey: 'staffNav.dashboard', icon: ICON.dashboard };

/**
 * The Executive (GM/COO) sidebar — deliberately NOT a filtered slice of
 * NAV_GROUPS. Every other role's nav is "opt-out": an item with no `roles`
 * array is visible to anyone who reaches DashboardLayout at all, which is
 * exactly how Manager ended up seeing nearly everything. Executive is the
 * opposite, "opt-in" shape on purpose — a short, explicit, flat list (no
 * hub pages to drill into) of the few screens they actually have: company-
 * wide visibility plus whatever they're an ApprovalRole member for. See
 * DashboardLayout.jsx's Sidebar, which renders this instead of the grouped
 * nav specifically for this role.
 */
export const EXECUTIVE_NAV_ITEMS = [
  { to: '/leave', label: 'Leave', icon: ICON.calendarOff, description: 'Requests awaiting your review.', labelKey: 'staffNav.executive.leave.label', descriptionKey: 'staffNav.executive.leave.description' },
  { to: '/timesheets', label: 'Timesheets', icon: ICON.list, description: 'Weekly hours awaiting your review.', labelKey: 'staffNav.executive.timesheets.label', descriptionKey: 'staffNav.executive.timesheets.description' },
  { to: '/financial-requests', label: 'Financial Requests', icon: ICON.financialRequest, description: 'Salary advances and reimbursements.', labelKey: 'staffNav.executive.financialRequests.label', descriptionKey: 'staffNav.executive.financialRequests.description' },
  { to: '/exit-documents', label: 'Exit & Documents', icon: ICON.exit, description: 'Re-entry visas and certificates awaiting your review.', labelKey: 'staffNav.executive.exitDocuments.label', descriptionKey: 'staffNav.executive.exitDocuments.description' },
  { to: '/approvals/log', label: 'Approval Log', icon: ICON.activity, description: 'Every request decided through a workflow, in order.', labelKey: 'staffNav.executive.approvalLog.label', descriptionKey: 'staffNav.executive.approvalLog.description' },
  // Payroll/Expenses aren't part of Executive's default circle — they show
  // up here unconditionally (same "visible, page decides" pattern as the
  // grouped nav below) purely so a COO/Financial-Manager-titled Executive an
  // Admin DID grant Section Access to has somewhere to click through to; an
  // ungranted Executive just gets that page's own explained 403.
  { to: '/payroll', sectionKey: 'payroll', label: 'Payroll', icon: ICON.banknotes, description: 'Monthly runs and payslips — if you\'ve been granted access.', labelKey: 'staffNav.executive.payroll.label', descriptionKey: 'staffNav.executive.payroll.description' },
  { to: '/expenses', sectionKey: 'expenses', label: 'Expenses', icon: ICON.expense, description: 'Company spending — if you\'ve been granted access.', labelKey: 'staffNav.executive.expenses.label', descriptionKey: 'staffNav.executive.expenses.description' },
];

/**
 * The Office Secretary sidebar — same "short, explicit, opt-in flat list"
 * shape as EXECUTIVE_NAV_ITEMS, for the same reason: this role is
 * deny-by-default (excluded from STAFF_ROLES, see rbac.js), so an unguarded
 * item from the grouped nav would otherwise be visible to it for free. Its
 * only real destination is Mobilisations — which mobilisation(s) it can
 * actually act on is governed entirely by ApprovalRole membership on that
 * record's current workflow step, not by anything here.
 */
export const OFFICE_SECRETARY_NAV_ITEMS = [
  { to: '/mobilisations', label: 'Mobilisations', icon: ICON.team, description: 'Mobilisations awaiting your review.', labelKey: 'staffNav.officeSecretary.mobilisations.label', descriptionKey: 'staffNav.officeSecretary.mobilisations.description' },
];

export const NAV_GROUPS = [
  {
    key: 'workforce',
    to: '/workforce',
    label: 'Workforce',
    labelKey: 'staffNav.workforce.label',
    icon: ICON.users,
    description: 'Employees, attendance, leave and everything tied to their employment lifecycle.',
    descriptionKey: 'staffNav.workforce.description',
    items: [
      { to: '/employees', label: 'Employees', icon: ICON.users, description: 'Records, profiles, documents.', labelKey: 'staffNav.workforce.employees.label', descriptionKey: 'staffNav.workforce.employees.description' },
      { to: '/attendance', label: 'Attendance', icon: ICON.calendar, description: 'Daily sign-in/out and records.', labelKey: 'staffNav.workforce.attendance.label', descriptionKey: 'staffNav.workforce.attendance.description' },
      { to: '/leave', label: 'Leave', icon: ICON.calendarOff, description: 'Types, requests and approvals.', labelKey: 'staffNav.workforce.leave.label', descriptionKey: 'staffNav.workforce.leave.description' },
      { to: '/holidays', label: 'Holidays', icon: ICON.holidays, description: 'The company holiday calendar.', labelKey: 'staffNav.workforce.holidays.label', descriptionKey: 'staffNav.workforce.holidays.description' },
      { to: '/timesheets', label: 'Timesheets', icon: ICON.list, description: 'Weekly hours, submitted for approval.', labelKey: 'staffNav.workforce.timesheets.label', descriptionKey: 'staffNav.workforce.timesheets.description' },
      { to: '/eosb', label: 'End of Service', icon: ICON.eosb, sectionKey: 'eosb', description: 'EOSB settlements on exit.', labelKey: 'staffNav.workforce.eosb.label', descriptionKey: 'staffNav.workforce.eosb.description' },
      // No static roles gate — matches Leave: everyone reaching this hub can
      // submit their own request, decide capability is per-row via
      // canDecideCurrentStep, and issuing stays a narrower internal check.
      { to: '/exit-documents', label: 'Exit & Documents', icon: ICON.exit, description: 'Re-entry visas, certificates.', labelKey: 'staffNav.workforce.exitDocuments.label', descriptionKey: 'staffNav.workforce.exitDocuments.description' },
    ],
  },
  {
    key: 'sales',
    to: '/sales',
    label: 'Sales & Clients',
    labelKey: 'staffNav.sales.label',
    icon: ICON.building,
    description: 'Client relationships, worker placements and quotations.',
    descriptionKey: 'staffNav.sales.description',
    items: [
      { to: '/clients', label: 'Clients', icon: ICON.building, description: 'Companies your workers are placed with.', labelKey: 'staffNav.sales.clients.label', descriptionKey: 'staffNav.sales.clients.description' },
      { to: '/deployments', label: 'Deployments', icon: ICON.map, description: 'Which worker is placed where.', labelKey: 'staffNav.sales.deployments.label', descriptionKey: 'staffNav.sales.deployments.description' },
      { to: '/quotations', label: 'Quotations', icon: ICON.quotation, description: 'Pricing sent to clients, pre-invoice.', labelKey: 'staffNav.sales.quotations.label', descriptionKey: 'staffNav.sales.quotations.description' },
      { to: '/mobilisations', label: 'Mobilisations', icon: ICON.team, description: 'Worker placements with client billing terms.', labelKey: 'staffNav.sales.mobilisations.label', descriptionKey: 'staffNav.sales.mobilisations.description' },
      { to: '/subcontractors', label: 'Subcontractors', icon: ICON.building, description: 'Companies a mobilisation is sometimes routed through.', labelKey: 'staffNav.sales.subcontractors.label', descriptionKey: 'staffNav.sales.subcontractors.description' },
    ],
  },
  {
    key: 'financial',
    to: '/financial',
    label: 'Financial',
    labelKey: 'staffNav.financial.label',
    icon: ICON.banknotes,
    description: 'Money in, money out, and payroll.',
    descriptionKey: 'staffNav.financial.description',
    items: [
      { to: '/invoices', label: 'Invoices', icon: ICON.invoice, sectionKey: 'invoices', description: 'Billed to clients, payments tracked.', labelKey: 'staffNav.financial.invoices.label', descriptionKey: 'staffNav.financial.invoices.description' },
      // No static roles gate — access is the admin-configurable Section
      // Access mechanism (see docs/SECTION-ACCESS-notes.md); visible to
      // every staff role that reaches this hub, page 403s if not granted —
      // same dynamic-eligibility pattern as Company Settings/Approval Log.
      { to: '/payroll', sectionKey: 'payroll', label: 'Payroll', icon: ICON.banknotes, description: 'Monthly runs and payslips.', labelKey: 'staffNav.financial.payroll.label', descriptionKey: 'staffNav.financial.payroll.description' },
      { to: '/expenses', sectionKey: 'expenses', label: 'Expenses', icon: ICON.expense, description: 'Company spending, internal only.', labelKey: 'staffNav.financial.expenses.label', descriptionKey: 'staffNav.financial.expenses.description' },
      { to: '/financial-requests', label: 'Financial Requests', icon: ICON.financialRequest, roles: FINANCIAL_REQUEST_VIEW_ROLES, description: 'Salary advances and reimbursements.', labelKey: 'staffNav.financial.financialRequests.label', descriptionKey: 'staffNav.financial.financialRequests.description' },
    ],
  },
  {
    key: 'admin',
    to: '/admin-tools',
    label: 'Admin & Tools',
    labelKey: 'staffNav.admin.label',
    icon: ICON.cog,
    description: 'Company-wide configuration, records and internal tools.',
    descriptionKey: 'staffNav.admin.description',
    items: [
      { to: '/company-settings', label: 'Company Settings', icon: ICON.building, description: 'Legal identity, contact, bank and signatory details — printed on every generated document.', labelKey: 'staffNav.admin.companySettings.label', descriptionKey: 'staffNav.admin.companySettings.description' },
      { to: '/section-access', label: 'Section Access', icon: ICON.cog, roles: ['Admin'], description: 'Which roles or approval roles can open Payroll, Expenses, and other governed sections.', labelKey: 'staffNav.admin.sectionAccess.label', descriptionKey: 'staffNav.admin.sectionAccess.description' },
      { to: '/documents', label: 'Documents', icon: ICON.document, description: 'Company & employee document store.', labelKey: 'staffNav.admin.documents.label', descriptionKey: 'staffNav.admin.documents.description' },
      { to: '/assets', label: 'Assets', icon: ICON.asset, description: 'Equipment issued to employees.', labelKey: 'staffNav.admin.assets.label', descriptionKey: 'staffNav.admin.assets.description' },
      { to: '/team', label: 'Team', icon: ICON.team, sectionKey: 'team', description: 'Staff logins and roles.', labelKey: 'staffNav.admin.team.label', descriptionKey: 'staffNav.admin.team.description' },
      // No sectionKey — reading the hierarchy stays open to any staff role
      // (requireStaff, unchanged); only editing it is the admin-configurable
      // 'approvalHierarchy' grant, gated inside the page itself.
      { to: '/approvals', label: 'Approval Hierarchy', icon: ICON.hierarchy, description: 'Approval roles and multi-step workflow chains.', labelKey: 'staffNav.admin.approvals.label', descriptionKey: 'staffNav.admin.approvals.description' },
      { to: '/mobilisation-settings', label: 'Mobilisation Settings', icon: ICON.cog, roles: MOBILISATION_SETTINGS_MANAGE_ROLES, description: 'The stale mobilisation warning threshold — viewer/self-mobilise access is on Section Access now.', labelKey: 'staffNav.admin.mobilisationSettings.label', descriptionKey: 'staffNav.admin.mobilisationSettings.description' },
      { to: '/approvals/log', label: 'Approval Log', icon: ICON.activity, description: 'Every request decided through a workflow, in order. Visible if you sit in the hierarchy.', labelKey: 'staffNav.admin.approvalsLog.label', descriptionKey: 'staffNav.admin.approvalsLog.description' },
      { to: '/timesheet-processor', label: 'Timesheet Processor', icon: ICON.clock, sectionKey: 'timesheetProcessor', description: 'Bulk-import device attendance exports.', labelKey: 'staffNav.admin.timesheetProcessor.label', descriptionKey: 'staffNav.admin.timesheetProcessor.description' },
      { to: '/nfc', label: 'NFC Customers', icon: ICON.nfc, sectionKey: 'nfc', description: 'NFC business-card program.', labelKey: 'staffNav.admin.nfc.label', descriptionKey: 'staffNav.admin.nfc.description' },
      { to: '/security-log', label: 'Security Log', icon: ICON.check, sectionKey: 'auditLog', description: 'Auth & CRUD audit trail.', labelKey: 'staffNav.admin.securityLog.label', descriptionKey: 'staffNav.admin.securityLog.description' },
      { to: '/coordinator-activity', label: 'Coordinator Activity', icon: ICON.activity, roles: COORDINATOR_ACTIVITY_VIEW_ROLES, description: 'What Coordinators added themselves.', labelKey: 'staffNav.admin.coordinatorActivity.label', descriptionKey: 'staffNav.admin.coordinatorActivity.description' },
    ],
  },
];
