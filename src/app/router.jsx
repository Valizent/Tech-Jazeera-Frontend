/**
 * Route table + auth guard. Two worlds:
 *   - AuthLayout wraps guest screens (/login)
 *   - RequireAuth → DashboardLayout wraps everything signed-in
 *
 * RequireAuth is the guard: while the silent session-restore runs it shows a
 * full-screen spinner (NOT a redirect — bouncing a logged-in user to /login
 * for a half second on every reload is the classic mistake), then either
 * renders the app or redirects to /login.
 *
 * `errorElement: <ErrorPage />` on both top-level branches catches any
 * uncaught render/loader error in that subtree — without it, React Router
 * falls back to its own raw stack-trace screen (the "Hey developer" default
 * you get today). Placed on each branch rather than one outer route so a
 * crash inside the signed-in shell doesn't strand a guest, and vice versa.
 */
import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import EssLayout from './layouts/EssLayout.jsx';
// Every page below is lazy-loaded (Vite/Rollup splits each `import()` into
// its own chunk, fetched only when its route is actually visited) — this
// file used to eagerly import all 66 of them, producing one 1.27MB bundle
// regardless of which single page a login actually lands on. Composes with
// `guarded`/`guardedWrite` below with ZERO changes to either, since they
// just wrap whatever element they're given — a lazy component works as a
// drop-in replacement for a normal one as long as something up the tree
// provides a <Suspense> boundary, which each layout now does around its own
// <Outlet> (see layouts/*.jsx). NoPortalAccessPage is the one deliberate
// exception, kept eager: WorkerRouter renders it directly in place of
// <EssLayout> (not through EssLayout's own <Outlet>/<Suspense>), so there is
// no Suspense boundary above it to catch a lazy load.
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage.jsx'));
const EmployeeListPage = lazy(() => import('../features/employees/pages/EmployeeListPage.jsx'));
const EmployeeNewPage = lazy(() => import('../features/employees/pages/EmployeeNewPage.jsx'));
const EmployeeProfilePage = lazy(() => import('../features/employees/pages/EmployeeProfilePage.jsx'));
const EmployeeEditPage = lazy(() => import('../features/employees/pages/EmployeeEditPage.jsx'));
const ClientListPage = lazy(() => import('../features/clients/pages/ClientListPage.jsx'));
const ClientNewPage = lazy(() => import('../features/clients/pages/ClientNewPage.jsx'));
const ClientProfilePage = lazy(() => import('../features/clients/pages/ClientProfilePage.jsx'));
const ClientEditPage = lazy(() => import('../features/clients/pages/ClientEditPage.jsx'));
const DeploymentListPage = lazy(() => import('../features/deployments/pages/DeploymentListPage.jsx'));
const DeploymentDetailPage = lazy(() => import('../features/deployments/pages/DeploymentDetailPage.jsx'));
const StandbyListPage = lazy(() => import('../features/deployments/pages/StandbyListPage.jsx'));
const MobilisationListPage = lazy(() => import('../features/mobilisations/pages/MobilisationListPage.jsx'));
const MobilisationNewPage = lazy(() => import('../features/mobilisations/pages/MobilisationNewPage.jsx'));
const MobilisationDetailPage = lazy(() => import('../features/mobilisations/pages/MobilisationDetailPage.jsx'));
const MobilisationEditPage = lazy(() => import('../features/mobilisations/pages/MobilisationEditPage.jsx'));
const WorkerHistoryPage = lazy(() => import('../features/mobilisations/pages/WorkerHistoryPage.jsx'));
const MobilisationSettingsPage = lazy(() => import('../features/mobilisationSettings/pages/MobilisationSettingsPage.jsx'));
const CompanySettingsPage = lazy(() => import('../features/companySettings/pages/CompanySettingsPage.jsx'));
const SectionAccessPage = lazy(() => import('../features/sectionAccess/pages/SectionAccessPage.jsx'));
const SubcontractorListPage = lazy(() => import('../features/subcontractors/pages/SubcontractorListPage.jsx'));
const AttendancePage = lazy(() => import('../features/attendance/pages/AttendancePage.jsx'));
const AttendanceSummaryPage = lazy(() => import('../features/attendance/pages/AttendanceSummaryPage.jsx'));
const DocumentListPage = lazy(() => import('../features/documents/pages/DocumentListPage.jsx'));
const QuotationListPage = lazy(() => import('../features/quotations/pages/QuotationListPage.jsx'));
const QuotationNewPage = lazy(() => import('../features/quotations/pages/QuotationNewPage.jsx'));
const QuotationViewPage = lazy(() => import('../features/quotations/pages/QuotationViewPage.jsx'));
const QuotationEditPage = lazy(() => import('../features/quotations/pages/QuotationEditPage.jsx'));
const TimesheetProcessorPage = lazy(() => import('../features/timesheetProcessor/pages/TimesheetProcessorPage.jsx'));
const NfcCompanyListPage = lazy(() => import('../features/nfc/pages/NfcCompanyListPage.jsx'));
const NfcCompanyProfilePage = lazy(() => import('../features/nfc/pages/NfcCompanyProfilePage.jsx'));
const NfcCardListPage = lazy(() => import('../features/nfc/pages/NfcCardListPage.jsx'));
const NfcCardDetailPage = lazy(() => import('../features/nfc/pages/NfcCardDetailPage.jsx'));
const NfcAnalyticsPage = lazy(() => import('../features/nfc/pages/NfcAnalyticsPage.jsx'));
const UserListPage = lazy(() => import('../features/users/pages/UserListPage.jsx'));
const CoordinatorActivityPage = lazy(() => import('../features/coordinatorActivity/pages/CoordinatorActivityPage.jsx'));
const LeavePage = lazy(() => import('../features/leave/pages/LeavePage.jsx'));
const HolidayListPage = lazy(() => import('../features/holidays/pages/HolidayListPage.jsx'));
const SettlementListPage = lazy(() => import('../features/eosb/pages/SettlementListPage.jsx'));
const SettlementNewPage = lazy(() => import('../features/eosb/pages/SettlementNewPage.jsx'));
const SettlementViewPage = lazy(() => import('../features/eosb/pages/SettlementViewPage.jsx'));
const FinancialRequestsPage = lazy(() => import('../features/financialRequests/pages/FinancialRequestsPage.jsx'));
const AssetListPage = lazy(() => import('../features/assets/pages/AssetListPage.jsx'));
const ExitDocumentsPage = lazy(() => import('../features/exitDocuments/pages/ExitDocumentsPage.jsx'));
const TimesheetsPage = lazy(() => import('../features/timesheets/pages/TimesheetsPage.jsx'));
const PayrollListPage = lazy(() => import('../features/payroll/pages/PayrollListPage.jsx'));
const PayrollRunPage = lazy(() => import('../features/payroll/pages/PayrollRunPage.jsx'));
const InvoiceListPage = lazy(() => import('../features/invoices/pages/InvoiceListPage.jsx'));
const InvoiceViewPage = lazy(() => import('../features/invoices/pages/InvoiceViewPage.jsx'));
const ExpenseListPage = lazy(() => import('../features/expenses/pages/ExpenseListPage.jsx'));
const AuditLogPage = lazy(() => import('../features/audit/pages/AuditLogPage.jsx'));
const ReconciliationPage = lazy(() => import('../features/reconciliation/pages/ReconciliationPage.jsx'));
const DailyUpdatesPage = lazy(() => import('../features/dailyUpdates/pages/DailyUpdatesPage.jsx'));
const ApprovalsPage = lazy(() => import('../features/approvals/pages/ApprovalsPage.jsx'));
const ApprovalLogPage = lazy(() => import('../features/approvals/pages/ApprovalLogPage.jsx'));
const MyProfilePage = lazy(() => import('../features/ess/pages/MyProfilePage.jsx'));
const MyDocumentsPage = lazy(() => import('../features/ess/pages/MyDocumentsPage.jsx'));
const MyLeavePage = lazy(() => import('../features/ess/pages/MyLeavePage.jsx'));
const MyRequestsPage = lazy(() => import('../features/ess/pages/MyRequestsPage.jsx'));
const MyPayslipsPage = lazy(() => import('../features/ess/pages/MyPayslipsPage.jsx'));
const MyExitDocumentsPage = lazy(() => import('../features/ess/pages/MyExitDocumentsPage.jsx'));
const MyAttendancePage = lazy(() => import('../features/ess/pages/MyAttendancePage.jsx'));
// Kept eager — see the doc comment above.
import NoPortalAccessPage from '../features/ess/pages/NoPortalAccessPage.jsx';
import RequireSectionRead from '../components/shared/RequireSectionRead.jsx';
import RequireSectionWrite from '../components/shared/RequireSectionWrite.jsx';
import ErrorPage from './pages/ErrorPage.jsx';
const WorkforceHubPage = lazy(() => import('./pages/WorkforceHubPage.jsx'));
const SalesHubPage = lazy(() => import('./pages/SalesHubPage.jsx'));
const FinancialHubPage = lazy(() => import('./pages/FinancialHubPage.jsx'));
const AdminToolsHubPage = lazy(() => import('./pages/AdminToolsHubPage.jsx'));
import Spinner from '../components/ui/Spinner.jsx';

