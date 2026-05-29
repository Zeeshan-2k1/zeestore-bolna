import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiErrorResponse } from "@/lib/api-response";
import { db } from "@/lib/db";
import {
  CodFailureReason,
  PaymentType,
  ShipmentStatus,
} from "@/lib/constants";
import { parseShipmentListParams } from "@/lib/shipment-query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseShipmentListParams(searchParams);
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.OrderWhereInput = {
      paymentType: PaymentType.COD,
    };
    if (params.status) where.status = params.status;
    if (params.ndrReason) where.failureReason = params.ndrReason;
    if (params.search) {
      where.OR = [
        { orderRef: { contains: params.search } },
        { awb: { contains: params.search } },
        { user: { is: { firstName: { contains: params.search } } } },
        { user: { is: { lastName: { contains: params.search } } } },
        { user: { is: { phone: { contains: params.search } } } },
        { user: { is: { email: { contains: params.search } } } },
        { productSummary: { contains: params.search } },
      ];
    }

    const orderBy =
      params.sort === "product"
        ? [{ orderAmount: params.order }, { productSummary: params.order }]
        : params.sort === "deliveryDate"
          ? { expectedDeliveryDate: params.order }
          : params.sort === "awb"
            ? { awb: params.order }
            : { orderDate: params.order };
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip,
        take: params.limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          calls: {
            where: { segment: "COD" },
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
      db.order.count({ where }),
    ]);

    const enriched = orders.map((o) => ({
      id: o.id,
      orderRef: o.orderRef,
      awb: o.awb,
      customerName:
        [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || "Unknown",
      phone: o.user.phone ?? "—",
      email: o.user.email ?? null,
      productSummary: o.productSummary,
      orderAmount: o.orderAmount,
      status: o.status,
      failureReason: o.failureReason,
      expectedDeliveryDate: o.expectedDeliveryDate.toISOString(),
      orderDate: o.orderDate.toISOString(),
      lastCallAt: o.calls[0]?.createdAt.toISOString() ?? null,
    }));

    return NextResponse.json({
      orders: enriched,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load COD orders");
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const required = ["orderRef", "productSummary", "orderAmount", "address", "addressShort"] as const;

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const awb = body.awb ?? `COD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

  const user = await db.user.upsert({
    where: {
      shopifyCustomerId:
        body.shopifyCustomerId ?? `cod_${body.orderRef}_${String(body.phone ?? "")}`,
    },
    update: {
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      source: "SHOPIFY",
    },
    create: {
      shopifyCustomerId:
        body.shopifyCustomerId ?? `cod_${body.orderRef}_${String(body.phone ?? "")}`,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      source: "SHOPIFY",
    },
  });

  const order = await db.order.create({
    data: {
      userId: user.id,
      productId: body.productId ?? undefined,
      orderRef: body.orderRef,
      awb,
      productSummary: body.productSummary,
      orderAmount: Number(body.orderAmount),
      paymentType: PaymentType.COD,
      address: body.address,
      addressShort: body.addressShort,
      failureReason: body.reason ?? CodFailureReason.CALL_NOT_PICKED,
      languagePref: body.languagePref ?? "hi-en",
      brandName: body.brandName ?? "QuickCart",
      status: body.status ?? ShipmentStatus.COD_PENDING,
      expectedDeliveryDate: body.expectedDeliveryDate
        ? new Date(body.expectedDeliveryDate)
        : new Date(),
      orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}

