/**
 * Client-side approval-role/workflow schemas — instant feedback; the
 * server's Zod layer is the real gatekeeper (same split as everywhere else).
 */
import { z } from 'zod';
import { APPROVAL_REQUEST_TYPES, EMPLOYEE_DEPARTMENTS } from '../../lib/constants.js';

export const approvalRoleFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  members: z.array(z.string()),
  isActive: z.boolean(),
});

export const emptyApprovalRoleForm = { name: '', description: '', members: [], isActive: true };

export function approvalRoleToForm(role) {
  return {
    name: role.name,
    description: role.description ?? '',
    members: (role.members ?? []).map((m) => m._id ?? m),
    isActive: role.isActive,
  };
}

/** One escalation level: after N days tell the step's approver or a role (inform only). */
const escalationLevelFormSchema = z.object({
  afterDays: z.coerce.number({ error: 'Enter the number of days.' }).int().min(1, 'Days must be at least 1.').max(90, 'Days cannot be more than 90.'),
  notify: z.enum(['approver', 'role']),
  role: z.string().optional().or(z.literal('')),
});

const workflowStepFormSchema = z
  .object({
    label: z.string().trim().max(60).optional().or(z.literal('')),
    roles: z.array(z.string()).min(1, 'Each step needs at least one role.'),
    escalation: z.array(escalationLevelFormSchema).max(3, 'A step can have up to 3 escalation levels.'),
  })
  .superRefine((step, ctx) => {
    step.escalation.forEach((level, i) => {
      if (level.notify === 'role' && !level.role) {
        ctx.addIssue({ code: 'custom', path: ['escalation', i, 'role'], message: 'Choose the role to tell.' });
      }
      if (i > 0 && level.afterDays <= step.escalation[i - 1].afterDays) {
        ctx.addIssue({ code: 'custom', path: ['escalation', i, 'afterDays'], message: 'Must come after the level above.' });
      }
    });
  });

export const approvalWorkflowFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  steps: z.array(workflowStepFormSchema).min(1, 'Add at least one step.'),
  appliesTo: z.array(z.enum(APPROVAL_REQUEST_TYPES)),
  // Roles told (not asked) when a request is submitted and again when it is approved.
  notifyRoles: z.array(z.string()),
  // "For employees in this department use that workflow" - only on a default workflow.
  departmentRoutes: z.array(z.object({ department: z.enum(EMPLOYEE_DEPARTMENTS), workflow: z.string().min(1, 'Choose a workflow.') })),
  isActive: z.boolean(),
});

export const emptyApprovalWorkflowForm = {
  name: '',
  steps: [{ label: '', roles: [], escalation: [] }],
  appliesTo: [],
  notifyRoles: [],
  departmentRoutes: [],
  isActive: true,
};

export function approvalWorkflowToForm(workflow) {
  return {
    name: workflow.name,
    steps: (workflow.steps ?? []).map((s) => ({
      label: s.label ?? '',
      roles: (s.roles ?? []).map((r) => r._id ?? r),
      escalation: (s.escalation ?? []).map((l) => ({ afterDays: l.afterDays, notify: l.notify, role: l.role?._id ?? l.role ?? '' })),
    })),
    appliesTo: workflow.appliesTo ?? [],
    notifyRoles: (workflow.notifyRoles ?? []).map((r) => r._id ?? r),
    departmentRoutes: (workflow.departmentRoutes ?? []).map((r) => ({ department: r.department, workflow: r.workflow?._id ?? r.workflow })),
    isActive: workflow.isActive,
  };
}
