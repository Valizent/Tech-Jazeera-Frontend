/**
 * ApprovalsPage — Admin-only configuration of the company's Configurable
 * Approval Hierarchy: named ApprovalRoles (GM, COO, HR, BDM…, each holding
 * one or more staff accounts) and ApprovalWorkflows (ordered chains built
 * from those roles). Deciding an actual request happens on that request's
 * own review screen (LeavePage etc.) via the shared engine — this page is
 * configuration only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  listApprovalRoles,
  createApprovalRole,
  updateApprovalRole,
  listApprovalWorkflows,
  createApprovalWorkflow,
  updateApprovalWorkflow,
} from '../approvals.api.js';
import {
  approvalRoleFormSchema,
  emptyApprovalRoleForm,
  approvalRoleToForm,
  approvalWorkflowFormSchema,
  emptyApprovalWorkflowForm,
  approvalWorkflowToForm,
} from '../approvals.schema.js';
import { listStaffUsers } from '../../users/users.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { APPROVAL_REQUEST_TYPES, APPROVAL_REQUEST_TYPE_LABELS } from '../../../lib/constants.js';
import { apiMessage, cn } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { PillChecklist } from '../../../components/ui/TogglePill.jsx';

function ApprovalRolesPanel() {
  const { user } = useAuth();
  const canManage = Boolean(user.sectionAccess?.includes('approvalHierarchy'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit

  const { data: roles, isPending } = useQuery({ queryKey: ['approval-roles'], queryFn: listApprovalRoles });
  const { data: staffUsers } = useQuery({ queryKey: ['users', {}], queryFn: () => listStaffUsers({}) });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(approvalRoleFormSchema), defaultValues: emptyApprovalRoleForm });
  const members = watch('members') ?? [];

  function toggleMember(id) {
    setValue('members', members.includes(id) ? members.filter((m) => m !== id) : [...members, id]);
  }

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?._id ? updateApprovalRole(editing._id, values) : createApprovalRole(values)),
    onSuccess: () => {
      toast.success(editing?._id ? 'Approval role updated.' : 'Approval role created.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['approval-roles'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyApprovalRoleForm);
    setEditing({});
  }
  function openEdit(role) {
    reset(approvalRoleToForm(role));
    setEditing(role);
  }

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Approval roles</h2>
          <p className="mt-1 text-xs text-muted">
            Named roles in your hierarchy (GM, COO, HR, BDM…) — each holds one or more staff accounts.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew}>
            Add role
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : roles.length === 0 ? (
        <EmptyState title="No approval roles yet" description="Add one to start building your approval hierarchy." />
      ) : (
        <div className="divide-y divide-border">
          {roles.map((r) => (
            <button
              key={r._id}
              onClick={() => openEdit(r)}
              className="-mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-bg/60"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.members?.length ? r.members.map((m) => m.name).join(', ') : 'No members yet'}
                </p>
              </div>
              <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? 'Edit approval role' : 'New approval role'}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <Input label="Name *" placeholder="e.g. HR, BDM, COO" error={errors.name?.message} {...register('name')} />
          <Input label="Description" error={errors.description?.message} {...register('description')} />
          <div>
            <label className="mb-2 block text-sm font-medium">Members</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
              <PillChecklist
                items={staffUsers ?? []}
                selected={members}
                onToggle={toggleMember}
                getLabel={(u) => `${u.name} (${u.role})`}
                emptyMessage="No staff accounts found."
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isActive')} />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {canManage ? 'Cancel' : 'Close'}
            </Button>
            {canManage && (
              <Button type="submit" isLoading={saveMutation.isPending}>
                Save
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

/** The down-arrow rendered between two step cards — purely decorative (not
 *  a drop target of its own), it's what makes the reordered list actually
 *  read as a connected chain rather than just a list. */
function StepConnector() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-muted">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-5-5m5 5l5-5" />
      </svg>
    </div>
  );
}

/**
 * One draggable step card. The grip handle (not the whole card) carries the
 * drag listeners, so clicking a role pill or the label input never fights
 * with starting a drag.
 */
function SortableStepCard({ id, index, register, roleError, roles, stepRoles, onToggleRole, onRemove, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-lg border bg-surface p-3', isDragging ? 'border-primary shadow-md' : 'border-border')}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-muted hover:bg-bg/60 hover:text-text active:cursor-grabbing"
          aria-label={`Drag to reorder step ${index + 1}`}
        >
          <GripIcon />
        </button>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <Input
          placeholder="Step label (optional, e.g. HR)"
          className="flex-1"
          aria-label={`Step ${index + 1} label`}
          {...register(`steps.${index}.label`)}
        />
        <Button
          type="button"
          size="sm"
          variant="danger-ghost"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove step"
        >
          ✕
        </Button>
      </div>
      <p className="mb-1 text-xs text-muted">Any ONE member of any role checked below can decide this step:</p>
      <PillChecklist items={roles} selected={stepRoles} onToggle={onToggleRole} />
      {roleError && <p className="mt-1 text-sm text-danger">{roleError}</p>}
    </div>
  );
}

