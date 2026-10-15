/**
 * SubcontractorApprovalBanner - a subcontractor that is not live yet: Pending (waiting for approval, with the
 * stages) or Rejected (with the reason). Nothing shows once it is approved.
 */
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';

export default function SubcontractorApprovalBanner({ subcontractor, resubmitHint = false }) {
  const { t } = useTranslation();
  return (
    <>
      {subcontractor.approvalStatus === 'Rejected' && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-3">
            <Badge variant="danger">{t('common.status.Rejected')}</Badge>
            <div>
              <p className="text-sm font-medium">{t('staffSubcontractors.approval.rejectedTitle')}</p>
              {subcontractor.decisionNote && <p className="mt-1 text-sm text-muted">{subcontractor.decisionNote}</p>}
              {subcontractor.decidedBy?.name && (
                <p className="mt-1 text-xs text-muted">
                  {t('staffSubcontractors.approval.rejectedBy', { name: subcontractor.decidedBy.name, date: formatDate(subcontractor.decidedAt) })}
                </p>
              )}
              {resubmitHint && <p className="mt-2 text-xs text-muted">{t('staffSubcontractors.approval.resubmitHint')}</p>}
            </div>
          </div>
        </Card>
      )}
      {subcontractor.approvalStatus === 'Pending' && (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-center gap-3">
            <Badge variant="warning">{t('common.status.Pending')}</Badge>
            <p className="text-sm text-muted">{t('staffSubcontractors.approval.pendingHint')}</p>
          </div>
        </Card>
      )}
      {subcontractor.workflow && (
        <Card>
          <ApprovalTrailView request={subcontractor} pendingStatus="Pending" statusField="approvalStatus" />
        </Card>
      )}
    </>
  );
}
