/**
 * NfcCompanyProfilePage — one company: its brand + details (editable) and the
 * people under it, each with the NFC card they hold and actions to assign,
 * change, edit, or remove. Gated by the real 'nfc' Section Access grant
 * (fixed 2026-09-14 — see NfcCompanyListPage's doc comment); every write
 * action (edit/delete company, add/edit/delete a person, assign a card)
 * additionally needs the Write tier specifically.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getNfcCompany, deleteNfcCompany, deleteNfcEmployee, getNfcCompanyAnalytics } from '../nfc.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ProfileField from '../../../components/ui/ProfileField.jsx';
import NfcCompanyFormModal from '../components/NfcCompanyFormModal.jsx';
import NfcEmployeeFormModal from '../components/NfcEmployeeFormModal.jsx';
import AssignCardModal from '../components/AssignCardModal.jsx';

/** Window for the per-person tap counts shown beside each name. */
const ANALYTICS_DAYS = 30;

export default function NfcCompanyProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('nfc'));
  const canWrite = Boolean(user.sectionAccessWrite?.includes('nfc'));

  const [editingCompany, setEditingCompany] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [deletingPerson, setDeletingPerson] = useState(null);
  const [assigningTo, setAssigningTo] = useState(null);

  const { data: company, isPending, isError } = useQuery({
    queryKey: ['nfc-company', id],
    queryFn: () => getNfcCompany(id),
    enabled: canRead,
  });

  // Loaded separately so the profile is never held up by an aggregation; the
  // People table simply shows "—" until the counts arrive.
  const { data: activity } = useQuery({
    queryKey: ['nfc-company-analytics', id, ANALYTICS_DAYS],
    queryFn: () => getNfcCompanyAnalytics(id, ANALYTICS_DAYS),
    enabled: canRead,
  });
  const tapsByPerson = new Map((activity?.byEmployee ?? []).map((r) => [r.employee, r]));

  const deleteCompanyMutation = useMutation({
    mutationFn: () => deleteNfcCompany(id),
    onSuccess: () => {
      toast.success('Company deleted.');
      queryClient.invalidateQueries({ queryKey: ['nfc-companies'] });
      navigate('/nfc', { replace: true });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deletePersonMutation = useMutation({
    mutationFn: (personId) => deleteNfcEmployee(personId),
    onSuccess: () => {
      toast.success('Person removed.');
      queryClient.invalidateQueries({ queryKey: ['nfc-company', id] });
      setDeletingPerson(null);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const handleExport = () => {
    const withCards = company.employees.filter((p) => p.card);
    if (withCards.length === 0) {
      toast.error('No employees have cards assigned.');
      return;
    }

    const headers = ['Name', 'Job Title', 'Card Token', 'Card URL', 'Taps (30D)'];
    const csvRows = [headers.join(',')];

    withCards.forEach((p) => {
      const t = tapsByPerson.get(p._id);
      const taps = t ? t.views : 0;
      const row = [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.jobTitle || '').replace(/"/g, '""')}"`,
        `"${(p.card.token || '').replace(/"/g, '""')}"`,
        `"${(p.card.url || '').replace(/"/g, '""')}"`,
        taps
      ];
      csvRows.push(row.join(','));
    });

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canRead) return <Navigate to="/" replace />;

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title="Company not found"
        description="It may have been deleted."
        action={<BackButton onClick={() => navigate('/nfc')} />}
      />
    );
  }

  const columns = [
    { key: 'name', header: 'Name', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'jobTitle', header: 'Job title', render: (p) => p.jobTitle || '—', hideOnMobile: true },
    {
      key: 'card',
      header: 'Card',
      render: (p) =>
        p.card ? (
          <span className="flex items-center gap-2">
            <Link to={`/nfc/cards/${p.card._id}`} className="font-mono text-xs text-primary hover:underline">
              {p.card.token}
            </Link>
            <a href={p.card.url} target="_blank" rel="noopener noreferrer" title="Open tap page" className="text-muted hover:text-text">
              ↗
            </a>
          </span>
        ) : (
          <span className="text-muted">No card</span>
        ),
    },
    {
      key: 'taps',
      header: `Taps (${ANALYTICS_DAYS}d)`,
      hideOnMobile: true,
      render: (p) => {
        const t = tapsByPerson.get(p._id);
        if (!t) return <span className="text-muted">—</span>;
        return (
          <span className="tabular-nums" title={`${t.views} taps · ${t.saves} saved · ${t.clicks} link taps · ${t.images ?? 0} card downloads`}>
            {t.views}
            <span className="text-muted"> · {t.saves} saved</span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) =>
        canWrite ? (
          <div className="flex justify-end gap-2 whitespace-nowrap">
            <Button size="sm" variant="secondary" onClick={() => setAssigningTo(p)}>
              {p.card ? 'Change card' : 'Assign card'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingPerson(p)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeletingPerson(p)}>
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  const mapsHref =
    company.mapLink ||
    (company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : '');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: company.brandColour || '#4F46E5' }}
              aria-hidden="true"
            />
            {company.companyName}
          </span>
        }
        description={company.city || 'NFC customer'}
        onBack={() => navigate(-1)}
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => setEditingCompany(true)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => setDeletingCompany(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Company</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileField label="Contact person">{company.contactPerson}</ProfileField>
            <ProfileField label="Phone">{company.phone}</ProfileField>
            <ProfileField label="Email">{company.email}</ProfileField>
            <ProfileField label="Website">
              {company.website ? (
                <a href={/^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {company.website}
                </a>
              ) : null}
            </ProfileField>
            <ProfileField label="Address">
              {company.address ? (
                mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {company.address}
                  </a>
                ) : (
                  company.address
                )
              ) : null}
            </ProfileField>
            <ProfileField label="Brand colour">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: company.brandColour || '#4F46E5' }} />
                <span className="font-mono text-xs">{company.brandColour || '#4F46E5'}</span>
              </span>
            </ProfileField>
          </dl>
          {company.notes && (
            <div className="mt-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm">{company.notes}</dd>
            </div>
          )}
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              People ({company.employees.length})
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleExport}>
                Export Excel
              </Button>
              {canWrite && (
                <Button size="sm" onClick={() => setAddingPerson(true)}>
                  Add person
                </Button>
              )}
            </div>
          </div>
          <Table
            columns={columns}
            rows={company.employees}
            rowKey={(p) => p._id}
            emptyState={
              <EmptyState
                title="No people yet"
                description="Add the first person, then assign them a card."
                action={canWrite && <Button onClick={() => setAddingPerson(true)}>Add person</Button>}
              />
            }
          />
        </div>
      </div>

      <NfcCompanyFormModal open={editingCompany} onClose={() => setEditingCompany(false)} company={company} />
      <NfcEmployeeFormModal open={addingPerson} onClose={() => setAddingPerson(false)} companyId={id} />
      <NfcEmployeeFormModal
        open={Boolean(editingPerson)}
        onClose={() => setEditingPerson(null)}
        companyId={id}
        employee={editingPerson}
      />
      {assigningTo && (
        <AssignCardModal
          open={Boolean(assigningTo)}
          onClose={() => setAssigningTo(null)}
          employee={assigningTo}
          companyId={id}
        />
      )}

      <ConfirmDialog
        open={deletingCompany}
        title="Delete company?"
        message={`${company.companyName} and its ${company.employees.length} ${
          company.employees.length === 1 ? 'person' : 'people'
        } will be permanently removed. Any cards they hold return to the inventory.`}
        loading={deleteCompanyMutation.isPending}
        onConfirm={() => deleteCompanyMutation.mutate()}
        onCancel={() => setDeletingCompany(false)}
      />
      <ConfirmDialog
        open={Boolean(deletingPerson)}
        title="Remove person?"
        message={`${deletingPerson?.name} will be removed. Any card they hold returns to the inventory.`}
        confirmLabel="Remove"
        loading={deletePersonMutation.isPending}
        onConfirm={() => deletePersonMutation.mutate(deletingPerson._id)}
        onCancel={() => setDeletingPerson(null)}
      />
    </div>
  );
}
