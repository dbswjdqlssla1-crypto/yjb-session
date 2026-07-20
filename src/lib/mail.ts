import nodemailer from "nodemailer";
import type { Submission } from "./store";

export async function sendNotificationEmail(submission: Submission) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFY_EMAIL) {
    throw new Error("SMTP env vars are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const refLines = submission.hasReference
    ? submission.references.filter(Boolean).map((r, i) => `  ${i + 1}. ${r}`).join("\n")
    : "  없음";

  const dueRange =
    submission.startDate && submission.endDate
      ? `${submission.startDate} ~ ${submission.endDate}`
      : submission.startDate || submission.endDate || "미지정";

  const text = `새로운 세션 시트 접수가 도착했습니다.

접수 번호: ${submission.id}
접수 시각: ${submission.createdAt}

01. 멜로디 유무: ${submission.hasMelody ? "O" : "X"}
02. 가사 유무: ${submission.hasLyrics ? "O" : "X"}
03. 레퍼런스 유무: ${submission.hasReference ? "O" : "X"}
레퍼런스:
${refLines}

이름: ${submission.name}
연락처: ${submission.contact}
희망 납기: ${dueRange}

추가 요청사항:
${submission.notes || "(없음)"}
`;

  await transporter.sendMail({
    from: SMTP_USER,
    to: NOTIFY_EMAIL,
    subject: `[세션 시트] 새 의뢰 접수 - ${submission.name} (${submission.id})`,
    text,
  });
}
