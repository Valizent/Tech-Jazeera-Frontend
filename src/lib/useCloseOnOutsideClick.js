import { useEffect, useRef } from 'react';

/** Returns a ref to attach to a dropdown/menu container — a click anywhere
 *  outside it while `open` is true calls `setOpen(false)`. Generic
 *  outside-click pattern (currently the avatar menu in both DashboardLayout
 *  and EssLayout); `setOpen` should be a real `useState` setter, whose
 *  identity React guarantees is stable across renders. */
export function useCloseOnOutsideClick(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, setOpen]);
  return ref;
}
