/**
 * Client-side daily-update schemas — instant feedback; the server's Zod layer
 * (and its authorization) is the real gatekeeper, same split as everywhere
 * else in this app. Dates are plain `YYYY-MM-DD` strings, exactly what
 * <input type="date"> produces and the API accepts.
 */
import { z } from 'zod';

const dateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.');
const text = z.string().trim().min(1, 'Write something first.').max(1000, 'Keep it under 1000 characters.');

/** `requireCoordinator`: true only while creating a task as someone who can
 *  assign to others — the assignee is then a mandatory pick. */
export function buildTaskFormSchema(requireCoordinator) {
  return z
    .object({ text, dueDate: dateOrEmpty, coordinator: z.string() })
    .superRefine((v, ctx) => {
      if (requireCoordinator && !v.coordinator) {
        ctx.addIssue({ code: 'custom', path: ['coordinator'], message: 'Pick the coordinator this task is for.' });
      }
    });
}

export const logFormSchema = z.object({
  text,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the day this entry is about.'),
});

/** Today's date in the browser's own time zone, as <input type="date"> wants it. */
export function todayInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function taskToForm(task) {
  return {
    text: task.text,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    coordinator: '',
  };
}

export function logToForm(entry) {
  return { text: entry.text, date: entry.date.slice(0, 10) };
}
