import { NextRequest, NextResponse } from "next/server";
import { buildSubmission, listSubmissions, persistSubmission } from "@/lib/store";
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

  const record = buildSubmission({
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

  // 저장과 이메일 발송은 서로 독립적으로 시도한다 — 한쪽이 실패해도
  // 다른 쪽까지 막히면 안 된다 (특히 이메일은 담당자가 신청을 확인하는
  // 사실상의 1차 채널이라 저장 실패 때문에 못 가는 일이 없어야 한다).
  let saved = true;
  try {
    await persistSubmission(record);
  } catch (err) {
    saved = false;
    console.error("[apply] 신청 저장 실패:", err);
  }

  let emailSent = true;
  try {
    await sendNotificationEmail(record);
  } catch (err) {
    emailSent = false;
    console.error("[apply] 이메일 발송 실패:", err);
  }

  if (!saved && !emailSent) {
    return NextResponse.json(
      { error: "신청 접수에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ submission: record, emailSent, saved });
}