function ApprovalWorkflowsPanel() {
  const { user } = useAuth();
  const canManage = Boolean(user.sectionAccess?.includes('approvalHierarchy'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);

  const { data: workflows, isPending } = useQuery({ queryKey: ['approval-workflows'], queryFn: listApprovalWorkflows });
  const { data: roles } = useQuery({ queryKey: ['approval-roles'], queryFn: listApprovalRoles });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(approvalWorkflowFormSchema), defaultValues: emptyApprovalWorkflowForm });
  const { fields: stepFields, append: appendStep, remove: removeStep, move: moveStep } = useFieldArray({ control, name: 'steps' });
  const appliesTo = watch('appliesTo') ?? [];

  // A short activation distance so clicking a role pill or the label input
  // inside a card is never misread as the start of a drag — only an actual
  // press-and-move on the grip handle (below) counts.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleStepDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stepFields.findIndex((f) => f.id === active.id);
    const newIndex = stepFields.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) moveStep(oldIndex, newIndex);
  }

  function toggleAppliesTo(type) {
    setValue('appliesTo', appliesTo.includes(type) ? appliesTo.filter((t) => t !== type) : [...appliesTo, type]);
  }
  function toggleStepRole(stepIndex, roleId) {
    const current = watch(`steps.${stepIndex}.roles`) ?? [];
    setValue(
      `steps.${stepIndex}.roles`,
      current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId]
    );
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing?._id ? updateApprovalWorkflow(editing._id, values) : createApprovalWorkflow(values),
    onSuccess: () => {
      toast.success(editing?._id ? 'Approval workflow updated.' : 'Approval workflow created.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyApprovalWorkflowForm);
    setEditing({});
  }
  function openEdit(workflow) {
    reset(approvalWorkflowToForm(workflow));
    setEditing(workflow);
  }

  const noRoles = !roles?.length;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Approval workflows</h2>
          <p className="mt-1 text-xs text-muted">
            Ordered chains built from your approval roles — any one member of a step's role(s) can decide it.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew} disabled={noRoles} title={noRoles ? 'Add an approval role first' : undefined}>
            Add workflow
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No approval workflows yet"
          description={noRoles ? 'Add an approval role first, then build a chain from it.' : 'Add one to route requests through a multi-step chain.'}
        />
      ) : (
        <div className="divide-y divide-border">
          {workflows.map((wf) => (
            <button
              key={wf._id}
              onClick={() => openEdit(wf)}
              className="-mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-bg/60"
            >
              <div>
                <p className="font-medium">{wf.name}</p>
                <p className="text-xs text-muted">
                  {wf.steps.map((s) => s.label || s.roles.map((r) => r.name).join('/')).join(' → ')}
                </p>
                {wf.appliesTo?.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted">
                    Default for: {wf.appliesTo.map((t) => APPROVAL_REQUEST_TYPE_LABELS[t]).join(', ')}
                  </p>
                )}
              </div>
              <Badge variant={wf.isActive ? 'success' : 'default'}>{wf.isActive ? 'Active' : 'Inactive'}</Badge>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit approval workflow' : 'New approval workflow'}
      >
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <Input label="Name *" placeholder="e.g. Leave Chain" error={errors.name?.message} {...register('name')} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Steps, in order *</label>
              <Button type="button" size="sm" variant="secondary" onClick={() => appendStep({ label: '', roles: [] })}>
                Add step
              </Button>
            </div>
            <div className="mt-2">
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
                <SortableContext items={stepFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  {stepFields.map((field, i) => (
                    <div key={field.id}>
                      {i > 0 && <StepConnector />}
                      <SortableStepCard
                        id={field.id}
                        index={i}
                        register={register}
                        roleError={errors.steps?.[i]?.roles?.message}
                        roles={roles ?? []}
                        stepRoles={watch(`steps.${i}.roles`) ?? []}
                        onToggleRole={(roleId) => toggleStepRole(i, roleId)}
                        onRemove={() => removeStep(i)}
                        canRemove={stepFields.length > 1}
                      />
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            {errors.steps?.message && <p className="mt-1 text-sm text-danger">{errors.steps.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Default for request types</label>
            <PillChecklist
              items={APPROVAL_REQUEST_TYPES}
              selected={appliesTo}
              onToggle={toggleAppliesTo}
              getId={(t) => t}
              getLabel={(t) => APPROVAL_REQUEST_TYPE_LABELS[t]}
            />
            <p className="mt-1 text-xs text-muted">
              Only one active workflow may default to a given request type — an individual employee's profile can
              still override this.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isActive')} />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {canManage ? 'Cancel' : 'Close'}
            </Button>
            {canManage && (
              <Button type="submit" isLoading={saveMutation.isPending}>
                Save
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </Card>
  );
}

export default function ApprovalsPage() {
  const navigate = useNavigate();
  // Read (list roles/workflows) is open to any staff member — the server's
  // own requireStaff floor, unchanged; the panels below each gate their own
  // Add/Save controls on the admin-configurable 'approvalHierarchy' Section
  // Access grant instead of an all-or-nothing page redirect.
  const tabs = [
    { key: 'roles', label: 'Roles', content: <ApprovalRolesPanel /> },
    { key: 'workflows', label: 'Workflows', content: <ApprovalWorkflowsPanel /> },
  ];
  const [activeTab, setActiveTab] = useTabParam(tabs, 'roles');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Approval Hierarchy"
        description="Define your company's approval roles and the multi-step chains Leave, Salary Advance, Reimbursement and Timesheet requests route through."
        onBack={() => navigate(-1)}
      />
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
