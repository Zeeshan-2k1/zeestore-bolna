import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NdrReason, PaymentType, ShipmentStatus } from "@/lib/constants";
import {
  buildShipmentOrderBy,
  buildShipmentWhere,
  parseShipmentListParams,
} from "@/lib/shipment-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = parseShipmentListParams(searchParams);
  const where = buildShipmentWhere(params);
  const orderBy = buildShipmentOrderBy(params);
  const skip = (params.page - 1) * params.limit;

  const [shipments, total] = await Promise.all([
    db.shipment.findMany({
      where,
      orderBy,
      skip,
      take: params.limit,
      include: {
        calls: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            outcome: true,
            createdAt: true,
          },
        },
      },
    }),
    db.shipment.count({ where }),
  ]);

  const enriched = shipments.map((s) => ({
    ...s,
    lastCallAt: s.calls[0]?.createdAt ?? null,
  }));

  return NextResponse.json({
    shipments: enriched,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit) || 1,
    },
    sort: params.sort,
    order: params.order,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const required = [
    "customerName",
    "phone",
    "orderId",
    "productSummary",
    "orderAmount",
    "address",
    "addressShort",
    "ndrReason",
  ] as const;

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing field: ${field}` },
        { status: 400 },
      );
    }
  }

  const awb =
    body.awb ??
    `AWB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

  const shipment = await db.shipment.create({
    data: {
      awb,
      orderId: body.orderId,
      customerName: body.customerName,
      phone: body.phone,
      productSummary: body.productSummary,
      orderAmount: Number(body.orderAmount),
      paymentType: body.paymentType ?? PaymentType.COD,
      address: body.address,
      addressShort: body.addressShort,
      ndrReason: body.ndrReason ?? NdrReason.CUSTOMER_UNAVAILABLE,
      languagePref: body.languagePref ?? "hi-en",
      brandName: body.brandName ?? "QuickCart",
      incentiveText: body.incentiveText ?? "Free reattempt tomorrow",
      deliveryDate: body.deliveryDate
        ? new Date(body.deliveryDate)
        : new Date(),
      status: ShipmentStatus.NDR_PENDING,
    },
  });

  return NextResponse.json({ shipment }, { status: 201 });
}
