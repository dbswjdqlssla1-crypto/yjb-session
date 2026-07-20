"use client";

import { useEffect, useRef, useState } from "react";
import type { Submission } from "@/lib/store";
import Reveal from "@/components/Reveal";

type OX = boolean | null;

function formatDueRange(s: Pick<Submission, "startDate" | "endDate">) {
  if (s.startDate && s.endDate) return `${s.startDate} ~ ${s.endDate}`;
  return s.startDate || s.endDate || "미지정";
}

function OXButtons({
  value,
  onChange,
}: {
  value: OX;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ox-row">
      <button
        type="button"
        className={`ox-btn${value === true ? " selected-o" : ""}`}
        onClick={() => onChange(true)}
        aria-pressed={value === true}
      >
        O
      </button>
      <button
        type="button"
        className={`ox-btn${value === false ? " selected-x" : ""}`}
        onClick={() => onChange(false)}
        aria-pressed={value === false}
      >
        X
      </button>
    </div>
  );
}

const SCENE_COUNT = 5;

type PlanKey = "compose" | "arrange" | "arrangeOnly";

const PROCESS_STEPS: { title: string; desc: string; tiers: PlanKey[] }[] = [
  {
    title: "작곡",
    desc: "멜로디 유무에 따라 작곡 비용이 달라집니다.",
    tiers: ["compose"],
  },
  {
    title: "편곡 시안",
    desc: "편곡 시안 2~3개를 제작해드립니다.",
    tiers: ["compose", "arrange"],
  },
  {
    title: "편곡",
    desc: "작업 기간 약 1주일, 수정 3회 포함 (장르가 바뀔 경우 추가 비용이 발생합니다)",
    tiers: ["compose", "arrange", "arrangeOnly"],
  },
  { title: "녹음", desc: "녹음 1회 진행합니다.", tiers: ["compose", "arrange"] },
  {
    title: "보컬 튠",
    desc: "직접 만나서 수정할 수 있는 기회를 1회 드립니다.",
    tiers: ["compose", "arrange"],
  },
  { title: "믹싱", desc: "수정 3회 포함", tiers: ["compose", "arrange"] },
  { title: "마스터링", desc: "수정 3회 포함", tiers: ["compose", "arrange"] },
];

const PRICING_PLANS: {
  key: PlanKey;
  title: string;
  price: string;
  desc: string;
  featured: boolean;
}[] = [
  {
    key: "compose",
    title: "작곡부터 발매까지",
    price: "110만원",
    desc: "작곡 · 편곡 · 녹음 · 믹싱 · 마스터링 전체 진행",
    featured: true,
  },
  {
    key: "arrange",
    title: "편곡부터 발매까지",
    price: "80만원",
    desc: "편곡부터 마스터링까지 진행",
    featured: false,
  },
  {
    key: "arrangeOnly",
    title: "편곡만",
    price: "40만원",
    desc: "편곡만 진행",
    featured: false,
  },
];

