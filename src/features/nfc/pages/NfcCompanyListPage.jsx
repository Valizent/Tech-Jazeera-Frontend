/**
 * NfcCompanyListPage — the NFC Customers directory: every company with its
 * people count, searchable, row-clickable to the company page. Gated by the
 * real 'nfc' Section Access grant (fixed 2026-09-14, a real QA-audit-found
 * gap — this used to hardcode Admin-only client-side even after the server
 * moved to Section Access, so a genuinely-granted Manager still bounced
 * straight home).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listNfcCompanies } from '../nfc.api.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import NfcCompanyFormModal from '../components/NfcCompanyFormModal.jsx';

export default function NfcCompanyListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('nfc'));
  const canWrite = Boolean(user.sectionAccessWrite?.includes('nfc'));
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: companies = [], isPending } = useQuery({
    queryKey: ['nfc-companies', search],
    queryFn: () => listNfcCompanies({ search: search || undefined }),
    enabled: canRead,
  });

  if (!canRead) return <Navigate to="/" replace />;

  const columns = [
    {
      key: 'companyName',
      header: 'Company',
      render: (c) => (
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: c.brandColour || '#4F46E5' }}
            aria-hidden="true"
          />
          <span className="font-medium">{c.companyName}</span>
        </span>
      ),
    },
    { key: 'contactPerson', header: 'Contact', render: (c) => c.contactPerson || '—' },
    { key: 'phone', header: 'Phone', render: (c) => c.phone || '—', hideOnMobile: true },
    { key: 'city', header: 'City', render: (c) => c.city || '—', hideOnMobile: true },
    {
      key: 'employeeCount',
      header: 'People',
      render: (c) => <Badge variant="primary">{c.employeeCount}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="text-right">
          <Link to={`/nfc/${c._id}`}>
            <Button size="sm" variant="secondary">
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="NFC Customers"
        description="Companies and their people, with the NFC card assigned to each."
        onBack={() => navigate(-1)}
        actions={
          <>
            <Link to="/nfc/analytics">
              <Button variant="secondary">Activity</Button>
            </Link>
            <Link to="/nfc/cards">
              <Button variant="secondary">Cards</Button>
            </Link>
            {canWrite && <Button onClick={() => setAdding(true)}>Add company</Button>}
          </>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        rows={companies}
        rowKey={(c) => c._id}
        loading={isPending}
        onRowClick={(c) => navigate(`/nfc/${c._id}`)}
        emptyState={
          <EmptyState
            title={search ? 'No matching companies' : 'No companies yet'}
            description={
              search
                ? 'Try a different search.'
                : 'Add your first NFC customer company to start the register.'
            }
            action={!search && canWrite && <Button onClick={() => setAdding(true)}>Add company</Button>}
          />
        }
      />

      <NfcCompanyFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
