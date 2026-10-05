/**
 * ExitDocumentsPage — staff review for Exit Re-Entry visa requests and
 * certificate requests (PRD Module 6), plus a staff member's own
 * self-submission of either (Admin excluded — no Employee record, same
 * exclusion Leave's SubmitLeavePanel documents). See docs/TABS-notes.md for
 * why tabs replaced the original vertical stack, and
 * docs/APPROVAL-HIERARCHY-notes.md's exit-documents follow-up for why
 * self-submit exists here now.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { submitExitReentry } from '../exitReentry.api.js';
import { submitCertificate } from '../certificates.api.js';
import {
  exitReentryFormSchema,
  emptyExitReentryForm,
  certificateFormSchema,
  emptyCertificateForm,
} from '../exitDocuments.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { VISA_TYPES, CERTIFICATE_TYPES, CERTIFICATE_TYPE_LABELS } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import ExitReentryReviewPanel from '../components/ExitReentryReviewPanel.jsx';
import CertificateReviewPanel from '../components/CertificateReviewPanel.jsx';

/** A staff member (Coordinator/HR/Manager/Accounts/Executive) submitting
 *  their OWN exit re-entry visa request. Admin has no Employee record and
 *  never sees this tab — same exclusion as Leave's SubmitLeavePanel. */
function SubmitExitReentryPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(exitReentryFormSchema), defaultValues: emptyExitReentryForm });

  const submitMutation = useMutation({
    mutationFn: submitExitReentry,
    onSuccess: () => {
      toast.success('Exit re-entry request submitted.');
      reset(emptyExitReentryForm);
      queryClient.invalidateQueries({ queryKey: ['exit-documents', 'exit-reentry'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const onInvalid = (formErrors) => {
    console.error('[exitDocuments] exit re-entry form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || 'Please check the form and try again.');
  };

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Submit your own request</h2>
      <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        <Select label="Visa type" error={errors.visaType?.message} {...register('visaType')}>
          <option value="">Choose a visa type…</option>
          {VISA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Departure date" type="date" error={errors.departureDate?.message} {...register('departureDate')} />
          <Input label="Expected return date" type="date" error={errors.expectedReturnDate?.message} {...register('expectedReturnDate')} />
        </div>
        <Textarea label="Reason" placeholder="Optional" error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            Submit request
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** A staff member submitting their OWN certificate request. */
function SubmitCertificatePanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(certificateFormSchema), defaultValues: emptyCertificateForm });

  const submitMutation = useMutation({
    mutationFn: submitCertificate,
    onSuccess: () => {
      toast.success('Certificate request submitted.');
      reset(emptyCertificateForm);
      queryClient.invalidateQueries({ queryKey: ['exit-documents', 'certificates'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const onInvalid = (formErrors) => {
    console.error('[exitDocuments] certificate form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || 'Please check the form and try again.');
  };

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Submit your own request</h2>
      <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        <Select label="Certificate type" error={errors.type?.message} {...register('type')}>
          <option value="">Choose a type…</option>
          {CERTIFICATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CERTIFICATE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Textarea label="Purpose" placeholder="Optional what it's for (bank account, visa, new employer…)" error={errors.purpose?.message} {...register('purpose')} />
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            Submit request
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ExitDocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSubmit = user.role !== 'Admin';

  const tabs = [
    { key: 'exit-reentry', label: 'Exit Re-Entry', content: <ExitReentryReviewPanel /> },
    canSubmit && { key: 'submit-exit-reentry', label: 'Submit Re-Entry', content: <SubmitExitReentryPanel /> },
    { key: 'certificates', label: 'Certificates', content: <CertificateReviewPanel /> },
    canSubmit && { key: 'submit-certificate', label: 'Submit Certificate', content: <SubmitCertificatePanel /> },
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useTabParam(tabs, 'exit-reentry');

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Exit & documents"
        description="Exit re-entry visa requests and official certificate requests."
        onBack={() => navigate(-1)}
      />
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
