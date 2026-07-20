import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

export type Submission = {
  id: string;
  createdAt: string;
  hasMelody: boolean;
  hasLyrics: boolean;
  hasReference: boolean;
  references: string[];
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  notes: string;
};

function makeId() {
  return `SS-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

// Vercel Marketplace에서 Upstash for Redis를 연결하면 KV_REST_API_* 이름으로
// 환경변수가 자동으로 채워진다 (구버전/직접 연동은 UPSTASH_REDIS_REST_* 사용).
// 둘 다 없으면(로컬 개발 등) 파일 저장소로 자동 폴백한다.
const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "session-sheet:submissions";

const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

async function listSubmissionsRedis(): Promise<Submission[]> {
  const raw = await redis!.lrange<string | Submission>(REDIS_KEY, 0, -1);
  return raw.map((item) => (typeof item === "string" ? (JSON.parse(item) as Submission) : item));
}

async function addSubmissionRedis(record: Submission): Promise<void> {
  await redis!.lpush(REDIS_KEY, JSON.stringify(record));
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function listSubmissionsFile(): Promise<Submission[]> {
  await ensureStoreFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as Submission[];
  } catch {
    return [];
  }
}

// 동시에 여러 명이 제출해도 파일 쓰기가 서로 덮어쓰지 않도록 요청을 한 줄로 직렬화한다.
// (Redis 경로는 LPUSH 자체가 원자적이라 큐가 필요 없다.)
let writeQueue: Promise<unknown> = Promise.resolve();

async function addSubmissionFile(record: Submission): Promise<void> {
  const task = writeQueue.then(async () => {
    await ensureStoreFile();
    const submissions = await listSubmissionsFile();
    submissions.unshift(record);
    await fs.writeFile(DATA_FILE, JSON.stringify(submissions, null, 2), "utf-8");
  });
  writeQueue = task.catch(() => {});
  await task;
}

export async function listSubmissions(): Promise<Submission[]> {
  return redis ? listSubmissionsRedis() : listSubmissionsFile();
}

export function buildSubmission(entry: Omit<Submission, "id" | "createdAt">): Submission {
  return {
    ...entry,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
}

export async function persistSubmission(record: Submission): Promise<void> {
  if (redis) {
    await addSubmissionRedis(record);
  } else {
    await addSubmissionFile(record);
  }
}

export async function addSubmission(
  entry: Omit<Submission, "id" | "createdAt">
): Promise<Submission> {
  const record = buildSubmission(entry);
  await persistSubmission(record);
  return record;
}
