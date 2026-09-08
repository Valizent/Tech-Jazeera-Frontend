/**
 * QuotationsPanel — the Quotations tab on a client profile: that client's
 * quotations, with a "New quotation" button pre-filling the client.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listQuotations } from '../quotations.api.js';
import { buildQuotationColumns } from './quotationColumns.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function QuotationsPanel({ clientId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = Boolean(user.sectionAccess?.includes('quotationsManage'));

  const { data, isPending } = useQuery({
    queryKey: ['quotations', { client: clientId }],
    queryFn: () => listQuotations({ client: clientId, limit: 100 }),
  });

  const columns = buildQuotationColumns({ t });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffQuotations.panel.title')}</h2>
        {canWrite && (
          <Button size="sm" onClick={() => navigate(`/quotations/new?client=${clientId}`)}>
            {t('staffQuotations.panel.newQuotation')}
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(q) => q._id}
          emptyState={
            <EmptyState
              title={t('staffQuotations.panel.emptyTitle')}
              description={canWrite ? t('staffQuotations.panel.emptyDescriptionWrite') : t('staffQuotations.panel.emptyDescriptionView')}
              action={
                canWrite ? (
                  <Button onClick={() => navigate(`/quotations/new?client=${clientId}`)}>{t('staffQuotations.panel.newQuotation')}</Button>
                ) : null
              }
            />
          }
        />
      )}
    </Card>
  );
}
