import { NextRequest, NextResponse } from "next/server";
import { getDriveImage, uploadDriveImage } from "@/lib/sheets";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const mahsulotId = (form.get("mahsulotId") as string) || "img";
    if (!file) return NextResponse.json({ error: "Fayl kerak" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ts  = Date.now().toString().slice(-6);
    const fileName = `${mahsulotId}.Rasm.${ts}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const path   = await uploadDriveImage(fileName, buffer, file.type || "image/jpeg");

    return NextResponse.json({ path });
  } catch (error) {
    console.error("Rasm yuklash xatosi:", error);
    return NextResponse.json({ error: "Rasm yuklanmadi" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path parametri kerak" }, { status: 400 });
  }

  try {
    const result = await getDriveImage(path);
    if (!result) {
      return NextResponse.json({ error: "Rasm topilmadi" }, { status: 404 });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Rasm yuklash xatosi:", error);
    return NextResponse.json({ error: "Rasm yuklanmadi" }, { status: 500 });
  }
}
