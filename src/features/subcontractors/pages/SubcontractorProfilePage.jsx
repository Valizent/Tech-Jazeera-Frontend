/**
 * SubcontractorProfilePage - one subcontractor (2026-10-12): the company
 * profile (Arabic name, CR, National Address, contact, Finance person, Owner,
 * coordinators), a "missing details" banner, and its documents (Agreement and
 * CR with expiry dates, National Address, optional Letterhead).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getSubcontractor } from '../subcontractors.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { cn } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ProfileField from '../../../components/ui/ProfileField.jsx';
import DocumentsPanel from '../../documents/components/DocumentsPanel.jsx';
import CompanyProfileSummary from '../../companyProfile/components/CompanyProfileSummary.jsx';
import { MissingDetailsBanner } from '../../companyProfile/components/MissingDetails.jsx';
import { canDecideSubcontractor, canEditSubcontractor } from '../subcontractors.permissions.js';
import SubcontractorApprovalBanner from '../components/SubcontractorApprovalBanner.jsx';
import DecideSubcontractorModal from '../components/DecideSubcontractorModal.jsx';
import { CLIENT_APPROVAL_VARIANT } from '../../../lib/constants.js';

export default function SubcontractorProfilePage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [deciding, setDeciding] = useState(null);

  const { data: subcontractor, isPending, isError } = useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => getSubcontractor(id),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffSubcontractors.profile.notFoundTitle')}
        description={t('staffSubcontractors.profile.notFoundDescription')}
        action={<Button variant="secondary" onClick={() => navigate('/subcontractors')}>{t('common.back')}</Button>}
      />
    );
  }

  const tabs = [
    { key: 'overview', label: t('staffSubcontractors.profile.tabs.overview') },
    { key: 'documents', label: t('staffSubcontractors.profile.tabs.documents') },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={subcontractor.name}
        description={subcontractor.industry}
        onBack={() => navigate('/subcontractors')}
        actions={
          <>
            <Badge variant={subcontractor.status === 'Active' ? 'success' : 'default'} className="mr-1">
              {t(`common.status.${subcontractor.status}`, subcontractor.status)}
            </Badge>
            {subcontractor.approvalStatus && subcontractor.approvalStatus !== 'Approved' && (
              <Badge variant={CLIENT_APPROVAL_VARIANT[subcontractor.approvalStatus]} className="mr-1">
                {t(`common.status.${subcontractor.approvalStatus}`, subcontractor.approvalStatus)}
              </Badge>
            )}
            {canDecideSubcontractor(user, subcontractor) && (
              <Button onClick={() => setDeciding(subcontractor)}>{t('staffSubcontractors.review')}</Button>
            )}
            {canEditSubcontractor(user, subcontractor) && (
              <Button icon="pencil" variant="soft" onClick={() => navigate(`/subcontractors/${id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === item.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <MissingDetailsBanner missing={subcontractor.missingDetails} />
          <SubcontractorApprovalBanner subcontractor={subcontractor} />
          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              {t('staffSubcontractors.profile.companyDetails')}
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label={t('staffSubcontractors.form.industry')}>{subcontractor.industry}</ProfileField>
              <ProfileField label={t('staffSubcontractors.form.vatNumber')}>{subcontractor.vatNumber}</ProfileField>
              <ProfileField label={t('staffSubcontractors.form.creditLimitDays')}>{subcontractor.creditLimitDays}</ProfileField>
              <ProfileField label={t('staffSubcontractors.form.address')}>{subcontractor.address}</ProfileField>
            </dl>
          </Card>
          <CompanyProfileSummary company={subcontractor} />
          {subcontractor.notes && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffSubcontractors.form.notes')}</h2>
              <p className="whitespace-pre-wrap text-sm">{subcontractor.notes}</p>
            </Card>
          )}
        </div>
      )}
      {tab === 'documents' && <DocumentsPanel ownerType="Subcontractor" ownerId={id} ownerName={subcontractor.name} />}
      <DecideSubcontractorModal subcontractor={deciding} onClose={() => setDeciding(null)} />
    </div>
  );
}
