/**
 * DailyUpdatesPage — a coordinator's day-to-day work: a to-do list (their own,
 * plus anything a manager assigns them) and a daily log of what got done.
 * Someone with team access sees every coordinator's, and can assign tasks.
 *
 * What each viewer can do is derived once here from Section Access
 * (`dailyUpdatesOwn` = my own workspace, `dailyUpdatesTeam` = every
 * coordinator) plus the fact that only a Coordinator login keeps a log/to-do
 * of its own — mirroring dailyUpdate.service.js, which is the real enforcement.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listCoordinators } from '../dailyUpdates.api.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';
import TasksPanel from '../components/TasksPanel.jsx';
import LogPanel from '../components/LogPanel.jsx';

export default function DailyUpdatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const read = user.sectionAccess ?? [];
  const write = user.sectionAccessWrite ?? [];
  const isCoordinator = user.role === 'Coordinator';
  const ownWrite = write.includes('dailyUpdatesOwn');
  const access = {
    canSeeAll: read.includes('dailyUpdatesTeam'),
    canAssign: write.includes('dailyUpdatesTeam'),
    canAddLog: isCoordinator && ownWrite,
    canAddTask: write.includes('dailyUpdatesTeam') || (isCoordinator && ownWrite),
    // Whether a log entry's "REQ-0007" tag can link to the board (no dead-end 403 link).
    canOpenBoard: read.includes('requirementsOwn') || read.includes('requirementsTeam'),
  };

  const { data: coordinators, isError: coordinatorsError } = useQuery({
    queryKey: ['daily-updates', 'coordinators'],
    queryFn: listCoordinators,
    enabled: access.canSeeAll,
  });

  const tabs = [
    {
      key: 'tasks',
      label: t('staffDailyUpdates.tabs.tasks'),
      content: <TasksPanel access={access} currentUserId={user.id} coordinators={coordinators} />,
    },
    {
      key: 'log',
      label: t('staffDailyUpdates.tabs.log'),
      content: <LogPanel access={access} coordinators={coordinators} />,
    },
  ];
  const [tab, setTab] = useTabParam(tabs, 'tasks');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('staffDailyUpdates.pageTitle')} description={t('staffDailyUpdates.pageDescription')} />
      <div className="mb-4">
        <PickerLoadWarning failed={[{ label: 'the coordinator list', isError: coordinatorsError }]} />
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
    </div>
  );
}
