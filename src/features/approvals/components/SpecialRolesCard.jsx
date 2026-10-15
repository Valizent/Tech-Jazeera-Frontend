/**
 * SpecialRolesCard - the approval role the system treats as HR: its step on an annual vacation may change the
 * number of days. Until one is chosen the role named HR is used, so nothing has to be set for it to work.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSpecialRoles, listApprovalRoles, saveSpecialRoles } from '../approvals.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';

const PURPOSES = [{ key: 'hr', label: 'HR role', hint: 'The workflow step it sits in may change the number of days on an annual vacation.' }];

export default function SpecialRolesCard() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canManage = Boolean(user.sectionAccessWrite?.includes('approvalHierarchy'));
  const [values, setValues] = useState({ hr: '' });

  const { data: roles } = useQuery({ queryKey: ['approval-roles'], queryFn: listApprovalRoles });
  const { data: special } = useQuery({ queryKey: ['special-roles'], queryFn: getSpecialRoles });

  useEffect(() => {
    if (special) setValues({ hr: special.hr.chosen ?? '' });
  }, [special]);

  const saveMutation = useMutation({
    mutationFn: () => saveSpecialRoles({ hr: values.hr || null }),
    onSuccess: () => {
      toast.success('HR role saved.');
      queryClient.invalidateQueries({ queryKey: ['special-roles'] });
    },
    onError: (error) => {
      console.error('[approvals] saving special roles failed', error);
      toast.error(apiMessage(error));
    },
  });

  if (!special) return null;
  const activeRoles = (roles ?? []).filter((r) => r.isActive);
  const dirty = PURPOSES.some(({ key }) => (values[key] || null) !== special[key].chosen);

  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Roles the system looks for</h2>
      <div className="mt-4 grid grid-cols-1 gap-4">
        {PURPOSES.map(({ key, label, hint }) => (
          <div key={key}>
            <Select label={label} value={values[key]} disabled={!canManage} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}>
              <option value="">{`Find it by its usual name (${special[key].fallbackName})`}</option>
              {activeRoles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">{hint}</p>
            <p className="mt-0.5 text-xs text-muted">
              {special[key].effective ? `In use: ${special[key].effective.name}` : 'No role is in use yet, so this is skipped.'}
            </p>
          </div>
        ))}
      </div>
      {canManage && (
        <div className="mt-4 flex justify-end">
          <Button icon="check" variant="success-solid" size="sm" disabled={!dirty} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
