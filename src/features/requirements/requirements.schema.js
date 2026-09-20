/**
 * Client-side requirement schemas — instant feedback; the server's Zod layer
 * (and its authorization) is the real gatekeeper, same split as everywhere else
 * in this app. Dates are plain `YYYY-MM-DD` strings, exactly what
 * <input type="date"> produces and the API accepts.
 */
import { z } from 'zod';

const dateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.');

/** `requireCoordinators`: true only while creating as someone who can assign to
 *  others (team-write) — at least one coordinator is then a mandatory pick. */
export function buildRequirementFormSchema(requireCoordinators) {
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
});

export const emptyStageForm = { name: '', staleAfterDays: '', isTerminal: false, notifyOnEnter: false };

export function stageToForm(stage) {
  return {
    name: stage.name,
    staleAfterDays: stage.staleAfterDays == null ? '' : String(stage.staleAfterDays),
    isTerminal: stage.isTerminal,
    notifyOnEnter: stage.notifyOnEnter,
  };
}

export const updateFormSchema = z.object({
  text: z.string().trim().min(1, 'Write the update first.').max(1000, 'Keep it under 1000 characters.'),
  stage: z.string(), // '' = leave the card where it is
});
