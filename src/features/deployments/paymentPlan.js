/**
 * Recording a payment against invoices the recorder picks, in order
 * (2026-10-13): the helpers the Payments Due form and the approval queue share.
 * They mirror paymentAllocation.js on the server, which is the real authority
 * (it re-plans from the picked order and refuses anything outstanding-less);
 * this only previews what the payment will do.
 *
 * An "invoice" is every invoiced entry sharing one invoice number for that
 * party, as `invoiceKey` on each entry of the party's detail says.
 */
const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** One row per invoice that still has a balance, oldest first. */
export function outstandingInvoices(entries = []) {
  const groups = new Map();
  for (const e of [...entries].sort((a, b) => new Date(a.invoiceSentAt) - new Date(b.invoiceSentAt))) {
    if (e.balanceDue <= 0) continue;
    const g = groups.get(e.invoiceKey) ?? {
      invoiceKey: e.invoiceKey,
      invoiceNumber: e.invoiceNumber ?? null,
      invoiceDate: e.invoiceDate ?? null,
      workerNames: [],
      balanceDue: 0,
    };
    g.balanceDue = money(g.balanceDue + e.balanceDue);
    if (!g.workerNames.includes(e.workerName)) g.workerNames.push(e.workerName);
    groups.set(e.invoiceKey, g);
  }
  return [...groups.values()];
}

/** What a payment of `amount` (plus the account's `credit`) does to the picked
 *  invoices, in the order picked: each takes what it still owes until the money
 *  runs out; what is left stays credit. */
export function previewPayment({ amount, credit, pickedKeys, outstanding }) {
  let available = money((Number(amount) || 0) + (Number(credit) || 0));
  const byKey = new Map(outstanding.map((g) => [g.invoiceKey, g]));
  const rows = [];
  for (const key of pickedKeys) {
    const invoice = byKey.get(key);
    if (!invoice) continue;
    const covers = money(Math.min(available, invoice.balanceDue));
    available = money(available - covers);
    rows.push({ ...invoice, covers, left: money(invoice.balanceDue - covers) });
  }
  return { rows, leftover: available };
}

/** "INV-A 4,000.00 · INV-B 1,000.00": where a recorded payment was applied. */
export function appliedToText(allocations = [], formatMoney) {
  return allocations.map((a) => `${a.invoiceNumber ?? '-'} ${formatMoney(a.amount)}`).join(' \u00b7 ');
}
