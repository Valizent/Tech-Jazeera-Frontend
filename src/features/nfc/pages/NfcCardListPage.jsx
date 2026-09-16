/**
 * NfcCardListPage — the card inventory: every physical card as a row, with its
 * status, holder, and batch. Search by token/chip/holder, filter by status and
 * company, generate new blank batches. Gated by the real 'nfc' Section
 * Access grant (fixed 2026-09-14 — see NfcCompanyListPage's doc comment).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listNfcCards, listNfcCompanies } from '../nfc.api.js';
import { CARD_STATUS_META, CARD_STATUSES } from '../nfc.constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import BatchGenerateModal from '../components/BatchGenerateModal.jsx';

export default function NfcCardListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('nfc'));
  const canWrite = Boolean(user.sectionAccessWrite?.includes('nfc'));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [generating, setGenerating] = useState(false);

  const { data: cards = [], isPending, isError } = useQuery({
    queryKey: ['nfc-cards', { search, status, company }],
    queryFn: () => listNfcCards({ search: search || undefined, status: status || undefined, company: company || undefined }),
    enabled: canRead,
  });
  const { data: companies = [], isError: companiesError } = useQuery({
    queryKey: ['nfc-companies', ''],
    queryFn: () => listNfcCompanies({}),
    enabled: canRead,
  });

  if (!canRead) return <Navigate to="/" replace />;

  const columns = [
    { key: 'token', header: 'Token', render: (c) => <span className="font-mono text-xs">{c.token}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={CARD_STATUS_META[c.status]?.variant ?? 'default'}>
          {CARD_STATUS_META[c.status]?.label ?? c.status}
        </Badge>
      ),
    },
    { key: 'holder', header: 'Holder', render: (c) => c.employee?.name || '—' },
    { key: 'company', header: 'Company', render: (c) => c.company?.companyName || '—', hideOnMobile: true },
    { key: 'batch', header: 'Batch', render: (c) => c.batch?.label || '—', hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="text-right">
          <Link to={`/nfc/cards/${c._id}`}>
            <Button size="sm" variant="secondary">
              Open
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="NFC Cards"
        description="Card inventory: tokens, status, and who holds each card."
        onBack={() => navigate(-1)}
        actions={
          <>
            <Link to="/nfc/analytics">
              <Button variant="secondary">Activity</Button>
            </Link>
            <Link to="/nfc">
              <Button variant="secondary">Companies</Button>
            </Link>
            {canWrite && <Button onClick={() => setGenerating(true)}>Generate batch</Button>}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input placeholder="Search token, chip or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {CARD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CARD_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Select value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>

      <PickerLoadWarning failed={[{ label: 'the company filter list', isError: companiesError }]} />
      {isError ? (
        <EmptyState title="Could not load cards" description="Check your permissions or connection, then try again." />
      ) : (
        <Table
          columns={columns}
          rows={cards}
          rowKey={(c) => c._id}
          loading={isPending}
          onRowClick={(c) => navigate(`/nfc/cards/${c._id}`)}
          emptyState={
            <EmptyState
              title={search || status || company ? 'No matching cards' : 'No cards yet'}
              description={
                search || status || company
                  ? 'Try clearing the filters.'
                  : 'Generate a batch of blank cards to get started.'
              }
              action={!(search || status || company) && canWrite && <Button onClick={() => setGenerating(true)}>Generate batch</Button>}
            />
          }
        />
      )}

      <BatchGenerateModal open={generating} onClose={() => setGenerating(false)} />
    </div>
  );
}
