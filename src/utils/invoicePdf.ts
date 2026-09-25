import { Bill } from '../types/domain';
import { inrFromMinor } from './format';

interface InvoiceHtmlParams {
  bill: Bill;
  shopName: string;
  shopAddress?: string;
  shopGstin?: string;
  shopLogoUrl?: string | null;
}

export const generateInvoiceHtml = ({
  bill,
  shopName,
  shopAddress,
  shopGstin,
  shopLogoUrl,
}: InvoiceHtmlParams): string => {
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
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${bill.invoice_number}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 36px;
      color: #111827;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 2px solid #111827;
      padding-bottom: 20px;
    }
    .shop-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 6px 0;
      color: #0f172a;
    }
    .shop-meta {
      font-size: 13px;
      color: #64748b;
      line-height: 1.4;
      margin: 0;
    }
    .logo-img {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
    }
    .logo-box {
      width: 56px;
      height: 56px;
      background: #0f172a;
      color: #d9a441;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      border-radius: 8px;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 28px;
    }
    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .detail-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
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
      letter-spacing: 0.5px;
      color: #64748b;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .totals {
      width: 260px;
      margin-left: auto;
      margin-bottom: 30px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      color: #475569;
    }
    .total-row.grand {
      border-top: 2px solid #0f172a;
      margin-top: 8px;
      padding-top: 12px;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .paid-badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 6px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
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
      <span class="detail-value">${bill.customer_name}</span>
    </div>
    <div class="detail-group">
      <span class="detail-label">Stylist</span>
      <span class="detail-value">${bill.staff_name}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Service / Description</th>
        <th style="text-align: center; width: 15%;">Qty</th>
        <th style="text-align: right; width: 25%;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${inrFromMinor(bill.subtotal_minor)}</span>
    </div>
    ${
      bill.discount_minor > 0
        ? `
    <div class="total-row" style="color: #b45309;">
      <span>Discount</span>
      <span>- ${inrFromMinor(bill.discount_minor)}</span>
    </div>`
        : ''
    }
    ${
      bill.tax_minor > 0
        ? `
    <div class="total-row">
      <span>GST (18%)</span>
      <span>${inrFromMinor(bill.tax_minor)}</span>
    </div>`
        : ''
    }
    <div class="total-row grand">
      <span>Total Paid</span>
      <span>${inrFromMinor(bill.total_minor)}</span>
    </div>
    <div style="text-align: right;">
      <span class="paid-badge">PAID · ${bill.payment_method.toUpperCase()}</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for choosing ${shopName}!</p>
    <p style="font-size: 11px; margin-top: 4px;">Powered by Salon OS</p>
  </div>
</body>
</html>
`;
};
