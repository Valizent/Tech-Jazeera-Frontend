/**
 * MyAnnualVacationPage — a Worker/Staff login files and tracks their own
 * Annual Vacation requests. Always for themself (/api/me); HR files on behalf
 * of workers without a login from the staff page.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { submitMyAnnualVacation, listMyAnnualVacation, cancelMyAnnualVacation } from '../../annualVacation/annualVacation.api.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import VacationRequestForm from '../../annualVacation/components/VacationRequestForm.jsx';
import MyVacationRequests from '../../annualVacation/components/MyVacationRequests.jsx';

const QUERY_KEY = ['me', 'annual-vacation'];

export default function MyAnnualVacationPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('staffAnnualVacation.title')} description={t('staffAnnualVacation.essDescription')} />
      <VacationRequestForm submit={submitMyAnnualVacation} onSubmitted={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })} />
      <MyVacationRequests queryKey={QUERY_KEY} fetchRequests={listMyAnnualVacation} cancelRequest={cancelMyAnnualVacation} />
    </div>
  );
}
