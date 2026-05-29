import { NextResponse } from "next/server";
import { csvToShipments } from "@/lib/csv-import";
import { ShipmentStatus } from "@/lib/constants";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let csvText: string;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    csvText = await file.text();
  } else {
    const body = await request.json();
    if (!body.csv || typeof body.csv !== "string") {
      return NextResponse.json(
        { error: "Provide csv string or multipart file" },
        { status: 400 },
      );
    }
    csvText = body.csv;
  }

  const { rows, errors } = csvToShipments(csvText);

  if (rows.length === 0 && errors.length > 0) {
    return NextResponse.json({ imported: 0, errors }, { status: 400 });
  }

  const created: string[] = [];
  const importErrors = [...errors];

  for (const row of rows) {
    try {
      const awb =
        row.awb ??
        `AWB${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

      await db.shipment.create({
        data: {
          awb,
          orderId: row.orderId,
          customerName: row.customerName,
          phone: row.phone,
          productSummary: row.productSummary,
          orderAmount: row.orderAmount,
          paymentType: row.paymentType,
          address: row.address,
          addressShort: row.addressShort,
          ndrReason: row.ndrReason,
          languagePref: row.languagePref,
          brandName: row.brandName,
          incentiveText: row.incentiveText,
          status: ShipmentStatus.NDR_PENDING,
        },
      });
      created.push(awb);
    } catch (e) {
      importErrors.push({
        line: 0,
        message: `${row.orderId}: ${e instanceof Error ? e.message : "failed"}`,
      });
    }
  }

  return NextResponse.json({
    imported: created.length,
    awbs: created,
    errors: importErrors,
  });
}
