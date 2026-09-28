import PDFDocument from 'pdfkit';
import { formatMoney } from '../../utils/money.js';

export interface InvoicePdfData {
  business: {
    name: string;
    legalName?: string;
    taxId?: string;
    phone?: string;
    email?: string;
    address?: any;
    currency: string;
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    paymentStatus: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    currency: string;
    notes?: string;
    terms?: string;
  };
  customer?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
  };
  items: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    discountRate: number;
    taxRate: number;
    lineSubtotal: number;
    lineTotal: number;
  }>;
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const currency = data.invoice.currency || data.business.currency || 'USD';

      // Header: Business Information
      doc.fontSize(20).font('Helvetica-Bold').text(data.business.name, 40, 40);
      doc.fontSize(9).font('Helvetica').fillColor('#555555');

      let businessAddress = '';
      if (typeof data.business.address === 'object' && data.business.address !== null) {
        const { street, city, state, zip } = data.business.address;
        businessAddress = [street, city, state, zip].filter(Boolean).join(', ');
      } else if (typeof data.business.address === 'string') {
        businessAddress = data.business.address;
      }

      if (businessAddress) doc.text(businessAddress);
      if (data.business.phone) doc.text(`Phone: ${data.business.phone}`);
      if (data.business.email) doc.text(`Email: ${data.business.email}`);
      if (data.business.taxId) doc.text(`Tax ID / GST: ${data.business.taxId}`);

      // Invoice Badge / Header
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1E293B').text('INVOICE', 400, 40, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc.text(`Invoice No: ${data.invoice.invoiceNumber}`, 350, 70, { align: 'right' });
      doc.text(`Date: ${new Date(data.invoice.invoiceDate).toLocaleDateString()}`, 350, 85, { align: 'right' });
      if (data.invoice.dueDate) {
        doc.text(`Due Date: ${new Date(data.invoice.dueDate).toLocaleDateString()}`, 350, 100, { align: 'right' });
      }

      // Status Tag
      const statusColor = data.invoice.paymentStatus === 'PAID' ? '#16A34A' : data.invoice.paymentStatus === 'PARTIALLY_PAID' ? '#EA580C' : '#DC2626';
      doc.rect(480, 118, 75, 20).fill(statusColor);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF').text(data.invoice.paymentStatus, 480, 123, { width: 75, align: 'center' });

      // Horizontal line
      doc.moveTo(40, 150).lineTo(555, 150).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Bill To Section
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('BILL TO:', 40, 165);
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      if (data.customer) {
        doc.text(data.customer.name, 40, 180);
        if (data.customer.phone) doc.text(`Phone: ${data.customer.phone}`, 40, 195);
        if (data.customer.email) doc.text(`Email: ${data.customer.email}`, 40, 210);
        if (data.customer.taxNumber) doc.text(`Tax ID: ${data.customer.taxNumber}`, 40, 225);
        if (data.customer.address) doc.text(`Address: ${data.customer.address}`, 40, 240);
      } else {
        doc.text('Walk-in Customer / Cash Sale', 40, 180);
      }

      // Table Header
      const tableTop = 270;
      doc.rect(40, tableTop, 515, 24).fill('#F1F5F9');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B');
      doc.text('Item Description', 48, tableTop + 7, { width: 200 });
      doc.text('Qty', 255, tableTop + 7, { width: 40, align: 'right' });
      doc.text('Price', 305, tableTop + 7, { width: 60, align: 'right' });
      doc.text('Tax %', 375, tableTop + 7, { width: 45, align: 'right' });
      doc.text('Total', 430, tableTop + 7, { width: 120, align: 'right' });

      // Table Rows
      let y = tableTop + 30;
      doc.font('Helvetica').fontSize(9).fillColor('#334155');

      data.items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }

        const bg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, y - 5, 515, 20).fill(bg);
        doc.fillColor('#334155');

        doc.text(item.itemName, 48, y, { width: 200 });
        doc.text(Number(item.quantity).toFixed(2), 255, y, { width: 40, align: 'right' });
        doc.text(formatMoney(item.unitPrice, currency), 305, y, { width: 60, align: 'right' });
        doc.text(`${Number(item.taxRate).toFixed(1)}%`, 375, y, { width: 45, align: 'right' });
        doc.text(formatMoney(item.lineTotal, currency), 430, y, { width: 120, align: 'right' });

        y += 20;
      });

      // Totals section
      y += 15;
      doc.moveTo(350, y).lineTo(555, y).strokeColor('#CBD5E1').stroke();
      y += 10;

      const rightLabelX = 350;
      const rightValX = 450;
      const valWidth = 105;

      doc.fontSize(9).font('Helvetica').fillColor('#64748B');
      doc.text('Subtotal:', rightLabelX, y);
      doc.text(formatMoney(data.invoice.subtotal, currency), rightValX, y, { width: valWidth, align: 'right' });
      y += 16;

      if (data.invoice.discountAmount > 0) {
        doc.text('Discount:', rightLabelX, y);
        doc.text(`-${formatMoney(data.invoice.discountAmount, currency)}`, rightValX, y, { width: valWidth, align: 'right' });
        y += 16;
      }

      if (data.invoice.taxAmount > 0) {
        doc.text('Tax:', rightLabelX, y);
        doc.text(formatMoney(data.invoice.taxAmount, currency), rightValX, y, { width: valWidth, align: 'right' });
        y += 16;
      }

      doc.rect(345, y, 210, 26).fill('#F8FAFC');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A');
      doc.text('Grand Total:', rightLabelX, y + 6);
      doc.text(formatMoney(data.invoice.grandTotal, currency), rightValX, y + 6, { width: valWidth, align: 'right' });
      y += 32;

      doc.fontSize(9).font('Helvetica').fillColor('#16A34A');
      doc.text('Amount Paid:', rightLabelX, y);
      doc.text(formatMoney(data.invoice.amountPaid, currency), rightValX, y, { width: valWidth, align: 'right' });
      y += 16;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(data.invoice.balanceDue > 0 ? '#DC2626' : '#16A34A');
      doc.text('Balance Due:', rightLabelX, y);
      doc.text(formatMoney(data.invoice.balanceDue, currency), rightValX, y, { width: valWidth, align: 'right' });

      // Notes / Terms
      if (data.invoice.notes) {
        y += 35;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Notes:', 40, y);
        doc.font('Helvetica').fillColor('#475569').text(data.invoice.notes, 40, y + 14, { width: 300 });
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(
        'Thank you for your business! Generated by My Wallet Business Management System.',
        40,
        780,
        { align: 'center', width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
