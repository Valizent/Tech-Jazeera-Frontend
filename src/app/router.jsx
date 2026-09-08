/**
 * Route table + auth guard. Two worlds:
 *   - AuthLayout wraps guest screens (/login)
 *   - RequireAuth → DashboardLayout wraps everything signed-in
 *
 * RequireAuth is the guard: while the silent session-restore runs it shows a
 * full-screen spinner (NOT a redirect — bouncing a logged-in user to /login
 * for a half second on every reload is the classic mistake), then either
 * renders the app or redirects to /login.
 */
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import EssLayout from './layouts/EssLayout.jsx';
import LoginPage from '../features/auth/pages/LoginPage.jsx';
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx';
import EmployeeListPage from '../features/employees/pages/EmployeeListPage.jsx';
import EmployeeNewPage from '../features/employees/pages/EmployeeNewPage.jsx';
import EmployeeProfilePage from '../features/employees/pages/EmployeeProfilePage.jsx';
import EmployeeEditPage from '../features/employees/pages/EmployeeEditPage.jsx';
import ClientListPage from '../features/clients/pages/ClientListPage.jsx';
import ClientNewPage from '../features/clients/pages/ClientNewPage.jsx';
import ClientProfilePage from '../features/clients/pages/ClientProfilePage.jsx';
import ClientEditPage from '../features/clients/pages/ClientEditPage.jsx';
import DeploymentListPage from '../features/deployments/pages/DeploymentListPage.jsx';
import DeploymentDetailPage from '../features/deployments/pages/DeploymentDetailPage.jsx';
import MobilisationListPage from '../features/mobilisations/pages/MobilisationListPage.jsx';
import MobilisationNewPage from '../features/mobilisations/pages/MobilisationNewPage.jsx';
import MobilisationDetailPage from '../features/mobilisations/pages/MobilisationDetailPage.jsx';
import MobilisationEditPage from '../features/mobilisations/pages/MobilisationEditPage.jsx';
import MobilisationSettingsPage from '../features/mobilisationSettings/pages/MobilisationSettingsPage.jsx';
import CompanySettingsPage from '../features/companySettings/pages/CompanySettingsPage.jsx';
import SectionAccessPage from '../features/sectionAccess/pages/SectionAccessPage.jsx';
import SubcontractorListPage from '../features/subcontractors/pages/SubcontractorListPage.jsx';
import AttendancePage from '../features/attendance/pages/AttendancePage.jsx';
import AttendanceSummaryPage from '../features/attendance/pages/AttendanceSummaryPage.jsx';
import DocumentListPage from '../features/documents/pages/DocumentListPage.jsx';
import QuotationListPage from '../features/quotations/pages/QuotationListPage.jsx';
import QuotationNewPage from '../features/quotations/pages/QuotationNewPage.jsx';
import QuotationViewPage from '../features/quotations/pages/QuotationViewPage.jsx';
import QuotationEditPage from '../features/quotations/pages/QuotationEditPage.jsx';
import TimesheetProcessorPage from '../features/timesheetProcessor/pages/TimesheetProcessorPage.jsx';
import NfcCompanyListPage from '../features/nfc/pages/NfcCompanyListPage.jsx';
import NfcCompanyProfilePage from '../features/nfc/pages/NfcCompanyProfilePage.jsx';
import NfcCardListPage from '../features/nfc/pages/NfcCardListPage.jsx';
import NfcCardDetailPage from '../features/nfc/pages/NfcCardDetailPage.jsx';
import NfcAnalyticsPage from '../features/nfc/pages/NfcAnalyticsPage.jsx';
import UserListPage from '../features/users/pages/UserListPage.jsx';
import CoordinatorActivityPage from '../features/coordinatorActivity/pages/CoordinatorActivityPage.jsx';
import LeavePage from '../features/leave/pages/LeavePage.jsx';
import HolidayListPage from '../features/holidays/pages/HolidayListPage.jsx';
import SettlementListPage from '../features/eosb/pages/SettlementListPage.jsx';
import SettlementNewPage from '../features/eosb/pages/SettlementNewPage.jsx';
import SettlementViewPage from '../features/eosb/pages/SettlementViewPage.jsx';
import FinancialRequestsPage from '../features/financialRequests/pages/FinancialRequestsPage.jsx';
import AssetListPage from '../features/assets/pages/AssetListPage.jsx';
import ExitDocumentsPage from '../features/exitDocuments/pages/ExitDocumentsPage.jsx';
import TimesheetsPage from '../features/timesheets/pages/TimesheetsPage.jsx';
import PayrollListPage from '../features/payroll/pages/PayrollListPage.jsx';
import PayrollRunPage from '../features/payroll/pages/PayrollRunPage.jsx';
import InvoiceListPage from '../features/invoices/pages/InvoiceListPage.jsx';
import InvoiceViewPage from '../features/invoices/pages/InvoiceViewPage.jsx';
import ExpenseListPage from '../features/expenses/pages/ExpenseListPage.jsx';
import AuditLogPage from '../features/audit/pages/AuditLogPage.jsx';
import ApprovalsPage from '../features/approvals/pages/ApprovalsPage.jsx';
import ApprovalLogPage from '../features/approvals/pages/ApprovalLogPage.jsx';
import MyProfilePage from '../features/ess/pages/MyProfilePage.jsx';
import MyDocumentsPage from '../features/ess/pages/MyDocumentsPage.jsx';
import MyLeavePage from '../features/ess/pages/MyLeavePage.jsx';
import MyRequestsPage from '../features/ess/pages/MyRequestsPage.jsx';
import MyPayslipsPage from '../features/ess/pages/MyPayslipsPage.jsx';
import MyExitDocumentsPage from '../features/ess/pages/MyExitDocumentsPage.jsx';
import MyAttendancePage from '../features/ess/pages/MyAttendancePage.jsx';
import NoPortalAccessPage from '../features/ess/pages/NoPortalAccessPage.jsx';
import WorkforceHubPage from './pages/WorkforceHubPage.jsx';
import SalesHubPage from './pages/SalesHubPage.jsx';
import FinancialHubPage from './pages/FinancialHubPage.jsx';
import AdminToolsHubPage from './pages/AdminToolsHubPage.jsx';
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
 * Office Secretary is a narrower case: it stays in the admin shell (not the
 * ESS portal), but is deny-by-default like Executive — unlike Executive, it
 * was never allow-listed into the Dashboard endpoint (its only legitimate
 * destination is Mobilisations), so `/` — where every login lands after
 * sign-in — would just 403 on GET /api/dashboard. Unlike Worker/Staff's
 * redirect target, `/mobilisations` is still INSIDE this same RoleRouter-
 * guarded branch, so the location check is required — without it, RoleRouter
 * would re-run on the redirected-to URL and redirect again, never once
 * reaching <Outlet/> and leaving the whole page blank.
 */
