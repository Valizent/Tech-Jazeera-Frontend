/**
 * ChatReportsPage - moderation. Shows ONLY messages that a member reported (never a whole conversation); a
 * moderator dismisses the report or removes the message (text and file). Needs the "Chat reported messages"
 * Section Access grant.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, formatDateTime } from '../../../lib/utils.js';
import { decideChatReport, fetchReportFileBlob, listChatReports } from '../chat.api.js';
import MessageContent from '../components/MessageContent.jsx';

const STATUSES = ['open', 'dismissed', 'removed'];
const BADGE = { open: 'warning', dismissed: 'default', removed: 'danger' };

export default function ChatReportsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('open');
  const [toRemove, setToRemove] = useState(null);

  const reports = useQuery({ queryKey: ['chat', 'reports', status], queryFn: () => listChatReports({ status, limit: 50 }) });

  const decide = useMutation({
    mutationFn: ({ report, action }) => decideChatReport(report.id, action),
    onSuccess: () => {
      toast.success(t('chat.reports.decided'));
      setToRemove(null);
      queryClient.invalidateQueries({ queryKey: ['chat', 'reports'] });
    },
    onError: (error) => {
      console.error('[chat] could not decide the report', error);
      toast.error(apiMessage(error));
    },
  });

  const items = reports.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('chat.reports.title')} description={t('chat.reports.description')} onBack={() => navigate('/chat')} />

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((option) => (
          <Button key={option} size="sm" variant={status === option ? 'primary' : 'secondary'} onClick={() => setStatus(option)}>
            {t(`chat.reports.status.${option}`)}
          </Button>
        ))}
      </div>

      {reports.isLoading && <Skeleton className="h-40 w-full" />}
      {reports.isError && (
        <EmptyState
          title={t('chat.loadFailed')}
          action={
            <Button variant="secondary" onClick={() => reports.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {!reports.isLoading && !reports.isError && items.length === 0 && <EmptyState title={t('chat.reports.empty')} />}

      <div className="space-y-4">
        {items.map((report) => (
          <Card key={report.id}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {report.conversationType === 'group' ? report.conversationName : t('chat.reports.directChat')}
                  </p>
                  <p className="text-xs text-muted">
                    {t('chat.reports.reportedBy', { name: report.reporterName })} - {formatDateTime(report.createdAt)}
                  </p>
                </div>
                <Badge variant={BADGE[report.status]}>{t(`chat.reports.status.${report.status}`)}</Badge>
              </div>

              <div className="rounded-lg border border-border bg-bg/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted">{t('chat.reports.sentBy', { name: report.senderName })}</p>
                {report.message?.deleted ? (
                  <p className="text-sm italic text-muted">{t('chat.messageDeleted')}</p>
                ) : (
                  report.message && <MessageContent message={report.message} fileId={report.id} fetchBlob={fetchReportFileBlob} />
                )}
              </div>

              <p className="text-sm">
                <span className="font-medium">{t('chat.reports.reason')}: </span>
                <span className="text-muted">{report.reason || t('chat.reports.noReason')}</span>
              </p>

              {report.status === 'open' ? (
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ report, action: 'dismiss' })}>
                    {t('chat.reports.dismiss')}
                  </Button>
                  <Button variant="danger-solid" icon="trash" disabled={decide.isPending} onClick={() => setToRemove(report)}>
                    {t('chat.reports.removeMessage')}
                  </Button>
                </div>
              ) : (
                report.reviewedByName && (
                  <p className="text-xs text-muted">
                    {t('chat.reports.reviewedBy', { name: report.reviewedByName })} - {formatDateTime(report.reviewedAt)}
                  </p>
                )
              )}
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title={t('chat.reports.removeTitle')}
        message={t('chat.reports.removeMessageConfirm')}
        confirmLabel={t('chat.reports.removeMessage')}
        loading={decide.isPending}
        onConfirm={() => decide.mutate({ report: toRemove, action: 'remove' })}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
