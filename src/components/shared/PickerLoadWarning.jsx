/**
 * PickerLoadWarning — a compact inline warning for when a form's SECONDARY
 * lookup (a picker/dropdown populated from its own query — Employees,
 * Clients, Subcontractors, etc.) fails to load. Added 2026-09-15, the QA
 * audit's own UX suggestion #5 ("show lookup errors and disabled
 * reasons... distinguish empty data, permission denial, and network
 * failure"), swept across every picker in the app found silently
 * rendering as an empty dropdown on a 403/network failure — indistinguishable
 * from "there's genuinely nothing to pick from." A full-page EmptyState is
 * the wrong weight here: the page/form around the picker is otherwise
 * perfectly usable, only this one lookup failed.
 *
 * `failed` is an array of `{ label, isError }` — only the ones with
 * `isError: true` are rendered, one line each, so a caller can pass every
 * picker's query result unconditionally without its own `isError &&` guard.
 */
export default function PickerLoadWarning({ failed }) {
  const names = failed.filter((f) => f.isError).map((f) => f.label);
  if (names.length === 0) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
      Couldn&apos;t load {names.join(', ')} — you may be missing read access to it. Ask an admin to check Section
      Access.
    </p>
  );
}