function RoleRouter() {
  const { user } = useAuth();
  const location = useLocation();
  if (SELF_SERVICE_ROLES.includes(user.role)) return <Navigate to="/me" replace />;
  if (user.role === 'Office Secretary' && !location.pathname.startsWith('/mobilisations')) {
    return <Navigate to="/mobilisations" replace />;
  }
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

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
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
              { path: '/employees', element: <EmployeeListPage /> },
              { path: '/employees/new', element: <EmployeeNewPage /> },
              { path: '/employees/:id', element: <EmployeeProfilePage /> },
              { path: '/employees/:id/edit', element: <EmployeeEditPage /> },
              { path: '/clients', element: <ClientListPage /> },
              { path: '/clients/new', element: <ClientNewPage /> },
              { path: '/clients/:id', element: <ClientProfilePage /> },
              { path: '/clients/:id/edit', element: <ClientEditPage /> },
              { path: '/deployments', element: <DeploymentListPage /> },
              { path: '/deployments/:id', element: <DeploymentDetailPage /> },
              { path: '/mobilisations', element: <MobilisationListPage /> },
              { path: '/mobilisations/new', element: <MobilisationNewPage /> },
              { path: '/mobilisations/:id', element: <MobilisationDetailPage /> },
              { path: '/mobilisations/:id/edit', element: <MobilisationEditPage /> },
              { path: '/mobilisation-settings', element: <MobilisationSettingsPage /> },
              { path: '/company-settings', element: <CompanySettingsPage /> },
              { path: '/section-access', element: <SectionAccessPage /> },
              { path: '/subcontractors', element: <SubcontractorListPage /> },
              { path: '/attendance', element: <AttendancePage /> },
              { path: '/attendance/summary', element: <AttendanceSummaryPage /> },
              { path: '/documents', element: <DocumentListPage /> },
              { path: '/quotations', element: <QuotationListPage /> },
              { path: '/quotations/new', element: <QuotationNewPage /> },
              { path: '/quotations/:id', element: <QuotationViewPage /> },
              { path: '/quotations/:id/edit', element: <QuotationEditPage /> },
              { path: '/timesheet-processor', element: <TimesheetProcessorPage /> },
              { path: '/team', element: <UserListPage /> },
              { path: '/coordinator-activity', element: <CoordinatorActivityPage /> },
              { path: '/leave', element: <LeavePage /> },
              { path: '/holidays', element: <HolidayListPage /> },
              { path: '/eosb', element: <SettlementListPage /> },
              // Before the /eosb/:id catch-all, or "new" is read as a settlement id.
              { path: '/eosb/new', element: <SettlementNewPage /> },
              { path: '/eosb/:id', element: <SettlementViewPage /> },
              { path: '/financial-requests', element: <FinancialRequestsPage /> },
              { path: '/assets', element: <AssetListPage /> },
              { path: '/exit-documents', element: <ExitDocumentsPage /> },
              { path: '/timesheets', element: <TimesheetsPage /> },
              { path: '/payroll', element: <PayrollListPage /> },
              { path: '/payroll/:id', element: <PayrollRunPage /> },
              { path: '/invoices', element: <InvoiceListPage /> },
              { path: '/invoices/:id', element: <InvoiceViewPage /> },
              { path: '/expenses', element: <ExpenseListPage /> },
              { path: '/security-log', element: <AuditLogPage /> },
              { path: '/approvals', element: <ApprovalsPage /> },
              { path: '/approvals/log', element: <ApprovalLogPage /> },
              { path: '/nfc', element: <NfcCompanyListPage /> },
              { path: '/nfc/cards', element: <NfcCardListPage /> },
              { path: '/nfc/cards/:id', element: <NfcCardDetailPage /> },
              // Before the /nfc/:id catch-all, or "analytics" is read as a company id.
              { path: '/nfc/analytics', element: <NfcAnalyticsPage /> },
              { path: '/nfc/:id', element: <NfcCompanyProfilePage /> },
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
