import { NdrReason, PaymentType } from "./constants";

export type CsvShipmentRow = {
  awb?: string;
  orderId: string;
  customerName: string;
  phone: string;
  productSummary: string;
  orderAmount: number;
  paymentType: string;
  address: string;
  addressShort: string;
  ndrReason: string;
  languagePref: string;
  brandName: string;
  incentiveText?: string;
};

const REQUIRED = [
  "orderId",
  "customerName",
  "phone",
  "productSummary",
  "orderAmount",
  "address",
  "addressShort",
] as const;

const HEADER_ALIASES: Record<string, keyof CsvShipmentRow | "ndrReason"> = {
  awb: "awb",
  order_id: "orderId",
  orderid: "orderId",
  order: "orderId",
  customer_name: "customerName",
  customername: "customerName",
  customer: "customerName",
  phone: "phone",
  mobile: "phone",
  product: "productSummary",
  product_summary: "productSummary",
  productsummary: "productSummary",
  amount: "orderAmount",
  order_amount: "orderAmount",
  orderamount: "orderAmount",
  payment_type: "paymentType",
  paymenttype: "paymentType",
  payment: "paymentType",
  address: "address",
  address_short: "addressShort",
  addressshort: "addressShort",
  short_address: "addressShort",
  ndr_reason: "ndrReason",
  ndrreason: "ndrReason",
  reason: "ndrReason",
  language: "languagePref",
  language_pref: "languagePref",
  brand: "brandName",
  incentive: "incentiveText",
  incentive_text: "incentiveText",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Minimal RFC4180-style CSV parser */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
      if (ch === "\r") i++;
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

export function csvToShipments(text: string): {
  rows: CsvShipmentRow[];
  errors: { line: number; message: string }[];
} {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: "CSV must have header + data rows" }],
    };
  }

  const headers = grid[0].map(normalizeHeader);
  const colMap: (keyof CsvShipmentRow | null)[] = headers.map((h) => {
    const key = HEADER_ALIASES[h];
    return key ?? null;
  });

  const rows: CsvShipmentRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < grid.length; i++) {
    const line = grid[i];
    const record: Record<string, string> = {};

    colMap.forEach((key, idx) => {
      if (key && line[idx]) record[key] = line[idx];
    });

    const missing = REQUIRED.filter((f) => !record[f]);
    if (missing.length > 0) {
      errors.push({
        line: i + 1,
        message: `Missing: ${missing.join(", ")}`,
      });
      continue;
    }

    const amount = parseInt(
      String(record.orderAmount).replace(/[^\d]/g, ""),
      10,
    );
    if (Number.isNaN(amount) || amount <= 0) {
      errors.push({ line: i + 1, message: "Invalid orderAmount" });
      continue;
    }

    let phone = record.phone.replace(/\s/g, "");
    if (!phone.startsWith("+")) {
      phone = phone.startsWith("91") ? `+${phone}` : `+91${phone}`;
    }

    const ndr = record.ndrReason?.toUpperCase().replace(/\s/g, "_") ?? "";
    const validNdr = Object.values(NdrReason).includes(
      ndr as (typeof NdrReason)[keyof typeof NdrReason],
    )
      ? ndr
      : NdrReason.CUSTOMER_UNAVAILABLE;

    const pay = (record.paymentType ?? "COD").toUpperCase();
    const paymentType =
      pay === PaymentType.PREPAID ? PaymentType.PREPAID : PaymentType.COD;

    rows.push({
      awb: record.awb,
      orderId: record.orderId,
      customerName: record.customerName,
      phone,
      productSummary: record.productSummary,
      orderAmount: amount,
      paymentType,
      address: record.address,
      addressShort: record.addressShort,
      ndrReason: validNdr,
      languagePref: record.languagePref ?? "hi-en",
      brandName: record.brandName ?? "QuickCart",
      incentiveText: record.incentiveText ?? "Free reattempt tomorrow",
    });
  }

  return { rows, errors };
}

export const CSV_TEMPLATE = `awb,orderId,customerName,phone,productSummary,orderAmount,paymentType,address,addressShort,ndrReason,languagePref
,ORD-90001,Ramesh Kumar,+919876543210,Running shoes,2499,COD,"42 Koramangala, Bengaluru",Koramangala,CUSTOMER_UNAVAILABLE,hi-en
`;
