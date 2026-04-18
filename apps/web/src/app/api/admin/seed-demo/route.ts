import { NextResponse } from "next/server";
import { runDemoSeed } from "../../../../../drizzle/seed-demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-time demo data bootstrap for fresh deployments. Guarded by a
// SEED_TOKEN env var that must match the `?token=` query parameter. The
// route runs the same seed as `npm run db:seed-demo` (TRUNCATE + insert),
// so it is safe to call repeatedly but DESTROYS existing data. Unset
// SEED_TOKEN after seeding to disable the endpoint.
export async function GET(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "seed endpoint is disabled" },
      { status: 404 }
    );
  }

  const token = new URL(req.url).searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const logs: string[] = [];
    const summary = await runDemoSeed((msg) => logs.push(msg));
    return NextResponse.json({ ok: true, summary, logs });
  } catch (err) {
    console.error("Demo seed failed:", err);
    return NextResponse.json(
      {
        error: "seed failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