export default function Home() {
  const [hasMelody, setHasMelody] = useState<OX>(null);
  const [hasLyrics, setHasLyrics] = useState<OX>(null);
  const [hasReference, setHasReference] = useState<OX>(null);
  const [references, setReferences] = useState(["", "", ""]);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    submission: Submission;
    emailSent: boolean;
    saved: boolean;
  } | null>(null);

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminList, setAdminList] = useState<Submission[]>([]);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);

  const [activeScene, setActiveScene] = useState(0);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);

  const [flash, setFlash] = useState<{ id: number; color: "accent" | "danger" } | null>(null);

  function triggerFlash(v: boolean) {
    setFlash({ id: Date.now(), color: v ? "accent" : "danger" });
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.sceneIndex);
            setActiveScene(idx);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sceneRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (result) {
      sceneRefs.current[4]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  function scrollToScene(i: number) {
    sceneRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateReference(i: number, v: string) {
    setReferences((prev) => prev.map((r, idx) => (idx === i ? v : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (hasMelody === null || hasLyrics === null || hasReference === null) {
      setError("01~03 질문에 모두 O 또는 X로 답해주세요.");
      return;
    }
    if (!name.trim() || !contact.trim()) {
      setError("이름과 연락처는 필수입니다.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasMelody,
          hasLyrics,
          hasReference,
          references: hasReference ? references.filter((r) => r.trim()) : [],
          name,
          contact,
          startDate,
          endDate,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "제출에 실패했습니다.");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAdmin() {
    const next = !showAdmin;
    setShowAdmin(next);
    if (next) {
      setAdminLoading(true);
      try {
        const res = await fetch("/api/apply");
        const data = await res.json();
        setAdminList(data.submissions ?? []);
      } finally {
        setAdminLoading(false);
      }
    }
  }

  return (
    <>
      <div className="rec-stamp">
        <span className="dot" />
        REC
      </div>

      {flash && (
        <div
          key={flash.id}
          className={`click-flash flash-${flash.color}`}
          onAnimationEnd={() => setFlash(null)}
        />
      )}

      <nav className="scene-nav" aria-label="섹션 이동">
        {Array.from({ length: SCENE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`scene-dot${activeScene === i ? " active" : ""}`}
            aria-label={`섹션 ${i + 1}로 이동`}
            onClick={() => scrollToScene(i)}
          />
        ))}
      </nav>

      <form onSubmit={handleSubmit}>
        <section
          className="scene scene-hero"
          data-scene-index={0}
          ref={(el) => {
            sceneRefs.current[0] = el;
          }}
        >
          <Reveal>
            <span className="badge">NOW ACCEPTING SESSIONS</span>
            <h1 className="headline">세션 시트</h1>
            <p className="subtext">
              멜로디, 가사, 레퍼런스 유무만 알려주시면 됩니다. 필요한 정보를 남겨주시면
              확인 후 연락드릴게요.
            </p>
            <button
              type="button"
              className="scroll-cue"
              onClick={() => scrollToScene(1)}
            >
              <span>SCROLL</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Reveal>
        </section>

        <section
          className="scene scene-question"
          data-scene-index={1}
          ref={(el) => {
            sceneRefs.current[1] = el;
          }}
        >
          <span className="scene-ghost-num">01</span>
          <Reveal>
            <div className="question-label scene-question-label">
              <span className="num">01.</span>
            </div>
            <h2 className="scene-question-text">멜로디가 있나요?</h2>
            <OXButtons
              value={hasMelody}
              onChange={(v) => {
                setHasMelody(v);
                triggerFlash(v);
                setTimeout(() => scrollToScene(2), 420);
              }}
            />
          </Reveal>
        </section>

        <section
          className="scene scene-question"
          data-scene-index={2}
          ref={(el) => {
            sceneRefs.current[2] = el;
          }}
        >
          <span className="scene-ghost-num">02</span>
          <Reveal>
            <div className="question-label scene-question-label">
              <span className="num">02.</span>
            </div>
            <h2 className="scene-question-text">가사가 있나요?</h2>
            <OXButtons
              value={hasLyrics}
              onChange={(v) => {
                setHasLyrics(v);
                triggerFlash(v);
                setTimeout(() => scrollToScene(3), 420);
              }}
            />
          </Reveal>
        </section>

        <section
          className="scene scene-question"
          data-scene-index={3}
          ref={(el) => {
            sceneRefs.current[3] = el;
          }}
        >
          <span className="scene-ghost-num">03</span>
          <Reveal>
            <div className="question-label scene-question-label">
              <span className="num">03.</span>
            </div>
            <h2 className="scene-question-text">레퍼런스 곡이 있나요?</h2>
            <OXButtons
              value={hasReference}
              onChange={(v) => {
                setHasReference(v);
                triggerFlash(v);
                if (!v) {
                  setTimeout(() => scrollToScene(4), 420);
                }
              }}
            />
            {hasReference && (
              <div className="ref-inputs">
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`레퍼런스 ${i + 1} (아티스트 - 곡명)`}
                    value={references[i]}
                    onChange={(e) => updateReference(i, e.target.value)}
                  />
                ))}
                <button
                  type="button"
                  className="next-btn"
                  onClick={() => scrollToScene(4)}
                >
                  다음
                </button>
              </div>
            )}
          </Reveal>
        </section>

        <section className="info-section">
          <span className="info-badge">PROCESS</span>
          <h2 className="info-title">진행 방식</h2>
          <p className="info-subtext">
            접수부터 마스터링까지, 이런 순서와 기준으로 진행됩니다. 아래 패키지를 선택하면
            포함되는 단계가 표시됩니다.
          </p>
          <ol className={`process-steps${selectedPlan ? " has-selection" : ""}`}>
            {PROCESS_STEPS.map((step, i) => (
              <li
                className={`process-step${
                  selectedPlan && step.tiers.includes(selectedPlan) ? " active" : ""
                }`}
                key={step.title}
              >
                <span className="process-step-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="process-step-title">{step.title}</span>
                <span className="process-step-desc">{step.desc}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="info-section">
          <span className="info-badge">PACKAGE</span>
          <h2 className="info-title">패키지 안내</h2>
          <p className="info-subtext">진행 범위에 따라 세 가지 패키지 중 선택하실 수 있습니다.</p>
          <div className="pricing-grid">
            {PRICING_PLANS.map((plan) => (
              <button
                type="button"
                className={`pricing-card${plan.featured ? " featured" : ""}${
                  selectedPlan === plan.key ? " selected" : ""
                }`}
                key={plan.key}
                onClick={() =>
                  setSelectedPlan((prev) => (prev === plan.key ? null : plan.key))
                }
              >
                {plan.featured && <span className="pricing-badge">FULL PACKAGE</span>}
                <div className="pricing-title">{plan.title}</div>
                <div className="pricing-price">{plan.price}</div>
                <p className="pricing-desc">{plan.desc}</p>
                {plan.featured && selectedPlan === "compose" && (
                  <p className="pricing-perk">수정 기회 +3회 추가 제공!</p>
                )}
              </button>
            ))}
          </div>
        </section>

        <section
          className="scene scene-details"
          data-scene-index={4}
          ref={(el) => {
            sceneRefs.current[4] = el;
          }}
        >
          {!result ? (
            <Reveal className="panel">
              <div className="row-2">
                <div className="field">
                  <label className="field-label">이름</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div className="field">
                  <label className="field-label">연락처</label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="이메일, 전화번호, 인스타 등"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">희망 납기</label>
                <div className="date-range">
                  <input
                    type="date"
                    aria-label="작업 시작일"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="date-range-sep">~</span>
                  <input
                    type="date"
                    aria-label="작업 종료일"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">추가 요청사항</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="장르, 분위기, 참고하고 싶은 톤 등 자유롭게 적어주세요."
                />
              </div>

              <button className="submit-btn" type="submit" disabled={submitting}>
                {submitting ? "SENDING..." : "제출하기"}
              </button>

              {error && <p className="error-text">{error}</p>}
            </Reveal>
          ) : (
            <Reveal className="confirmation">
              <div className="received-stamp">RECEIVED</div>
              <div className="summary-box">
                <span className="k">접수 번호</span> {result.submission.id}
                {"\n"}
                <span className="k">접수 시각</span>{" "}
                {new Date(result.submission.createdAt).toLocaleString("ko-KR")}
                {"\n\n"}
                <span className="k">01. 멜로디</span> {result.submission.hasMelody ? "O" : "X"}
                {"\n"}
                <span className="k">02. 가사</span> {result.submission.hasLyrics ? "O" : "X"}
                {"\n"}
                <span className="k">03. 레퍼런스</span>{" "}
                {result.submission.hasReference ? "O" : "X"}
                {result.submission.hasReference && result.submission.references.length > 0 && (
                  <>
                    {"\n"}
                    {result.submission.references.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}
                  </>
                )}
                {"\n\n"}
                <span className="k">이름</span> {result.submission.name}
                {"\n"}
                <span className="k">연락처</span> {result.submission.contact}
                {"\n"}
                <span className="k">희망 납기</span> {formatDueRange(result.submission)}
                {result.submission.notes && (
                  <>
                    {"\n\n"}
                    <span className="k">추가 요청사항</span>
                    {"\n"}
                    {result.submission.notes}
                  </>
                )}
              </div>
              <p className="email-note">
                {result.emailSent && result.saved && "담당자에게 이메일 알림을 보냈습니다."}
                {result.emailSent &&
                  !result.saved &&
                  "담당자에게 이메일 알림을 보냈습니다. (접수 목록 저장은 실패했지만 이메일로 확인 가능합니다.)"}
                {!result.emailSent &&
                  result.saved &&
                  "신청 내용은 저장되었지만 이메일 알림 전송에는 실패했습니다. 담당자가 접수 목록에서 확인할 수 있습니다."}
              </p>
            </Reveal>
          )}
        </section>
      </form>

      <footer className="site-footer">
        <button className="admin-toggle" type="button" onClick={toggleAdmin}>
          {showAdmin ? "관리자 보기 닫기" : "관리자 보기"}
        </button>

        {showAdmin && (
          <div className="admin-panel">
            {adminLoading && <p className="admin-empty">불러오는 중...</p>}
            {!adminLoading && adminList.length === 0 && (
              <p className="admin-empty">아직 접수된 신청이 없습니다.</p>
            )}
            {!adminLoading &&
              adminList.map((s) => (
                <div className="admin-card" key={s.id}>
                  <span className="id">{s.id}</span> ·{" "}
                  {new Date(s.createdAt).toLocaleString("ko-KR")}
                  {"\n"}
                  멜로디 {s.hasMelody ? "O" : "X"} / 가사 {s.hasLyrics ? "O" : "X"} / 레퍼런스{" "}
                  {s.hasReference ? "O" : "X"}
                  {s.hasReference && s.references.length > 0 && (
                    <>
                      {"\n"}레퍼런스: {s.references.join(", ")}
                    </>
                  )}
                  {"\n"}
                  {s.name} · {s.contact} · 납기 {formatDueRange(s)}
                  {s.notes && (
                    <>
                      {"\n"}메모: {s.notes}
                    </>
                  )}
                </div>
              ))}
          </div>
        )}
      </footer>

      <section className="gallery-section">
        <span className="gallery-badge">CONTENT</span>
        <h2 className="gallery-title">카드뉴스 & 릴스</h2>
        <p className="gallery-subtext">
          진행한 세션의 카드뉴스와 릴스가 이 자리에 업데이트될 예정입니다.
        </p>
        <div className="gallery-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="gallery-slot" key={i}>
              <span>SOON</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="business-footer">
        <dl>
          <div>
            <dt>대표</dt>
            <dd>윤정빈</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>010-4892-6116</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>은평구 증가로 206-1</dd>
          </div>
        </dl>
      </footer>
    </>
  );
}
