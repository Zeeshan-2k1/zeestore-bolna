import { LeadIntent, ShopifyEventName } from "./constants";

export type NumericOp = "gt" | "lt" | "eq";
export type EqualityOp = "eq" | "neq";
export type InclusionOp = "in" | "not_in" | "eq";
export type DateOp = "gt" | "lt";

export type NumericFilter = { op: NumericOp; value: number };
export type EqualityFilter = { op: EqualityOp; value: string };
export type InclusionFilter = { op: InclusionOp; values: string[] };
export type DateFilter = { op: DateOp; value: string };

export type LeadDialerFilters = {
  score?: NumericFilter;
  intent?: EqualityFilter;
  lastEvent?: InclusionFilter;
  date?: DateFilter;
};

export type NdrDialerFilters = {
  cost?: NumericFilter;
  status?: EqualityFilter;
  reasonStatus?: EqualityFilter;
  date?: DateFilter;
};

export type CodDialerFilters = {
  productPrice?: NumericFilter;
  status?: EqualityFilter;
  orderDate?: DateFilter;
  deliveryDate?: DateFilter;
};

export type DialerFilters = {
  leads?: LeadDialerFilters;
  ndr?: NdrDialerFilters;
  cod?: CodDialerFilters;
};

const ALLOWED_LAST_EVENTS = new Set<string>(Object.values(ShopifyEventName));
const ALLOWED_INTENTS = new Set<string>(Object.values(LeadIntent));

function isNumericFilter(v: unknown): v is NumericFilter {
  if (!v || typeof v !== "object") return false;
  const x = v as NumericFilter;
  return ["gt", "lt", "eq"].includes(x.op) && Number.isFinite(x.value);
}

function isEqualityFilter(v: unknown): v is EqualityFilter {
  if (!v || typeof v !== "object") return false;
  const x = v as EqualityFilter;
  return ["eq", "neq"].includes(x.op) && typeof x.value === "string";
}

function isInclusionFilter(v: unknown): v is InclusionFilter {
  if (!v || typeof v !== "object") return false;
  const x = v as InclusionFilter;
  return (
    ["in", "not_in", "eq"].includes(x.op) &&
    Array.isArray(x.values) &&
    x.values.every((s) => typeof s === "string")
  );
}

function isDateFilter(v: unknown): v is DateFilter {
  if (!v || typeof v !== "object") return false;
  const x = v as DateFilter;
  return (
    ["gt", "lt"].includes(x.op) &&
    typeof x.value === "string" &&
    !Number.isNaN(new Date(x.value).getTime())
  );
}

export function parseDialerFilters(raw: string | null | undefined): DialerFilters {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as DialerFilters;
    const out: DialerFilters = {};
    if (data.ndr) {
      out.ndr = {};
      if (isNumericFilter(data.ndr.cost)) out.ndr.cost = data.ndr.cost;
      if (isEqualityFilter(data.ndr.status)) out.ndr.status = data.ndr.status;
      if (isEqualityFilter(data.ndr.reasonStatus)) {
        out.ndr.reasonStatus = data.ndr.reasonStatus;
      }
      if (isDateFilter(data.ndr.date)) out.ndr.date = data.ndr.date;
    }
    if (data.leads) {
      out.leads = {};
      if (isNumericFilter(data.leads.score)) out.leads.score = data.leads.score;
      if (
        isEqualityFilter(data.leads.intent) &&
        ALLOWED_INTENTS.has(data.leads.intent.value)
      ) {
        out.leads.intent = data.leads.intent;
      }
      if (isInclusionFilter(data.leads.lastEvent)) {
        out.leads.lastEvent = {
          op: data.leads.lastEvent.op,
          values: data.leads.lastEvent.values.filter((x) => ALLOWED_LAST_EVENTS.has(x)),
        };
      }
      if (isDateFilter(data.leads.date)) out.leads.date = data.leads.date;
    }
    if (data.cod) {
      out.cod = {};
      if (isNumericFilter(data.cod.productPrice)) out.cod.productPrice = data.cod.productPrice;
      if (isEqualityFilter(data.cod.status)) out.cod.status = data.cod.status;
      if (isDateFilter(data.cod.orderDate)) out.cod.orderDate = data.cod.orderDate;
      if (isDateFilter(data.cod.deliveryDate)) out.cod.deliveryDate = data.cod.deliveryDate;
    }
    return out;
  } catch {
    return {};
  }
}

export function stringifyDialerFilters(filters: DialerFilters | undefined): string | null {
  if (!filters) return null;
  const normalized = parseDialerFilters(JSON.stringify(filters));
  if (!normalized.ndr && !normalized.leads && !normalized.cod) return null;
  return JSON.stringify(normalized);
}