function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Self-service-only logins: Worker (P2-M2) and Staff — both get ONLY the
// ESS portal, never the admin shell. Kept as a plain array rather than an
// import from constants.js since this is purely a routing concern, not a
// permission list any module needs to reference.
const SELF_SERVICE_ROLES = ['Worker', 'Staff'];

/**
 * P2-M2: a Worker's (and, since the Subcontracted/Staff work, a Staff
 * login's) whole world is the ESS portal; every other role keeps the full
 * admin shell. Split here (not per-route guards) so a self-service login
 * never even mounts the admin sidebar before being redirected. Worker/Staff
 * redirect OUT of this branch entirely (to `/me`, under the sibling
 * WorkerRouter branch below) so RoleRouter never runs again for them.
 *
 * Office Secretary used to have her own narrower redirect here too (bounced
 * to `/mobilisations` from anywhere else, since she was deny-by-default and
 * `/api/dashboard` would just 403 for her). Moved into STAFF_ROLES
 * 2026-09-13 (see rbac.js's own doc comment) — `/api/dashboard` now passes
 * her through `requireStaffOrExecutive` like any other staff role, so the
 * redirect is gone; she reaches `/` and anything else she's actually been
 * granted, same as Coordinator/HR/Manager/Accounts.
 */
function RoleRouter() {
  const { user } = useAuth();
  if (SELF_SERVICE_ROLES.includes(user.role)) return <Navigate to="/me" replace />;
  return <Outlet />;
}

