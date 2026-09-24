/**
 * LocationsSettingsPage — Admin-only. The shared "site / location" picklist
 * behind Mobilisation's and Requirement's `site` field can be added to by any
 * staff member inline (their own "+ Add new"), but removing an entry is
 * locked to Admin here (2026-09-24, the user's own explicit ask) — same
 * posture as SectionAccessPage's own client-side Admin guard.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listLocations, deleteLocation } from '../locations.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function LocationsSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState(null);

  const { data: locations, isPending, isError, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: listLocations,
    enabled: user.role === 'Admin',
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteLocation(id),
    onSuccess: () => {
      toast.success(t('staffLocations.toasts.deleted'));
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setToDelete(null);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (user.role !== 'Admin') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t('staffLocations.pageTitle')}
        description={t('staffLocations.pageDescription')}
        onBack={() => navigate(-1)}
      />
      <Card>
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title={t('staffLocations.couldNotLoad')}
            description={t('staffLocations.couldNotLoadDescription')}
            action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : locations.length === 0 ? (
          <EmptyState title={t('staffLocations.emptyTitle')} description={t('staffLocations.emptyDescription')} />
        ) : (
          <ul className="divide-y divide-border">
            {locations.map((loc) => (
              <li key={loc._id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-text">{loc.name}</span>
                <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(loc)}>
                  {t('common.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffLocations.deleteConfirmTitle')}
        message={t('staffLocations.deleteConfirmMessage', { name: toDelete?.name })}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
