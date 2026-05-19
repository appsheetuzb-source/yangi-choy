import { NextRequest, NextResponse } from "next/server";
import { getDriveImage } from "@/lib/sheets";
import { Readable } from "stream";

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