/**
 * Milestone 4: only an 'Own'-type Worker/Staff login gets the ESS portal at
 * all — an ineligible one (Outsourced/Subcontracted, old or new) sees a
 * small dead-end page instead of a shell full of routes that all 403. The
 * server's own gate (me.routes.js) is the real enforcement; `essEligible`
 * (set at login/refresh — auth.service.js) is purely this redirect's hint.
 */
function WorkerRouter() {
  const { user } = useAuth();
  if (!SELF_SERVICE_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  if (!user.essEligible) return <NoPortalAccessPage />;
  return <Outlet />;
}

/** Wrap a route's element with the Read gate for its section (see
 *  RequireSectionRead) — only for the sections that are now Section-Access
 *  read-gated. Routes deliberately left unwrapped: Mobilisation's list/
 *  view/new routes (visibility is per-record, not a blanket section — see
 *  mobilisation.service.js; MobilisationEditPage does its own in-page
 *  isPrimary-or-Admin/canEditSection1 check since that's per-record too),
 *  Financial Requests (list/submit stays on the broader
 *  requireStaffOrExecutive floor, unchanged), Company Settings/Approval Log
 *  (already have their own dynamic in-page 403 handling). */
const guarded = (sectionKey, element, officeSecretaryBypass) => (
  <RequireSectionRead sectionKey={sectionKey} officeSecretaryBypass={officeSecretaryBypass}>
    {element}
  </RequireSectionRead>
);

/** Same idea as `guarded`, but for a "new"/"edit" sub-route: checks Write,
 *  not Read (see RequireSectionWrite). These routes are normally reached
 *  via a button that's already canWrite-gated, but a direct URL/bookmark
 *  had no guard at all until this was added 2026-09-14 (found alongside the
 *  Company Settings read-only-viewer-gets-a-live-form bug) — the server was
 *  the only real backstop. */
const guardedWrite = (sectionKey, element, officeSecretaryBypass) => (
  <RequireSectionWrite sectionKey={sectionKey} officeSecretaryBypass={officeSecretaryBypass}>
    {element}
  </RequireSectionWrite>
);

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <RoleRouter />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/workforce', element: <WorkforceHubPage /> },
              { path: '/sales', element: <SalesHubPage /> },
              { path: '/financial', element: <FinancialHubPage /> },
              { path: '/admin-tools', element: <AdminToolsHubPage /> },
              { path: '/employees', element: guarded('employeeCreate', <EmployeeListPage />) },
              { path: '/employees/new', element: guardedWrite('employeeCreate', <EmployeeNewPage />) },
              { path: '/employees/:id', element: guarded('employeeCreate', <EmployeeProfilePage />) },
              // NOT guardedWrite('employeeCreate', ...): editing an employee is
              // gated by a DIFFERENT, hardcoded role list (Admin/Manager/HR —
              // see employee.routes.js's PATCH /:id) than creating one
              // ('employeeCreate' Section Access, POST /). EmployeeEditPage
              // does its own in-page EMPLOYEE_WRITE_ROLES check instead.
              { path: '/employees/:id/edit', element: <EmployeeEditPage /> },
              { path: '/clients', element: guarded('clientsManage', <ClientListPage />) },
              { path: '/clients/new', element: guardedWrite('clientsManage', <ClientNewPage />) },
              { path: '/clients/:id', element: guarded('clientsManage', <ClientProfilePage />) },
              { path: '/clients/:id/edit', element: guardedWrite('clientsManage', <ClientEditPage />) },
              // officeSecretaryBypass: true — mirrors deployment.routes.js's
              // own hardcoded canReadDeployments exception (she needs to
              // find the deployment she's about to enter hours against).
              { path: '/deployments', element: guarded('deploymentsRelease', <DeploymentListPage />, true) },
              // Before the /deployments/:id catch-all, or "standby" is read as a deployment id.
              { path: '/deployments/standby', element: guarded('deploymentsRelease', <StandbyListPage />, true) },
              { path: '/deployments/:id', element: guarded('deploymentsRelease', <DeploymentDetailPage />, true) },
              { path: '/mobilisations', element: <MobilisationListPage /> },
              { path: '/mobilisations/new', element: guardedWrite('mobilisationsSelfMobilise', <MobilisationNewPage />, true) },
              // Before the /mobilisations/:id catch-all, same reasoning as
              // /deployments/standby above. Admin-only, checked inside the
              // page itself (same posture as /section-access) — not worth a
              // dedicated Section Access key for a single hardcoded-Admin
              // utility.
              { path: '/mobilisations/worker-history', element: <WorkerHistoryPage /> },
              { path: '/mobilisations/:id', element: <MobilisationDetailPage /> },
              { path: '/mobilisations/:id/edit', element: <MobilisationEditPage /> },
              { path: '/mobilisation-settings', element: <MobilisationSettingsPage /> },
              { path: '/company-settings', element: <CompanySettingsPage /> },
              { path: '/section-access', element: <SectionAccessPage /> },
              { path: '/subcontractors', element: guarded('subcontractorsManage', <SubcontractorListPage />) },
              { path: '/attendance', element: guarded(['attendanceRecords', 'attendanceSignInOut', 'attendanceOfficeLocation'], <AttendancePage />) },
              { path: '/attendance/summary', element: guarded('attendanceRecords', <AttendanceSummaryPage />) },
              { path: '/documents', element: guarded('documentsManage', <DocumentListPage />) },
              { path: '/quotations', element: guarded('quotationsManage', <QuotationListPage />) },
              { path: '/quotations/new', element: guardedWrite('quotationsManage', <QuotationNewPage />) },
              { path: '/quotations/:id', element: guarded('quotationsManage', <QuotationViewPage />) },
              { path: '/quotations/:id/edit', element: guardedWrite('quotationsManage', <QuotationEditPage />) },
              { path: '/timesheet-processor', element: guarded('timesheetProcessor', <TimesheetProcessorPage />) },
              { path: '/team', element: guarded('team', <UserListPage />) },
              { path: '/coordinator-activity', element: <CoordinatorActivityPage /> },
              { path: '/leave', element: guarded('leaveRequests', <LeavePage />) },
              { path: '/holidays', element: <HolidayListPage /> },
              { path: '/eosb', element: guarded('eosb', <SettlementListPage />) },
              // Before the /eosb/:id catch-all, or "new" is read as a settlement id.
              { path: '/eosb/new', element: guardedWrite('eosb', <SettlementNewPage />) },
              { path: '/eosb/:id', element: guarded('eosb', <SettlementViewPage />) },
              { path: '/financial-requests', element: <FinancialRequestsPage /> },
              { path: '/assets', element: guarded('assetsManage', <AssetListPage />) },
              { path: '/exit-documents', element: guarded('exitDocuments', <ExitDocumentsPage />) },
              { path: '/timesheets', element: guarded('timesheetRequests', <TimesheetsPage />) },
              { path: '/payroll', element: guarded('payroll', <PayrollListPage />) },
              { path: '/payroll/:id', element: guarded('payroll', <PayrollRunPage />) },
              { path: '/invoices', element: guarded('invoices', <InvoiceListPage />) },
              { path: '/invoices/:id', element: guarded('invoices', <InvoiceViewPage />) },
              { path: '/expenses', element: guarded('expenses', <ExpenseListPage />) },
              { path: '/security-log', element: guarded('auditLog', <AuditLogPage />) },
              { path: '/reconciliation', element: guarded('reconciliation', <ReconciliationPage />) },
              // Two independently-granted keys (own workspace / every coordinator) —
              // the route opens for either; the page and the server sort out which.
              { path: '/daily-updates', element: guarded(['dailyUpdatesOwn', 'dailyUpdatesTeam'], <DailyUpdatesPage />) },
              { path: '/approvals', element: guarded('approvalHierarchy', <ApprovalsPage />) },
              { path: '/approvals/log', element: <ApprovalLogPage /> },
              { path: '/nfc', element: guarded('nfc', <NfcCompanyListPage />) },
              { path: '/nfc/cards', element: guarded('nfc', <NfcCardListPage />) },
              { path: '/nfc/cards/:id', element: guarded('nfc', <NfcCardDetailPage />) },
              // Before the /nfc/:id catch-all, or "analytics" is read as a company id.
              { path: '/nfc/analytics', element: guarded('nfc', <NfcAnalyticsPage />) },
              { path: '/nfc/:id', element: guarded('nfc', <NfcCompanyProfilePage />) },
            ],
          },
        ],
      },
      {
        element: <WorkerRouter />,
        children: [
          {
            element: <EssLayout />,
            children: [
              { path: '/me', element: <MyProfilePage /> },
              { path: '/me/documents', element: <MyDocumentsPage /> },
              { path: '/me/attendance', element: <MyAttendancePage /> },
              { path: '/me/leave', element: <MyLeavePage /> },
              { path: '/me/requests', element: <MyRequestsPage /> },
              { path: '/me/payslips', element: <MyPayslipsPage /> },
              { path: '/me/exit-documents', element: <MyExitDocumentsPage /> },
            ],
          },
        ],
      },
    ],
  },
  // Unknown URL: send home — RequireAuth then sorts out login if needed.
  { path: '*', element: <Navigate to="/" replace /> },
]);
