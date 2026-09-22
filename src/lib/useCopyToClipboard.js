import { useToast } from '../components/ui/Toast.jsx';

/**
 * A "copy this to the clipboard, toast the result" handler — extracted
 * 2026-09-22 (a real QA-audit finding: `EmployeeLoginPanel.jsx` and
 * `UserListPage.jsx` each had a byte-identical `copyPassword()` doing
 * exactly this for a just-issued temporary password). Generic over WHAT
 * text is copied and what success/failure copy to show, so it's reusable
 * beyond just passwords.
 */
export function useCopyToClipboard() {
  const toast = useToast();

  return async function copyToClipboard(
    text,
    { successMessage = 'Copied.', failureMessage = 'Could not copy — select and copy it manually.' } = {}
  ) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error(failureMessage);
    }
  };
}
