import type { Prisma } from "@prisma/client";

export type ShipmentSortField =
  | "createdAt"
  | "product"
  | "awb"
  | "deliveryDate";

export type ShipmentListParams = {
  page?: number;
  limit?: number;
  sort?: ShipmentSortField;
  order?: "asc" | "desc";
  status?: string;
  ndrReason?: string;
  paymentType?: string;
  search?: string;
};

const SORTABLE: ShipmentSortField[] = [
  "createdAt",
  "product",
  "awb",
  "deliveryDate",
];

export function parseShipmentListParams(
  searchParams: URLSearchParams,
): Required<
  Pick<ShipmentListParams, "page" | "limit" | "sort" | "order">
> &
  ShipmentListParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(5, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );
  const sortParam = searchParams.get("sort") ?? "createdAt";
  const sort = SORTABLE.includes(sortParam as ShipmentSortField)
    ? (sortParam as ShipmentSortField)
    : "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  return {
    page,
    limit,
    sort,
    order,
    status: searchParams.get("status") ?? undefined,
    ndrReason: searchParams.get("ndrReason") ?? undefined,
    paymentType: searchParams.get("paymentType") ?? undefined,
    search: searchParams.get("search")?.trim() || undefined,
  };
}

export function buildShipmentWhere(
  params: ShipmentListParams,
): Prisma.ShipmentWhereInput {
  const and: Prisma.ShipmentWhereInput[] = [];

  if (params.status) {
    const statuses = params.status.split(",").filter(Boolean);
    if (statuses.length === 1) {
      and.push({ status: statuses[0] });
    } else if (statuses.length > 1) {
      and.push({ status: { in: statuses } });
    }
  }

  if (params.ndrReason) {
    and.push({ ndrReason: params.ndrReason });
  }

  if (params.paymentType) {
    and.push({ paymentType: params.paymentType });
  }

  if (params.search) {
    const q = params.search;
    and.push({
      OR: [
        { customerName: { contains: q } },
        { orderId: { contains: q } },
        { awb: { contains: q } },
        { phone: { contains: q } },
        { productSummary: { contains: q } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildShipmentOrderBy(
  params: Pick<ShipmentListParams, "sort" | "order">,
): Prisma.ShipmentOrderByWithRelationInput | Prisma.ShipmentOrderByWithRelationInput[] {
  const field = params.sort ?? "createdAt";
  const direction = params.order ?? "desc";

  // Product column: price first, then product name
  if (field === "product") {
    return [{ orderAmount: direction }, { productSummary: direction }];
  }

  return { [field]: direction };
}
