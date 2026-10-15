/**
 * Per-row subcontractor permission checks shared by the list and the profile. They mirror what
 * subcontractor.service.js enforces (Section Access 'subcontractorsManage' governs create/update/decide); the
 * server is the real gate, these only decide what to show.
 */

/** Can this viewer decide THIS pending subcontractor? The server works out whether they sit at the current step
 *  (or, with no hierarchy, are an Admin or Manager); the Write grant is still the floor. */
export function canDecideSubcontractor(user, subcontractor) {
  if (subcontractor.approvalStatus !== 'Pending') return false;
  return Boolean(subcontractor.canDecideCurrentStep) && (user.role === 'Admin' || Boolean(user.sectionAccessWrite?.includes('subcontractorsManage')));
}

/** Can this viewer edit THIS subcontractor? Admin and Manager always (with Write); anyone else only the one they
 *  added themselves, and only until it is approved (an edit sends it back for review). */
export function canEditSubcontractor(user, subcontractor) {
  if (!user.sectionAccessWrite?.includes('subcontractorsManage')) return false;
  if (user.role === 'Admin' || user.role === 'Manager') return true;
  return subcontractor.createdBy === user.id && subcontractor.approvalStatus !== 'Approved';
}
