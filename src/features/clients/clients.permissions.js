/**
 * Per-row client permission checks shared by every screen that lists or
 * opens a client (ClientListPage, ClientProfilePage, CoordinatorActivityPage).
 * Mirrors the exact rules client.service.js enforces server-side (Section
 * Access key 'clientsManage' governs create/update/decide) — these only
 * decide what to render; the server is the real gate.
 */

/** Can this viewer decide THIS specific pending client? Admin always; anyone
 *  else in the 'clientsManage' circle only for a submitter who actually
 *  reports to them (via the Coordinator's own linked Employee record —
 *  Employee.manager) — mirrors decideClient's own check exactly. */
export function canDecideClient(user, client) {
  if (client.approvalStatus !== 'Pending') return false;
  if (user.role === 'Admin') return true;
  if (!user.sectionAccessWrite?.includes('clientsManage')) return false;
  return client.createdBy?.employee?.manager === user.id;
}

/** Can this viewer edit THIS specific client? Anyone in the 'clientsManage'
 *  circle always; a Coordinator only their own, not-yet-approved
 *  submission (even without the grant — self-service submission). */
export function canEditClient(user, client) {
  if (user.sectionAccessWrite?.includes('clientsManage')) return true;
  return user.role === 'Coordinator' && client.createdBy?._id === user.id && client.approvalStatus !== 'Approved';
}
