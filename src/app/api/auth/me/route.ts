import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";

export async function GET() {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.studentId,
      name: session.displayName,
      email: session.email ?? null,
      role: "member",
      status: "active",
    },
  });
}
