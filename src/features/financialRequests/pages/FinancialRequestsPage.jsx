/**
 * FinancialRequestsPage — staff review for both salary advances and
 * reimbursement claims (PRD Module 4). Four tabs: each request type's
 * review queue plus its own "submit your own" form — see
 * docs/TABS-notes.md for why tabs replaced the original vertical stack.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';
import AdvanceReviewPanel, { SubmitAdvancePanel } from '../components/AdvanceReviewPanel.jsx';
import ReimbursementReviewPanel, { SubmitReimbursementPanel } from '../components/ReimbursementReviewPanel.jsx';

export default function FinancialRequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSubmit = user.role !== 'Admin';

  const tabs = [
    { key: 'advances', label: 'Advances', content: <AdvanceReviewPanel /> },
    canSubmit && { key: 'submit-advance', label: 'Submit Advance', content: <SubmitAdvancePanel /> },
    { key: 'reimbursements', label: 'Reimbursements', content: <ReimbursementReviewPanel /> },
    canSubmit && { key: 'submit-reimbursement', label: 'Submit Reimbursement', content: <SubmitReimbursementPanel /> },
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useTabParam(tabs, 'advances');

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Financial requests"
        description="Salary advances and expense reimbursement claims."
        onBack={() => navigate(-1)}
      />
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
