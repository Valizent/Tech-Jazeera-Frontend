/**
 * MobilisationSettingsPage — Admin-only. Down to the one setting that isn't
 * an access grant: how long a mobilisation may sit pending review before
 * every Manager login gets warned. The viewer-circle and self-mobilise role
 * checklists that used to live here moved to the Section Access page (keys
 * `mobilisationsViewer`/`mobilisationsSelfMobilise`) — one place to
 * configure every module's access instead of a one-off copy here.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMobilisationSettings, updateMobilisationSettings } from '../mobilisationSettings.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function MobilisationSettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isPending } = useQuery({
    queryKey: ['mobilisation-settings'],
    queryFn: getMobilisationSettings,
  });

  const [staleDays, setStaleDays] = useState('180');

  useEffect(() => {
    if (!settings) return;
    setStaleDays(String(settings.officeSecretaryStaleDays ?? 180));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => updateMobilisationSettings({ officeSecretaryStaleDays: staleDays }),
    onSuccess: () => {
      toast.success('Mobilisation settings saved.');
      queryClient.invalidateQueries({ queryKey: ['mobilisation-settings'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Mobilisation settings"
        description="Who can view every mobilisation or self-mobilise is now configured from Section Access."
        onBack={() => navigate(-1)}
      />

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Stale mobilisation warning</h2>
            <p className="mt-1 mb-2 text-xs text-muted">
              If a mobilisation sits pending review with no decision for this many days, every Manager login gets
              notified — a nudge for one that&apos;s been waiting on a client&apos;s paperwork too long.
            </p>
            <Input
              type="number"
              min="1"
              max="3650"
              className="max-w-[160px]"
              value={staleDays}
              onChange={(e) => setStaleDays(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted">
            Looking for who can view every mobilisation or create one directly? That&apos;s now on the{' '}
            <Link to="/section-access" className="font-medium text-primary hover:underline">
              Section Access
            </Link>{' '}
            page.
          </p>

          <div className="flex justify-end pt-2">
            <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
              Save
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
