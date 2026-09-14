/**
 * NfcAnalyticsPage — the "is this working?" screen. Totals across every card,
 * the daily trend, which cards are actually being tapped, and where the taps
 * come from. Gated by the real 'nfc' Section Access grant (fixed 2026-09-14
 * — see NfcCompanyListPage's doc comment); read-only, no write action here.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getNfcOverviewAnalytics } from '../nfc.api.js';
import { CARD_STATUS_META } from '../nfc.constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Table from '../../../components/ui/Table.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import {
  Breakdown,
  DEVICE_LABELS,
  RangePicker,
  StatTiles,
  TARGET_LABELS,
  TrendBars,
  countryName,
} from '../components/NfcAnalyticsBits.jsx';

export default function NfcAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('nfc'));
  const [days, setDays] = useState(30);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['nfc-analytics', days],
    queryFn: () => getNfcOverviewAnalytics(days),
    enabled: canRead,
    placeholderData: (previous) => previous,
  });

  if (!canRead) return <Navigate to="/" replace />;

  const header = (
    <PageHeader
      title="Card activity"
      description="How the NFC cards are being used."
      onBack={() => navigate(-1)}
      actions={
        <>
          <RangePicker days={days} onChange={setDays} disabled={isPending} />
          <Link to="/nfc/cards">
            <Button variant="secondary">Cards</Button>
          </Link>
        </>
      }
    />
  );

  if (isPending) {
    return (
      <div>
        {header}
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        {header}
        <EmptyState
          title="Activity could not be loaded"
          description="Check that the server is running, then try again."
        />
      </div>
    );
  }

  const columns = [
    {
      key: 'employeeName',
      header: 'Person',
      render: (c) => <span className="font-medium">{c.employeeName ?? 'Unassigned'}</span>,
    },
    { key: 'companyName', header: 'Company', render: (c) => c.companyName ?? '—', hideOnMobile: true },
    {
      key: 'token',
      header: 'Card',
      render: (c) => <span className="font-mono text-xs text-muted">{c.token}</span>,
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const meta = CARD_STATUS_META[c.status] ?? { label: c.status, variant: 'default' };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
      hideOnMobile: true,
    },
    { key: 'views', header: 'Taps', render: (c) => <span className="tabular-nums">{c.views}</span> },
    { key: 'saves', header: 'Saved', render: (c) => <span className="tabular-nums">{c.saves}</span> },
    { key: 'clicks', header: 'Links', render: (c) => <span className="tabular-nums">{c.clicks}</span>, hideOnMobile: true },
  ];

  return (
    <div>
      {header}

      <div className={isFetching ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6 transition-opacity'}>
        <Card>
          <StatTiles totals={data.totals} lastEventAt={data.lastEventAt} />
          <p className="mt-3 text-xs text-muted">
            {data.cardsWithTaps} of {data.activeCards} active {data.activeCards === 1 ? 'card' : 'cards'} tapped in
            the last {data.days} days.
          </p>
          <div className="mt-5">
            <TrendBars series={data.series} />
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Breakdown
              title="Links tapped"
              rows={data.clicksByTarget}
              labels={TARGET_LABELS}
              empty="Nobody has tapped a link yet."
            />
            <Breakdown
              title="Countries"
              rows={data.countries}
              format={countryName}
              empty="Country needs the site behind a CDN."
            />
            <Breakdown title="Devices" rows={data.devices} labels={DEVICE_LABELS} />
          </div>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Most tapped cards</h2>
          <Table
            columns={columns}
            rows={data.topCards}
            rowKey={(c) => c._id}
            onRowClick={(c) => navigate(`/nfc/cards/${c._id}`)}
            emptyState={
              <EmptyState
                title="No taps yet"
                description="Once someone taps a card, it shows up here."
                action={
                  <Link to="/nfc/cards">
                    <Button variant="secondary">Go to cards</Button>
                  </Link>
                }
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
