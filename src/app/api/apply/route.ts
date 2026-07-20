import { NextRequest, NextResponse } from "next/server";
import { addSubmission, listSubmissions } from "@/lib/store";
import { sendNotificationEmail } from "@/lib/mail";

export async function GET() {
  const submissions = await listSubmissions();
  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    hasMelody,
    hasLyrics,
    hasReference,
    references,
    name,
    contact,
    startDate,
    endDate,
    notes,
  } = body;

  if (
    typeof hasMelody !== "boolean" ||
    typeof hasLyrics !== "boolean" ||
    typeof hasReference !== "boolean" ||
    typeof name !== "string" ||
    typeof contact !== "string"
  ) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }

  if (!name.trim() || !contact.trim()) {
    return NextResponse.json({ error: "이름과 연락처는 필수입니다." }, { status: 400 });
  }

  const start = typeof startDate === "string" ? startDate : "";
  const end = typeof endDate === "string" ? endDate : "";
  if (start && end && end < start) {
    return NextResponse.json(
      { error: "종료일은 시작일보다 빠를 수 없습니다." },
      { status: 400 }
    );
  }

  // 저장을 먼저 수행 — 이메일 발송이 실패해도 신청 데이터는 반드시 남는다.
  const record = await addSubmission({
    hasMelody,
    hasLyrics,
    hasReference,
    references: Array.isArray(references) ? references.slice(0, 3) : [],
    name: name.trim(),
    contact: contact.trim(),
    startDate: start,
    endDate: end,
    notes: typeof notes === "string" ? notes : "",
  });

  let emailSent = true;
  try {
    await sendNotificationEmail(record);
  } catch (err) {
    emailSent = false;
    console.error("[apply] 이메일 발송 실패:", err);
  }

  return NextResponse.json({ submission: record, emailSent });
}
