/**
 * Client-side requirement schemas — instant feedback; the server's Zod layer
 * (and its authorization) is the real gatekeeper, same split as everywhere else
 * in this app. Dates are plain `YYYY-MM-DD` strings, exactly what
 * <input type="date"> produces and the API accepts.
 */
import { z } from 'zod';

const dateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.');

/**
 * `requireCoordinators`: true only while creating as someone who can assign to
 * others (team-write) — at least one coordinator is then a mandatory pick.
 *
 * `originalNeededBy`: the requirement's own `neededBy` as it stood when the
 * form opened (undefined/'' when adding new). Real bug fix (2026-09-24, a
 * real user report): a requirement's edit form always resends its current
 * `neededBy` even when only an unrelated field was touched, so this can't
 * simply reject any past date — an untouched, since-elapsed date must still
 * save (same split the server's own check makes — see requirement.service.js's
 * updateRequirement). Only a genuine CHANGE to a new past date is rejected;
 * on create there is no "unchanged" case, so any past date is rejected.
 */
export function buildRequirementFormSchema(requireCoordinators, originalNeededBy = '') {
  return z
    .object({
      clientName: z.string().trim().min(2, 'Enter the client company name.').max(150),
      jobTitle: z.string().trim().min(2, 'Enter the job title.').max(150),
      headcount: z
        .string()
        .trim()
        .regex(/^\d+$/, 'Headcount must be a whole number.')
        .refine((v) => Number(v) >= 1 && Number(v) <= 500, 'Headcount must be between 1 and 500.'),
      neededBy: dateOrEmpty,
      site: z.string().trim().max(150),
      notes: z.string().trim().max(2000, 'Keep the notes under 2000 characters.'),
      coordinators: z.array(z.string()),
    })
    .superRefine((v, ctx) => {
      if (requireCoordinators && v.coordinators.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['coordinators'], message: 'Pick at least one coordinator.' });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (v.neededBy && v.neededBy !== originalNeededBy && v.neededBy < today) {
        ctx.addIssue({ code: 'custom', path: ['neededBy'], message: "Needed-by date can't be in the past." });
      }
    });
}

export const emptyRequirementForm = {
  clientName: '',
  jobTitle: '',
  headcount: '1',
  neededBy: '',
  site: '',
  notes: '',
  coordinators: [],
};

export function requirementToForm(requirement) {
  return {
    clientName: requirement.clientName,
    jobTitle: requirement.jobTitle,
    headcount: String(requirement.headcount),
    neededBy: requirement.neededBy ? requirement.neededBy.slice(0, 10) : '',
    site: requirement.site ?? '',
    notes: requirement.notes ?? '',
    coordinators: requirement.coordinators.map((c) => c._id),
  };
}

export const stageFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the stage a name.').max(60, 'Keep the name under 60 characters.'),
  staleAfterDays: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 365), 'Whole days, between 1 and 365 — or leave empty.'),
  isTerminal: z.boolean(),
  notifyOnEnter: z.boolean(),
  isMobilisedStage: z.boolean(),
});

export const emptyStageForm = { name: '', staleAfterDays: '', isTerminal: false, notifyOnEnter: false, isMobilisedStage: false };

export function stageToForm(stage) {
  return {
    name: stage.name,
    staleAfterDays: stage.staleAfterDays == null ? '' : String(stage.staleAfterDays),
    isTerminal: stage.isTerminal,
    notifyOnEnter: stage.notifyOnEnter,
    isMobilisedStage: Boolean(stage.isMobilisedStage),
  };
}

export const updateFormSchema = z.object({
  text: z.string().trim().min(1, 'Write the update first.').max(1000, 'Keep it under 1000 characters.'),
  stage: z.string(), // '' = leave the card where it is
});

// ---- candidates -----------------------------------------------------------------------

/** What a person can pick by hand — 'Mobilised' is never among them: only an
 *  approved mobilisation makes a candidate Mobilised. */
export const CANDIDATE_MANUAL_STATUSES = ['Identified', 'DocsInProgress', 'DocsReady', 'Dropped'];
export const CANDIDATE_WORKER_TYPES = ['SupplierEmployee', 'Freelancer'];

export const candidateFormSchema = z
  .object({
    workerType: z.enum(CANDIDATE_WORKER_TYPES),
    subcontractor: z.string(),
    workerName: z.string().trim().min(2, 'Enter the worker name.').max(150),
    iqamaNumber: z.string().trim().regex(/^(\d{10})?$/, 'An Iqama number is exactly 10 digits — or leave it empty.'),
    nationality: z.string().trim().max(80),
    phone: z.string().trim().regex(/^(\+?[0-9][0-9 -]{5,18})?$/, 'Enter a valid phone number — or leave it empty.'),
    status: z.enum(CANDIDATE_MANUAL_STATUSES),
    docsNote: z.string().trim().max(300, 'Keep the note under 300 characters.'),
  })
  .superRefine((v, ctx) => {
    if (v.workerType === 'SupplierEmployee' && !v.subcontractor) {
      ctx.addIssue({ code: 'custom', path: ['subcontractor'], message: 'Select the subcontractor this worker comes from.' });
    }
  });

export const emptyCandidateForm = {
  workerType: 'SupplierEmployee',
  subcontractor: '',
  workerName: '',
  iqamaNumber: '',
  nationality: '',
  phone: '',
  status: 'Identified',
  docsNote: '',
};

export function candidateToForm(candidate) {
  return {
    workerType: candidate.workerType,
    subcontractor: candidate.subcontractor ?? '',
    workerName: candidate.workerName,
    iqamaNumber: candidate.iqamaNumber ?? '',
    nationality: candidate.nationality ?? '',
    phone: candidate.phone ?? '',
    status: candidate.status === 'Mobilised' ? 'DocsReady' : candidate.status,
    docsNote: candidate.docsNote ?? '',
  };
}
