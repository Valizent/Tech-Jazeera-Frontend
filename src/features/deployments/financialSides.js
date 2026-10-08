/**
 * The Financial section's two money flows: what CLIENTS owe this company, and
 * what this company owes SUBCONTRACTORS. Each runs the same steps (an approved
 * month waiting on an invoice, invoiced months waiting on payment, paid in
 * bulk per party, the payment approval queue, the payment history), so one
 * page per step serves both sides, configured here.
 *
 * 2026-10-08: replaces three pairs of near-identical client/subcontractor
 * pages. The copies had drifted into real bugs: the subcontractor pages
 * shared the client pages' query keys (each briefly showed the other's
 * cached rows), the sub invoice was sent with its number/date/file dropped,
 * its copy downloaded through the client route, and "Review Pending
 * Payments" opened the client queue.
 *
 * Every `*Key` value is an i18n key; `ns` keys are per-page namespaces.
 */
import {
  decideClientPayment,
  decideSubcontractorPayment,
  downloadInvoiceFile,
  downloadSubInvoiceFile,
  getClientPaymentDetail,
  getPaidInvoices,
  getPaidSubInvoices,
  getPaymentsDue,
  getPendingPaymentsQueue,
  getReadyForSubInvoice,
  getReadyToInvoice,
  getSubPaymentsDue,
  getSubPendingPaymentsQueue,
  getSubcontractorPaymentDetail,
  recordClientPayment,
  recordSubInvoice,
  recordSubcontractorPayment,
  sendInvoice,
} from './deployments.api.js';

export const FINANCIAL_SIDES = {
  client: {
    // Ready to invoice
    readyKey: ['deployments', 'ready-to-invoice'],
    getReady: getReadyToInvoice,
    submitInvoice: sendInvoice,
    readyNs: 'staffDeployments.readyToInvoice',
    invoiceButtonKey: 'staffDeployments.detail.sendInvoiceButton',
    invoiceTitleKey: 'staffDeployments.detail.sendInvoiceModalTitle',
    invoiceMessageKey: 'staffDeployments.detail.sendInvoiceModalMessage',
    invoiceNumberLabelKey: 'staffDeployments.detail.invoiceNumberLabel',
    invoiceDateLabelKey: 'staffDeployments.detail.invoiceDateLabel',
    invoiceDateTooEarlyKey: 'staffDeployments.detail.invoiceDateTooEarly',
    invoicedToastKey: 'staffDeployments.detail.invoiceSentToast',
    // This company's own invoice numbering prefix.
    invoiceNumberPrefix: 'AJSCO-',
    readyAmount: (row) => row.revenue,
    // Payments due
    dueKey: ['deployments', 'payments-due'],
    getDue: getPaymentsDue,
    getDetail: getClientPaymentDetail,
    recordPayment: recordClientPayment,
    dueNs: 'staffDeployments.paymentsDue',
    // Payments approval queue
    pendingKey: ['deployments', 'pending-payments'],
    getPending: getPendingPaymentsQueue,
    decidePayment: decideClientPayment,
    reviewPath: '/financial/payments-review',
    reviewTitleKey: 'staffDeployments.paymentsReview.pageTitle',
    reviewDescriptionKey: 'staffDeployments.paymentsReview.pageDescription',
    unknownPartyKey: 'staffDeployments.paymentsReview.unknownClient',
    pendingPartyName: (payment) => payment.client?.companyName,
    // Paid
    paidKey: ['deployments', 'paid-invoices'],
    getPaid: getPaidInvoices,
    paidNs: 'staffDeployments.paidInvoices',
    // Common
    partyId: (row) => row.clientId,
    partyName: (row) => row.clientName,
    partyLabelKey: 'staffFinancial.clientWorker',
    searchKey: 'staffFinancial.searchClientWorker',
    searchPaidKey: 'staffFinancial.searchClientWorkerInvoice',
    downloadInvoice: downloadInvoiceFile,
  },
  subcontractor: {
    readyKey: ['deployments', 'ready-for-sub-invoice'],
    getReady: getReadyForSubInvoice,
    submitInvoice: recordSubInvoice,
    readyNs: 'staffDeployments.readyForSubInvoice',
    invoiceButtonKey: 'staffDeployments.detail.recordSubInvoiceButton',
    invoiceTitleKey: 'staffDeployments.detail.recordSubInvoiceModalTitle',
    invoiceMessageKey: 'staffDeployments.detail.recordSubInvoiceModalMessage',
    invoiceNumberLabelKey: 'staffDeployments.detail.subcontractorInvoiceNumberLabel',
    invoiceDateLabelKey: 'staffDeployments.detail.subcontractorInvoiceDateLabel',
    invoiceDateTooEarlyKey: 'staffDeployments.detail.subcontractorInvoiceDateTooEarly',
    invoicedToastKey: 'staffDeployments.detail.subInvoiceRecordedToast',
    // The subcontractor numbers their own invoices.
    invoiceNumberPrefix: '',
    // Their rate plus the worker's OT pay: the same figure their payment
    // ledger is allocated against (subcontractorInvoice.service.js).
    readyAmount: (row) => row.invoiceAmount,
    dueKey: ['deployments', 'sub-payments-due'],
    getDue: getSubPaymentsDue,
    getDetail: getSubcontractorPaymentDetail,
    recordPayment: recordSubcontractorPayment,
    dueNs: 'staffDeployments.subPaymentsDue',
    pendingKey: ['deployments', 'sub-pending-payments'],
    getPending: getSubPendingPaymentsQueue,
    decidePayment: decideSubcontractorPayment,
    reviewPath: '/financial/sub-payments-review',
    reviewTitleKey: 'staffDeployments.subPaymentsReview.pageTitle',
    reviewDescriptionKey: 'staffDeployments.subPaymentsReview.pageDescription',
    unknownPartyKey: 'staffDeployments.subPaymentsReview.unknownSubcontractor',
    pendingPartyName: (payment) => payment.subcontractor?.name,
    paidKey: ['deployments', 'paid-sub-invoices'],
    getPaid: getPaidSubInvoices,
    paidNs: 'staffDeployments.paidSubInvoices',
    partyId: (row) => row.subcontractorId,
    partyName: (row) => row.subcontractorName,
    partyLabelKey: 'staffFinancial.subcontractorWorker',
    searchKey: 'staffFinancial.searchSubWorker',
    searchPaidKey: 'staffFinancial.searchSubWorkerInvoice',
    downloadInvoice: downloadSubInvoiceFile,
  },
};
