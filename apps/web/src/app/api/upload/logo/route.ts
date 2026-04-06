import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG and JPG files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 }
    );
  }

  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Remove old logos for this tenant
  const tenantId = session.user.tenantId;
  for (const ext of ["png", "jpg", "jpeg"]) {
    const oldPath = path.join(UPLOAD_DIR, `logo-${tenantId}.${ext}`);
    if (existsSync(oldPath)) {
      await unlink(oldPath);
    }
  }

  // Save new logo
  const ext = file.type === "image/png" ? "png" : "jpg";
  const filename = `logo-${tenantId}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filepath, bytes);

  const logoPath = `/uploads/${filename}`;

  return NextResponse.json({ logoPath });
}
