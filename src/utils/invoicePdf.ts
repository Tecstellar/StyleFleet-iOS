import { Bill } from '../types/domain';
import { inrFromMinor } from './format';

interface InvoiceHtmlParams {
  bill: Bill;
  shopName: string;
  shopAddress?: string;
  shopGstin?: string;
  shopLogoUrl?: string | null;
  customerPhone?: string | null;
}

export const generateInvoiceHtml = ({
  bill,
  shopName,
  shopAddress,
  shopGstin,
  shopLogoUrl,
  customerPhone,
}: InvoiceHtmlParams): string => {
  const isPartiallyPaid = bill.status === 'partially_paid';
  const isPending = bill.status === 'pending';

  let paidMinor = bill.paid_amount_minor;
  let dueMinor = bill.due_amount_minor;

  if (paidMinor === undefined || dueMinor === undefined) {
    if (bill.notes && bill.notes.includes('due:')) {
      const dueMatch = bill.notes.match(/due:(\d+)/);
      const paidMatch = bill.notes.match(/paid:(\d+)/);
      if (dueMatch) dueMinor = parseInt(dueMatch[1], 10);
      if (paidMatch) paidMinor = parseInt(paidMatch[1], 10);
    }
  }

  if (isPending) {
    paidMinor = 0;
    dueMinor = dueMinor ?? bill.total_minor;
  } else if (isPartiallyPaid) {
    dueMinor = dueMinor ?? 0;
    paidMinor = paidMinor ?? Math.max(0, bill.total_minor - dueMinor);
  } else {
    paidMinor = paidMinor ?? bill.total_minor;
    dueMinor = 0;
  }

  const itemsRows = bill.items
    .map(
      (it) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827;">${it.service_name_snapshot}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: center; color: #4b5563;">${it.quantity || 1}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: right; color: #111827; font-weight: 500;">${inrFromMinor(it.unit_price_minor)}</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Invoice - ${bill.invoice_number}</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-wrapper {
      max-width: 780px;
      margin: 0 auto;
      padding: 24px;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .invoice-wrapper {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 16px;
    }
    .shop-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 6px 0;
      color: #000000;
    }
    .shop-meta {
      font-size: 13px;
      font-weight: 500;
      color: #334155;
      margin: 0 0 4px 0;
      line-height: 1.4;
    }
    .logo-img {
      width: 72px;
      height: 72px;
      border-radius: 10px;
      object-fit: cover;
      border: 1.5px solid #cbd5e1;
    }
    .logo-box {
      width: 64px;
      height: 64px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      letter-spacing: 1px;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .detail-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      font-weight: 700;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 700;
      color: #000000;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0f172a;
      background: #f8fafc;
      padding: 10px 8px;
      border-top: 1.5px solid #0f172a;
      border-bottom: 1.5px solid #0f172a;
      font-weight: 800;
    }
    .totals {
      width: 320px;
      margin-left: auto;
      margin-bottom: 24px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 18px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 14px;
      color: #334155;
      font-weight: 500;
    }
    .total-row.grand {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      margin-top: 8px;
      padding-top: 10px;
      padding-bottom: 10px;
      font-size: 18px;
      font-weight: 800;
      color: #000000;
    }
    .paid-badge {
      display: inline-block;
      background: #dcfce7;
      color: #14532d;
      border: 1.5px solid #16a34a;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .partial-badge {
      display: inline-block;
      background: #fef3c7;
      color: #78350f;
      border: 1.5px solid #d97706;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .pending-badge {
      display: inline-block;
      background: #fee2e2;
      color: #7f1d1d;
      border: 1.5px solid #dc2626;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1.5px dashed #cbd5e1;
      font-size: 12px;
      color: #475569;
      font-weight: 500;
    }
  </style>
</head>
<body>
<div class="invoice-wrapper">
  <div class="header">
    <div>
      <h1 class="shop-title">${shopName}</h1>
      <p class="shop-meta">${shopAddress || 'Premium Salon & Spa'}</p>
      ${shopGstin ? `<p class="shop-meta">GSTIN: ${shopGstin}</p>` : ''}
    </div>
    <div>
      ${
        shopLogoUrl
          ? `<img src="${shopLogoUrl}" class="logo-img" alt="Logo" />`
          : `<div class="logo-box">${shopName.slice(0, 2).toUpperCase()}</div>`
      }
    </div>
  </div>

  <div class="invoice-details">
    <div class="detail-group">
      <span class="detail-label">Invoice Number</span>
      <span class="detail-value">${bill.invoice_number}</span>
    </div>
    <div class="detail-group">
      <span class="detail-label">Date & Time</span>
      <span class="detail-value">${bill.issued_at}</span>
    </div>
    <div class="detail-group">
      <span class="detail-label">Customer</span>
      <span class="detail-value">${bill.customer_name}${customerPhone ? ` · ${customerPhone}` : ''}</span>
    </div>
    <div class="detail-group">
      <span class="detail-label">Stylist</span>
      <span class="detail-value">${bill.staff_name}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 58%;">Service / Description</th>
        <th style="text-align: center; width: 14%;">Qty</th>
        <th style="text-align: right; width: 28%;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span style="font-weight: 700; color: #000000;">${inrFromMinor(bill.subtotal_minor)}</span>
    </div>
    ${
      bill.discount_minor > 0
        ? `
    <div class="total-row" style="color: #b45309; font-weight: 600;">
      <span>Discount</span>
      <span>- ${inrFromMinor(bill.discount_minor)}</span>
    </div>`
        : ''
    }
    ${
      bill.tax_minor > 0
        ? `
    <div class="total-row" style="color: #475569;">
      <span>GST (18%)</span>
      <span>${inrFromMinor(bill.tax_minor)}</span>
    </div>`
        : ''
    }
    <div class="total-row grand">
      <span>Total Amount</span>
      <span>${inrFromMinor(bill.total_minor)}</span>
    </div>
    <div class="total-row" style="color: ${paidMinor > 0 ? '#15803d' : '#475569'}; font-weight: 700;">
      <span>Amount Paid${paidMinor > 0 ? ` (${bill.payment_method.toUpperCase()})` : ''}</span>
      <span>${inrFromMinor(paidMinor)}</span>
    </div>
    <div class="total-row" style="color: ${dueMinor > 0 ? '#b91c1c' : '#475569'}; font-weight: ${dueMinor > 0 ? '800' : '600'}; ${dueMinor > 0 ? 'border-top: 1px dashed #fca5a5; margin-top: 6px; padding-top: 6px;' : ''}">
      <span>Amount Due</span>
      <span>${inrFromMinor(dueMinor)}</span>
    </div>
    <div style="text-align: right; margin-top: 10px;">
      ${
        isPartiallyPaid
          ? `<span class="partial-badge">PARTIALLY PAID · DUE ${inrFromMinor(dueMinor)}</span>`
          : isPending
          ? `<span class="pending-badge">PENDING / UNPAID</span>`
          : `<span class="paid-badge">PAID · ${bill.payment_method.toUpperCase()}</span>`
      }
    </div>
  </div>

  <div class="footer">
    <p style="margin: 0; font-weight: 600;">Thank you for choosing ${shopName}!</p>
    <p style="font-size: 11px; margin-top: 4px; color: #94a3b8;">Powered by StyleFleet Salon OS</p>
  </div>
</div>
</body>
</html>
`;
};
