/**
 * RequirementTag — the small "REQ-0007 · ACME" chip on a log entry that was
 * written on a Requirements card. A link to that card when the viewer can open
 * the board at all (`linked`); plain text otherwise, so it never leads to a
 * "no access" page.
 */
import { Link } from 'react-router-dom';

const CHIP = 'inline-flex max-w-full items-center truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15';

export default function RequirementTag({ requirement, linked }) {
  const label = `${requirement.serialNumber} · ${requirement.clientName}`;
  return linked ? (
    <Link to={`/requirements?open=${requirement._id}`} className={`${CHIP} hover:bg-primary/20`}>
      {label}
    </Link>
  ) : (
    <span className={CHIP}>{label}</span>
  );
}
