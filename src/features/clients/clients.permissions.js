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

/** Can this viewer edit THIS specific client? Needs Write on 'clientsManage'
 *  (the PATCH route's own gate); a Coordinator holding it may still only edit
 *  a client they added that isn't approved yet — the service's rule. */
export function canEditClient(user, client) {
  if (!user.sectionAccessWrite?.includes('clientsManage')) return false;
  if (user.role !== 'Coordinator') return true;
  return client.createdBy?._id === user.id && client.approvalStatus !== 'Approved';
}
