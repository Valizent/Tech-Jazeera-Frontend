/**
 * AnnualVacationPage — staff side of Annual Vacation requests: the review
 * queue (Section Access 'annualVacation' Read), a form to file one — for
 * yourself, or for any employee with Write on the section — and your own
 * requests. A Worker/Staff login uses the ESS page instead.
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  submitAnnualVacation,
  listMyStaffAnnualVacation,
  cancelStaffAnnualVacation,
  VACATION_QUEUE_KEY,
  MY_VACATION_REQUESTS_KEY,
} from '../annualVacation.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useEmployeePicker } from '../../../lib/useEmployeePicker.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';
import VacationReviewPanel from '../components/VacationReviewPanel.jsx';
import VacationRequestForm from '../components/VacationRequestForm.jsx';
import MyVacationRequests from '../components/MyVacationRequests.jsx';

export default function AnnualVacationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canRead = user.sectionAccess?.includes('annualVacation');
  const canWrite = user.sectionAccessWrite?.includes('annualVacation');
  // Admin has no Employee record of their own — they can only file for someone else.
  const canFileForSelf = user.role !== 'Admin';

  const picker = useEmployeePicker({ enabled: Boolean(canWrite) });
  const employeeOptions = useMemo(
    () => (canWrite ? (picker.data?.items ?? []).map((e) => ({ value: e._id, label: `${e.fullName} (${e.employeeId})` })) : null),
    [canWrite, picker.data]
  );

  const tabs = [
    canRead && { key: 'requests', label: t('staffAnnualVacation.tabRequests'), content: <VacationReviewPanel /> },
    {
      key: 'file',
      label: t('staffAnnualVacation.tabFile'),
      content: (
        <VacationRequestForm
          submit={submitAnnualVacation}
          employeeOptions={employeeOptions}
          allowSelf={canFileForSelf}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: VACATION_QUEUE_KEY });
            queryClient.invalidateQueries({ queryKey: MY_VACATION_REQUESTS_KEY });
          }}
        />
      ),
    },
    canFileForSelf && {
      key: 'mine',
      label: t('staffAnnualVacation.tabMine'),
      content: (
        <MyVacationRequests queryKey={MY_VACATION_REQUESTS_KEY} fetchRequests={listMyStaffAnnualVacation} cancelRequest={cancelStaffAnnualVacation} />
      ),
    },
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useTabParam(tabs, tabs[0].key);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader title={t('staffAnnualVacation.title')} description={t('staffAnnualVacation.description')} onBack={() => navigate(-1)} />
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
