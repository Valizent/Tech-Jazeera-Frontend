/**
 * Shared audit-action vocabulary — one place mapping every `action` string
 * `logAudit()` writes anywhere in the app to a human label and a severity
 * variant. Used by both the dashboard's compact "Recent activity" widget and
 * the full Security Log page, so the two never drift into describing the
 * same action differently.
 *
 * `variant` is a coloring hint for a security audience scanning for trouble:
 * 'danger' = a failure or a theft/reuse signal, 'warning' = a destructive or
 * privileged action worth double-checking, 'default' = routine.
 */
export const ACTION_LABELS = {
  'auth.login.success': 'signed in',
  'auth.login.failed': 'failed to sign in',
  'auth.logout': 'signed out',
  'auth.refresh.reuse_detected': 'refresh token reuse detected — sessions revoked',

  'employee.create': 'added an employee',
  'employee.update': 'updated an employee',
  'employee.delete': 'deleted an employee',
  'user.provision.worker': 'created a worker login',

  'client.create': 'added a client',
  'client.update': 'updated a client',
  'client.delete': 'deleted a client',
  'client.resubmit': 'resubmitted a client for approval',
  'client.approved': 'approved a client',
  'client.rejected': 'rejected a client',

  'deployment.create': 'created a deployment',
  'deployment.release': 'demobilised a deployment',
  'deployment.delete': 'deleted a deployment',
  'deployment.monthlyHours.add': 'entered monthly hours',
  'deployment.monthlyHours.update': 'corrected monthly hours',
  'deployment.monthlyHours.correctApproved': 'corrected approved monthly hours',
  'deployment.monthlyHours.decide': 'decided a monthly hours entry',

  'attendance.mark': 'marked attendance',
  'attendance.checkin': 'signed in',
  'attendance.checkout': 'signed out',
  'staffAttendance.checkin': 'signed in',
  'staffAttendance.checkout': 'signed out',

  'document.create': 'uploaded a document',
  'document.version': 'added a document version',
  'document.delete': 'deleted a document',

  'quotation.create': 'created a quotation',
  'quotation.update': 'updated a quotation',
  'quotation.duplicate': 'duplicated a quotation',
  'quotation.delete': 'deleted a quotation',

  'user.provision.staff': 'created a staff login',
  'user.update.staff': 'updated a staff account',
  'user.delete.staff': 'deleted a staff login',
  'user.avatar.update': 'updated their profile photo',
  'user.avatar.remove': 'removed their profile photo',

  'leaveType.create': 'created a leave type',
  'leaveType.update': 'updated a leave type',
  'leave.request.auto_approved': 'leave request auto-approved',
  'leave.request.submitted': 'submitted a leave request',
  'leave.request.approved': 'approved a leave request',
  'leave.request.rejected': 'rejected a leave request',
  'leave.request.acknowledged': 'acknowledged a leave request',
  'leave.request.cancelled': 'cancelled a leave request',

  'nfc.company.create': 'added an NFC company',
  'nfc.company.update': 'updated an NFC company',
  'nfc.company.delete': 'deleted an NFC company',
  'nfc.company.logo': 'uploaded an NFC company logo',
  'nfc.company.logo.remove': 'removed an NFC company logo',
  'nfc.employee.create': 'added an NFC contact',
  'nfc.employee.update': 'updated an NFC contact',
  'nfc.employee.delete': 'deleted an NFC contact',
  'nfc.employee.photo': 'uploaded an NFC contact photo',
  'nfc.employee.photo.remove': 'removed an NFC contact photo',
  'nfc.batch.generate': 'generated an NFC card batch',
  'nfc.card.update': 'updated an NFC card',
  'nfc.card.assign': 'assigned an NFC card',
  'nfc.card.assignCompany': 'assigned an NFC card to a company',
  'nfc.card.rotate': 'rotated an NFC card token',
  'nfc.card.delete': 'deleted an NFC card',

  'timesheet.export': 'exported a timesheet',

  'admin.fresh_start_cleanup': 'ran a bulk data cleanup',
};

const DANGER_ACTIONS = new Set(['auth.login.failed', 'auth.refresh.reuse_detected']);
const WARNING_SUFFIXES = ['.delete', '.remove', 'cleanup', '.rejected'];

export function describeAction(action) {
  return ACTION_LABELS[action] ?? action.replace(/\./g, ' ');
}

export function actionVariant(action) {
  if (DANGER_ACTIONS.has(action)) return 'danger';
  if (WARNING_SUFFIXES.some((suffix) => action.includes(suffix))) return 'warning';
  return 'default';
}
