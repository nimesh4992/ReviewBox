"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

// ─── Design-system data ───────────────────────────────────────────────────────

const PILLARS = [
  {
    id: "inbox",
    title: "Unified inbox",
    body: "Every App Store and Play Store review, every market, every app. One queue, sorted by 'about to cost you an install.'",
    bullets: ["Real-time sync, 60-second connect", "Assign, draft, approve as a team", "Bulk-tag, mute, escalate"],
  },
  {
    id: "ai",
    title: "AI replies, not AI slop",
    body: "Drafts that read your KB, your templates, your last reply. You edit. You ship. The reply rate climbs.",
    bullets: ["Tone trained on your past replies", "KB-grounded — no hallucinated promises", "Streaming drafts, 2-3 seconds end-to-end"],
  },
  {
    id: "incidents",
    title: "Incident detection",
    body: "Crash spikes, billing churn, login regressions — surfaced from review patterns before your Sentry dashboard wakes up.",
    bullets: ["Auto-pages your Slack on-call", "Correlates to the suspect release", "Time-to-detect: median 11 minutes"],
  },
  {
    id: "release",
    title: "Release health",
    body: "Every release scored against its predecessor on rating, complaint volume, and topic shift. Rollback decisions in one screen.",
    bullets: ["Per-version review drill-down", "Side-by-side rating + complaint deltas", "Roll-out % vs reviewer sentiment"],
  },
];

const ROLES = [
  {
    id: "support",
    label: "Support ops",
    kicker: "For the team that owns reply SLAs",
    h: "Cut median reply time from 36 hours to 11 minutes.",
    body: "Route 1-star reviews to the on-call agent. Draft a tone-matched reply. Track SLA per app, per agent, per week.",
    bullets: ["Slack alerts on 1-star + escalation rules", "SLA dashboard per app and per agent", "Pre-approved reply templates by issue tag"],
    metric: { v: "11 min", l: "Median reply time at top decile" },
  },
  {
    id: "product",
    label: "Product",
    kicker: "For the PM who reads every 1-star",
    h: "See which feature ship is quietly dragging your rating.",
    body: "AI clusters reviews by topic — auth, onboarding, paywall — and tracks each as its own sentiment line.",
    bullets: ["Topic clusters with sentiment over time", "Linear / Jira ticket creation from any review", "Weekly digest of the top 5 emerging issues"],
    metric: { v: "−14 days", l: "Faster from 'we hear you' to fix shipped" },
  },
  {
    id: "release",
    label: "Release eng",
    kicker: "For the team shipping the regression",
    h: "Catch the post-release rating drop in minutes, not days.",
    body: "ReviewBox correlates every review with its app version, watches the rating delta on every rollout, and pages you before the drop bakes in.",
    bullets: ["Per-version review feed and rating delta", "Crash-mention spike alerts pre-Sentry", "Rollout % vs sentiment chart"],
    metric: { v: "11 min", l: "Median time-to-detect on regressions" },
  },
];

const INTEGRATIONS = [
  { n: "Google Play",       g: "GP", note: "Reply API · live" },
  { n: "App Store Connect", g: "AS", note: "Read-only · reply Q3" },
  { n: "Slack",             g: "Sl", note: "Alerts + DM" },
  { n: "Linear",            g: "Ln", note: "Ticket from review" },
  { n: "Jira",              g: "Ji", note: "Ticket from review" },
  { n: "Zendesk",           g: "Zd", note: "Escalation route" },
  { n: "Notion",            g: "No", note: "KB sync" },
  { n: "Zapier",            g: "Zp", note: "Everything else" },
];

const FREE_TOOLS = [
  { n: "Review sentiment analyzer", d: "Paste 100 reviews, get sentiment + topic clusters in 30 seconds.", k: "no sign-up" },
  { n: "AI reply generator",        d: "The same drafter that ships with ReviewBox, on a single review.", k: "no sign-up" },
  { n: "ASO keyword density",       d: "Score your store listing's keyword coverage against your competitors.", k: "free forever" },
  { n: "Rating impact calculator",  d: "What −0.3★ actually costs you in installs and ARR per quarter.", k: "free forever" },
  { n: "App review benchmarks",     d: "Median rating, reply rate, and reply-time benchmarks for your category.", k: "no sign-up" },
];

const FAQ_ITEMS = [
  {
    q: "Does ReviewBox actually post replies back to the App Store and Play Store?",
    a: "Google Play, yes — replies post back through the official Play Console API the moment you hit send. App Store Connect is coming Q3; today we draft and stage, you copy-paste.",
  },
  {
    q: "How is the AI different from ChatGPT-with-a-prompt?",
    a: "ReviewBox reads your reply templates, your knowledge base, your release notes, and your previous replies before it writes a word. The first draft already knows about your recent releases and your tone.",
  },
  {
    q: "What does the 14-day free trial actually include?",
    a: "Everything. Pro tier, full AI drafting, all integrations, no card. If you cancel on day 13, we don't charge you and we don't email you for six months.",
  },
  {
    q: "Is this just AppFollow with a fresh coat of paint?",
    a: "AppFollow is great if you're an enterprise mobile agency staffed for it. ReviewBox is for product teams who want the work done — AI replies that ship, incident detection that pages on call, and a price tag that doesn't require procurement.",
  },
  {
    q: "Will my reviews — and my customers' data — leave the EU?",
    a: "EU customers run on EU-hosted Supabase. Reviews are encrypted at rest, AI prompts route through Anthropic with no training opt-in, and our DPA + SOC 2 (Type II, in progress) are linked from the security page.",
  },
  {
    q: "Can I just track reviews and not reply through ReviewBox?",
    a: "Yes. Roughly 30% of customers use us as a read-only signal layer — incident alerts, release health, sentiment trends — and reply somewhere else.",
  },
];

const SAMPLE_REVIEWS = [
  { rating: 1, title: "Crashes on iPad", body: "App crashes every single time I switch accounts on iPad. Started after the 4.2.1 update. Face ID feels slower too. Super frustrating because I rely on this app daily for my small business.", author: "@kthompson", app: "Acme Banking", version: "4.2.1" },
  { rating: 2, title: "Where did the budgets tab go?", body: "The new design hid budgets behind two menus. Also can't find recurring transfers anymore — that used to be one tap from the home screen. Please bring it back.", author: "@mariejean", app: "Acme Banking", version: "4.2.1" },
  { rating: 1, title: "Charged twice this month", body: "Got billed twice for the Pro upgrade. Support hasn't responded in 4 days. About to dispute with my bank if I don't hear back today.", author: "@runner_max", app: "Trailhead", version: "2.8.0" },
];

const HERO_DRAFT = `Thanks for flagging the iPad budgets crash on 4.2.1 — we caught it this morning and a fix is rolling out this week. In the meantime, force-quit and reopen restores the session. We'll DM you the moment 4.2.2 lands so you can verify.`;

const PRICING = [
  { name: "Starter", price: "$49", body: "Solo Android devs and 1-app teams.", cta: "Start free", features: ["2 apps", "5K reviews / mo", "50 AI drafts / day", "Google Play replies", "Email alerts", "1 seat"] },
  { name: "Pro",     price: "$99", body: "Product teams shipping multiple apps.",     cta: "Start free", popular: true, features: ["10 apps", "50K reviews / mo", "200 AI drafts / day", "Incident detection", "Release health", "Slack + KB sync", "5 seats"] },
  { name: "Team",    price: "$199", body: "App portfolios and global support orgs.", cta: "Start free", features: ["Unlimited apps", "Unlimited reviews", "1,000 drafts / day", "SSO + audit log", "Custom retention", "Dedicated CSM", "Unlimited seats"] },
];

// ─── Primitive components ─────────────────────────────────────────────────────


const Arrow = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
  </svg>
);

const Check = ({ size = 14, color = "var(--rb-blue-500)" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Plus = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Sparkle = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z" fill={color} />
    <path d="M19 3 L19.7 5 L21.8 5.7 L19.7 6.4 L19 8.4 L18.3 6.4 L16.2 5.7 L18.3 5 Z" fill={color} />
  </svg>
);

const LivePulse = ({ size = 6, color = "var(--rb-green-500)" }: { size?: number; color?: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", animation: "rb-pulse 1.6s ease-in-out infinite" }} />
  </span>
);

const Kicker = ({ children, accent = "var(--rb-blue-500)" }: { children: React.ReactNode; accent?: string }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--rb-fg-3)", display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--rb-font-mono)" }}>
    <span style={{ width: 6, height: 6, borderRadius: 99, background: accent, boxShadow: `0 0 14px ${accent}` }} />
    {children}
  </div>
);

const Container = ({ children, w = 1200, style }: { children: React.ReactNode; w?: number; style?: React.CSSProperties }) => (
  <div style={{ maxWidth: w, margin: "0 auto", padding: "0 40px", ...style }}>{children}</div>
);

const Btn = ({
  children, kind = "primary", size = "md", href, onClick, disabled, style,
}: {
  children: React.ReactNode; kind?: "primary" | "secondary" | "ghost" | "inverse";
  size?: "sm" | "md" | "lg"; href?: string; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) => {
  const sizes: Record<string, { h: number; px: number; fs: number }> = { sm: { h: 34, px: 14, fs: 13 }, md: { h: 42, px: 18, fs: 14 }, lg: { h: 50, px: 24, fs: 15 } };
  const s = sizes[size];
  const base: React.CSSProperties = { height: s.h, padding: `0 ${s.px}px`, fontSize: s.fs, fontWeight: 600, borderRadius: 10, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--rb-font-text)", border: "0px solid transparent", transition: "all 120ms", letterSpacing: "-0.005em", textDecoration: "none", flexShrink: 0 };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "var(--rb-blue-500)", color: "#fff", fontWeight: 700, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" },
    secondary: { background: "transparent", color: "var(--rb-fg-1)", border: "1px solid var(--rb-border-2)" },
    ghost:     { background: "transparent", color: "var(--rb-fg-1)" },
    inverse:   { background: "var(--rb-fg-1)", color: "var(--rb-bg-canvas)", fontWeight: 700 },
  };
  const merged = { ...base, ...variants[kind], ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}), ...style };
  if (href) return <Link href={href} style={merged}>{children}</Link>;
  return <button onClick={onClick} disabled={disabled} style={merged}>{children}</button>;
};

// ─── Animation utilities ──────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const Reveal = ({ children, delay = 0, y = 20 }: { children: React.ReactNode; delay?: number; y?: number }) => {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : `translateY(${y}px)`, transition: `opacity 600ms ${delay}ms cubic-bezier(0.16,1,0.3,1), transform 600ms ${delay}ms cubic-bezier(0.16,1,0.3,1)` }}>
      {children}
    </div>
  );
};

const CountUp = ({ end, suffix = "", duration = 1600 }: { end: number; suffix?: string; duration?: number }) => {
  const [ref, inView] = useInView();
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * end));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, duration]);
  const display = end < 0 ? (val === 0 ? "0" : `-${Math.abs(val)}`) : val;
  return <span ref={ref}>{display}{suffix}</span>;
};

const Streaming = ({ text, speed = 14, play, onDone }: { text: string; speed?: number; play: boolean; onDone?: () => void }) => {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!play) { setPos(0); return; }
    const id = setInterval(() => {
      setPos(p => {
        if (p >= text.length) { clearInterval(id); onDone?.(); return p; }
        return p + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [play, text, speed, onDone]);
  return <>{text.slice(0, pos)}{pos < text.length && play && <span style={{ animation: "rb-blink 0.9s step-end infinite", borderRight: "1.5px solid var(--rb-fg-1)" }}>&nbsp;</span>}</>;
};

// ─── Navigation ── (shared MarketingNav used in page root) ───────────────────

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [done, setDone] = useState(false);
  const replay = useCallback(() => { setDone(false); setPlay(false); setTimeout(() => setPlay(true), 60); }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTimeout(() => setPlay(true), 480); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ background: "var(--rb-bg-surface)", border: "1px solid var(--rb-border-1)", borderRadius: 18, boxShadow: "var(--rb-shadow-xl)", overflow: "hidden" }}>
      <div style={{ height: 36, background: "var(--rb-bg-sunken)", borderBottom: "1px solid var(--rb-border-1)", display: "flex", alignItems: "center", padding: "0 14px", gap: 12 }}>
        <LivePulse size={7} color={done ? "var(--rb-green-500)" : "var(--rb-blue-500)"} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--rb-fg-2)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em" }}>{done ? "DRAFT READY · 2.9s" : play ? "DRAFTING…" : "WAITING FOR REVIEW"}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)" }}>groq · llama-3.3-70b</span>
      </div>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--rb-border-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.08em" }}>APP STORE · iOS</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
            {[1,2,3,4,5].map(i => <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i === 1 ? "#FFB800" : "var(--rb-border-2)"}><path d="M12 2 L15 9 L22 9.5 L17 14.5 L18.5 22 L12 18 L5.5 22 L7 14.5 L2 9.5 L9 9 Z" /></svg>)}
          </span>
        </div>
        <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 15, fontWeight: 700, color: "var(--rb-fg-1)", marginBottom: 6 }}>Crashes on iPad after 4.2.1</div>
        <div style={{ fontSize: 13, color: "var(--rb-fg-2)", lineHeight: 1.55 }}>Every time I open the budgets tab on iPad it freezes for 5–10 seconds. Started after the last update. I use this daily for my small business.</div>
        <div style={{ fontSize: 11, color: "var(--rb-fg-4)", marginTop: 8, fontFamily: "var(--rb-font-mono)" }}>@kthompson · Acme Banking · v4.2.1 · 2m ago</div>
      </div>
      <div style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "var(--rb-purple-500)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}><Sparkle size={11} color="var(--rb-purple-500)" /> AI DRAFT</span>
          <button onClick={replay} style={{ marginLeft: "auto", background: "transparent", border: 0, cursor: "pointer", fontSize: 11, color: done ? "var(--rb-blue-500)" : "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            REPLAY
          </button>
        </div>
        <div style={{ padding: 14, borderRadius: 10, background: "color-mix(in oklch, var(--rb-purple-500) 8%, transparent)", border: "1px dashed color-mix(in oklch, var(--rb-purple-500) 36%, transparent)", fontSize: 13.5, lineHeight: 1.65, color: "var(--rb-fg-1)", minHeight: 90, letterSpacing: "-0.003em" }}>
          {play ? <Streaming text={HERO_DRAFT} speed={12} play={play} onDone={() => setDone(true)} /> : <span style={{ color: "var(--rb-fg-4)" }}>Generating reply…</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", opacity: done ? 1 : 0, transition: "opacity 360ms" }}>
          {[{ l: "tone · empathetic", c: "var(--rb-blue-500)" }, { l: "KB · v4.2.1 notes", c: "var(--rb-purple-500)" }, { l: "✓ ready to post", c: "var(--rb-green-500)" }].map(t => (
            <span key={t.l} style={{ padding: "3px 9px", borderRadius: 99, background: `color-mix(in oklch, ${t.c} 10%, transparent)`, color: t.c, fontSize: 10.5, fontWeight: 700, fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em" }}>{t.l}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const Hero = () => (
  <section style={{ position: "relative", padding: "56px 0 80px", background: "var(--rb-bg-canvas)", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 25% -5%, color-mix(in oklch, var(--rb-blue-500) 22%, transparent), transparent 65%), radial-gradient(ellipse 40% 35% at 78% 20%, color-mix(in oklch, var(--rb-purple-500) 16%, transparent), transparent 65%)" }} />
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(to right, var(--rb-border-1) 1px, transparent 1px), linear-gradient(to bottom, var(--rb-border-1) 1px, transparent 1px)", backgroundSize: "56px 56px", opacity: 0.6, maskImage: "radial-gradient(ellipse 80% 80% at 50% 0%, black 25%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 0%, black 25%, transparent 75%)" }} />
    <Container w={1280}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 64, alignItems: "center", position: "relative" }}>
        <div>
          <Reveal delay={0}>
            <Link href="/changelog" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px 5px 5px", borderRadius: 99, background: "var(--rb-bg-surface)", border: "1px solid var(--rb-border-1)", fontSize: 12.5, fontWeight: 500, color: "var(--rb-fg-2)", marginBottom: 28, textDecoration: "none" }}>
              <span style={{ padding: "2px 9px", borderRadius: 99, background: "var(--rb-blue-500)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "var(--rb-font-mono)" }}>NEW</span>
              <span style={{ color: "var(--rb-fg-1)" }}>Incident detection · generally available</span>
              <Arrow size={11} />
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <h1 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(52px, 5.5vw, 76px)", lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.045em", color: "var(--rb-fg-1)", marginBottom: 24, textWrap: "balance" } as React.CSSProperties}>
              Stop replying to reviews{" "}
              <span style={{ background: "linear-gradient(180deg, var(--rb-fg-1) 0%, var(--rb-fg-1) 55%, var(--rb-fg-3) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent", fontStyle: "italic", fontWeight: 600 }}>in a spreadsheet.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--rb-fg-2)", maxWidth: 520, letterSpacing: "-0.005em", marginBottom: 36 }}>
              If your review ops doc has more tabs than your phone, you&apos;re the product. ReviewBox is the inbox, the alerts, and the reply queue — minus the busywork.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Btn size="lg" kind="primary" href="/sign-up">Start free · no card <Arrow /></Btn>
              <Btn size="lg" kind="secondary" href="#demo">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20" /></svg>
                Watch 90s demo
              </Btn>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 22, fontSize: 12, color: "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.02em" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <LivePulse size={6} color="var(--rb-green-500)" />
                <CountUp end={312} duration={1800} /> apps shipping with us
              </span>
              <span>14d free · connect in 60s · cancel from one screen</span>
            </div>
          </Reveal>
        </div>
        <Reveal delay={420} y={12}>
          <HeroDemo />
        </Reveal>
      </div>
    </Container>
  </section>
);

// ─── Inbox showcase ───────────────────────────────────────────────────────────

const InboxShowcase = () => (
  <section style={{ padding: "40px 0 88px", background: "var(--rb-bg-canvas)" }}>
    <Container w={1280}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
          <div>
            <Kicker>The inbox</Kicker>
            <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 32, fontWeight: 600, color: "var(--rb-fg-1)", letterSpacing: "-0.025em", marginTop: 12, maxWidth: 720 }}>
              Every review, every store, every app, sorted by what&apos;ll cost you next.
            </div>
          </div>
          <Link href="/sign-up" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rb-blue-500)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            TOUR THE INBOX <Arrow size={12} />
          </Link>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "var(--rb-shadow-xl)", border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-surface)" }}>
          {/* Window chrome */}
          <div style={{ height: 38, background: "var(--rb-bg-raised)", borderBottom: "1px solid var(--rb-border-1)", display: "flex", alignItems: "center", paddingLeft: 14, gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 99, background: "#FF5F57" }} />
            <span style={{ width: 11, height: 11, borderRadius: 99, background: "#FEBC2E" }} />
            <span style={{ width: 11, height: 11, borderRadius: 99, background: "#28C840" }} />
            <div style={{ marginLeft: 20, padding: "4px 12px", background: "var(--rb-bg-surface)", borderRadius: 6, border: "1px solid var(--rb-border-1)", fontSize: 11, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)" }}>app.tryreviewbox.com/inbox</div>
            <span style={{ marginLeft: "auto", marginRight: 14, fontSize: 11, color: "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)" }}>312 reviews this week</span>
          </div>
          <div style={{ display: "flex", height: 540, overflow: "hidden" }}>
            {/* Sidebar */}
            <div style={{ width: 200, background: "var(--rb-bg-sunken)", borderRight: "1px solid var(--rb-border-1)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <div style={{ padding: "0 8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg, var(--rb-blue-400), var(--rb-blue-700))" }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rb-fg-1)" }}>Acme Inc.</div>
              </div>
              {[{ l: "Inbox", c: 23, active: true }, { l: "Incidents", c: 2, kind: "warn" }, { l: "Releases" }, { l: "Sentiment" }, { l: "Automations" }, { l: "Reply kit" }].map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 6, background: it.active ? "var(--rb-bg-accent-soft)" : "transparent" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: it.active ? "var(--rb-blue-500)" : "var(--rb-border-2)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: it.active ? 600 : 500, color: it.active ? "var(--rb-blue-500)" : "var(--rb-fg-2)" }}>{it.l}</span>
                  {it.c && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: it.kind === "warn" ? "var(--rb-red-100)" : it.active ? "var(--rb-blue-500)" : "var(--rb-border-2)", color: it.kind === "warn" ? "var(--rb-red-600)" : it.active ? "#fff" : "var(--rb-fg-1)" }}>{it.c}</span>}
                </div>
              ))}
              <div style={{ marginTop: "auto", padding: 10, borderRadius: 8, background: "color-mix(in oklch, var(--rb-purple-500) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--rb-purple-500) 24%, transparent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "var(--rb-purple-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}><Sparkle size={10} color="var(--rb-purple-500)" /> Triage</div>
                <div style={{ fontSize: 11, color: "var(--rb-fg-2)", marginTop: 4, lineHeight: 1.4 }}>3 reviews tagged <strong style={{ color: "var(--rb-fg-1)" }}>auth crash</strong> in 4h.</div>
              </div>
            </div>
            {/* Main */}
            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, background: "var(--rb-bg-surface)", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--rb-fg-4)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>4 apps · 312 this week</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--rb-fg-1)", fontFamily: "var(--rb-font-display)", letterSpacing: "-0.02em", marginTop: 2 }}>Inbox</div>
                </div>
                <div style={{ marginLeft: "auto", display: "inline-flex", padding: 2, borderRadius: 7, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)" }}>
                  <div style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, background: "var(--rb-bg-raised)", color: "var(--rb-fg-1)" }}>Newest</div>
                  <div style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--rb-fg-3)" }}>SLA risk</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[{ l: "Rating", v: "4.62", d: "+0.41" }, { l: "Reply rate", v: "94%", d: "+12%" }, { l: "Reply time", v: "11m", d: "−27m" }, { l: "Incidents", v: "2", d: "−1", warn: true }].map((m, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-raised)" }}>
                    <div style={{ fontSize: 9, color: "var(--rb-fg-4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>{m.l}</div>
                    <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 22, fontWeight: 700, color: m.warn ? "var(--rb-red-500)" : "var(--rb-fg-1)", letterSpacing: "-0.025em", marginTop: 3 }}>{m.v}</div>
                    <div style={{ fontSize: 10, color: "var(--rb-green-500)", fontWeight: 700, marginTop: 1, fontFamily: "var(--rb-font-mono)" }}>{m.d}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, borderRadius: 9, border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-raised)", overflow: "hidden" }}>
                {[
                  { app: "Acme Banking", store: "App Store", title: "Crashes on iPad after 4.2.1", body: "Every time I open the budgets tab it freezes.", stars: 1, t: "2m", sel: true, ai: "crash" },
                  { app: "Trailhead",    store: "Play Store", title: "Best running tracker I've used", body: "GPS lock is instant. Elevation is finally accurate.", stars: 5, t: "12m", ai: "praise" },
                  { app: "Acme Banking", store: "App Store", title: "Where did the budgets tab go?", body: "Three menus deep now. Why.", stars: 2, t: "44m", ai: "regression" },
                  { app: "Nova",         store: "App Store", title: "Onboarding feels premium", body: "The welcome flow is just so smooth.", stars: 5, t: "1h", ai: "praise" },
                  { app: "Pocket Lock", store: "Play Store", title: "Solid but battery drain", body: "Drains 12% overnight on iOS 18.", stars: 4, t: "2h", ai: "perf" },
                ].map((r, i, arr) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "9px 14px", borderBottom: i < arr.length - 1 ? "1px solid var(--rb-border-1)" : 0, alignItems: "flex-start", background: r.sel ? "var(--rb-bg-accent-soft)" : "transparent" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--rb-fg-3)" }}>{r.app[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--rb-fg-1)", letterSpacing: "-0.005em" }}>{r.title}</span>
                        <span style={{ display: "inline-flex", gap: 1 }}>{[1,2,3,4,5].map(j => <svg key={j} width="9" height="9" viewBox="0 0 24 24" fill={j <= r.stars ? "#FFB800" : "var(--rb-border-2)"}><path d="M12 2 L15 9 L22 9.5 L17 14.5 L18.5 22 L12 18 L5.5 22 L7 14.5 L2 9.5 L9 9 Z" /></svg>)}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 99, background: "color-mix(in oklch, var(--rb-purple-500) 14%, transparent)", color: "var(--rb-purple-500)", fontSize: 9.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}><Sparkle size={8} color="var(--rb-purple-500)" /> {r.ai}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--rb-fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.body}</div>
                      <div style={{ fontSize: 10, color: "var(--rb-fg-4)", marginTop: 2, fontFamily: "var(--rb-font-mono)" }}>{r.app} · {r.store} · {r.t}</div>
                    </div>
                    {r.sel && <div style={{ padding: "3px 8px", borderRadius: 99, background: "var(--rb-blue-500)", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Drafting…</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Container>
  </section>
);

// ─── Trust strip ──────────────────────────────────────────────────────────────

const TrustStrip = () => {
  const logos = ["Northwind", "Helix Money", "Trailhead", "Pocket Lock", "Nova", "Atlas Logistics", "Lumen Health", "Marlin Pay", "Tide Books", "Compass"];
  const doubled = [...logos, ...logos];
  return (
    <section style={{ padding: "44px 0", background: "var(--rb-bg-canvas)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)", overflow: "hidden" }}>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--rb-fg-4)", marginBottom: 24, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, fontFamily: "var(--rb-font-mono)" }}>/ mobile teams shipping with ReviewBox</div>
      <div className="rb-marquee-track">
        {doubled.map((n, i) => (
          <div key={i} style={{ fontFamily: "var(--rb-font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--rb-fg-3)", whiteSpace: "nowrap" }}>{n}</div>
        ))}
      </div>
    </section>
  );
};

// ─── Pain stats ───────────────────────────────────────────────────────────────

const Pain = () => (
  <section style={{ padding: "120px 0 96px", background: "var(--rb-bg-canvas)" }}>
    <Container>
      <div style={{ marginBottom: 60 }}>
        <Kicker>The state of review ops</Kicker>
        <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(48px, 6vw, 84px)", lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.045em", color: "var(--rb-fg-1)", marginTop: 20, maxWidth: 1100 } as React.CSSProperties}>
          Your worst review is <span style={{ color: "var(--rb-blue-500)" }}>still unanswered</span>.<br />
          And it&apos;s been there for <span style={{ fontStyle: "italic", color: "var(--rb-fg-3)" }}>11 days.</span>
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--rb-border-1)" }}>
        {[
          { v: 47, suffix: "%", l: "of 1★ reviews never get a reply", body: "Every Tuesday afternoon, your support lead clicks through App Store Connect and gives up around the 23rd one. The other 24 don't come back." },
          { v: -22, suffix: "%", l: "installs per 0.3★ drop", body: "Rank, conversion, and social proof index on rating. The math punishes you faster than your retention dashboards can show." },
          { v: 73, suffix: "%", l: "of regressions hit reviews first", body: "Crash reports lag. Sentry samples. Reviews are unfiltered, geotagged, and they show up the hour the regression ships." },
        ].map((s, i) => (
          <Reveal key={i} delay={i * 100}>
            <div style={{ padding: "40px 32px 36px", borderRight: i < 2 ? "1px solid var(--rb-border-1)" : 0, borderBottom: "1px solid var(--rb-border-1)" }}>
              <div style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(64px, 6vw, 92px)", fontWeight: 700, letterSpacing: "-0.05em", color: "var(--rb-fg-1)", lineHeight: 0.9 } as React.CSSProperties}>
                {s.v < 0 && "−"}<CountUp end={Math.abs(s.v)} suffix={s.suffix} duration={1600} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--rb-fg-1)", marginTop: 20, letterSpacing: "-0.01em" }}>{s.l}</div>
              <div style={{ fontSize: 14.5, color: "var(--rb-fg-3)", lineHeight: 1.6, marginTop: 10 }}>{s.body}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <div style={{ marginTop: 28, fontSize: 12, color: "var(--rb-fg-4)" }}>312 apps tracked &middot; Jan&ndash;Apr 2026 &middot; Full benchmark report ships next month</div>
    </Container>
  </section>
);

// ─── Pillars ──────────────────────────────────────────────────────────────────

const PillarIcon = ({ id }: { id: string }) => {
  const wrap: React.CSSProperties = { width: 40, height: 40, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  if (id === "inbox") return <div style={{ ...wrap, background: "var(--rb-bg-accent-soft)", color: "var(--rb-blue-500)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg></div>;
  if (id === "ai") return <div style={{ ...wrap, background: "color-mix(in oklch, var(--rb-purple-500) 14%, transparent)", color: "var(--rb-purple-500)" }}><Sparkle size={20} color="var(--rb-purple-500)" /></div>;
  if (id === "incidents") return <div style={{ ...wrap, background: "var(--rb-red-100)", color: "var(--rb-red-600)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>;
  return <div style={{ ...wrap, background: "var(--rb-green-100)", color: "var(--rb-green-500)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>;
};

const Pillars = () => (
  <section style={{ padding: "120px 0", background: "var(--rb-bg-surface)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)" }}>
    <Container>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 64, alignItems: "flex-end", marginBottom: 60 }}>
        <div>
          <Kicker>What&apos;s inside</Kicker>
          <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(48px, 5vw, 68px)", lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
            Four tools.<br />One inbox.<br />Zero busywork.
          </h2>
        </div>
        <p style={{ fontSize: 18, color: "var(--rb-fg-2)", lineHeight: 1.55, letterSpacing: "-0.005em" }}>
          Most &quot;review platforms&quot; are read-only dashboards with a Reply button bolted to the side. ReviewBox is the smallest possible tool that completes the actual loop — read, decide, draft, ship, learn.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--rb-border-1)" }}>
        {PILLARS.map((p, i) => (
          <Reveal key={p.id} delay={i * 80}>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 40, padding: "44px 0", borderBottom: "1px solid var(--rb-border-1)", alignItems: "flex-start" }}>
              <div style={{ fontFamily: "var(--rb-font-mono)", fontSize: 13, color: "var(--rb-fg-4)", fontWeight: 600 }}>0{i + 1}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <PillarIcon id={p.id} />
                  <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 30, fontWeight: 700, color: "var(--rb-fg-1)", letterSpacing: "-0.025em" }}>{p.title}</div>
                </div>
                <p style={{ fontSize: 15.5, color: "var(--rb-fg-2)", lineHeight: 1.6, maxWidth: 440 }}>{p.body}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {p.bullets.map(b => <div key={b} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--rb-fg-2)", lineHeight: 1.5 }}><Check size={16} /> {b}</div>)}
                <Link href="/sign-up" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--rb-blue-500)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>READ MORE <Arrow size={12} /></Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Container>
  </section>
);

// ─── AI Reply Demo ────────────────────────────────────────────────────────────

const PulsingDots = () => (
  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
    {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: "var(--rb-blue-500)", opacity: 0.4, animation: `rb-pulse 1.1s ${i * 0.18}s infinite ease-in-out` }} />)}
  </span>
);

const AIReplyDemo = () => {
  const [idx, setIdx] = useState(0);
  const r = SAMPLE_REVIEWS[idx];
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setReply(""); setError("");
    try {
      const res = await fetch("/api/demo/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewBody: r.body, rating: r.rating, reviewTitle: r.title }),
      });
      const data = await res.json() as { reply?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setReply(data.reply ?? "");
    } catch {
      setError("Demo is offline for a sec. Try again, or grab a free trial — the real one is faster anyway.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: "var(--rb-bg-surface)", border: "1px solid var(--rb-border-1)", borderRadius: 18, boxShadow: "var(--rb-shadow-lg)", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      <div style={{ background: "var(--rb-bg-sunken)", padding: "28px 30px", borderRight: "1px solid var(--rb-border-1)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)" }}>Customer review</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
            {[1,2,3,4,5].map(i => <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= r.rating ? "#FFB800" : "var(--rb-border-2)"}><path d="M12 2 L15 9 L22 9.5 L17 14.5 L18.5 22 L12 18 L5.5 22 L7 14.5 L2 9.5 L9 9 Z" /></svg>)}
          </span>
        </div>
        <div>
          <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 19, fontWeight: 700, color: "var(--rb-fg-1)", letterSpacing: "-0.015em", lineHeight: 1.25 }}>{r.title}</div>
          <div style={{ fontSize: 14, color: "var(--rb-fg-2)", lineHeight: 1.6, marginTop: 10 }}>{r.body}</div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--rb-fg-3)", marginTop: "auto", fontFamily: "var(--rb-font-mono)" }}>App Store · iOS · {r.app} · v{r.version}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SAMPLE_REVIEWS.map((s, i) => (
            <button key={i} onClick={() => { setIdx(i); setReply(""); setError(""); }} style={{ height: 28, padding: "0 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--rb-font-text)", border: i === idx ? "1px solid var(--rb-blue-500)" : "1px solid var(--rb-border-2)", background: i === idx ? "var(--rb-bg-accent-soft)" : "transparent", color: i === idx ? "var(--rb-blue-500)" : "var(--rb-fg-2)", transition: "all 120ms" }}>
              {s.rating}★ · {s.title.split(" ").slice(0, 3).join(" ")}…
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "var(--rb-bg-surface)", padding: "28px 30px", display: "flex", flexDirection: "column", gap: 14, minHeight: 340 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rb-purple-500)", fontFamily: "var(--rb-font-mono)", display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkle size={11} color="var(--rb-purple-500)" /> AI draft</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)" }}>{loading ? "thinking…" : reply ? `${reply.length} chars` : "ready"}</span>
        </div>
        <div style={{ flex: 1, padding: 18, borderRadius: 12, background: "color-mix(in oklch, var(--rb-purple-500) 8%, transparent)", border: "1px dashed color-mix(in oklch, var(--rb-purple-500) 35%, transparent)", fontSize: 14.5, lineHeight: 1.6, color: "var(--rb-fg-1)", minHeight: 160, whiteSpace: "pre-wrap" }}>
          {!reply && !loading && !error && <span style={{ color: "var(--rb-fg-3)" }}>Click <strong style={{ color: "var(--rb-fg-2)" }}>Generate reply</strong> below.</span>}
          {loading && <PulsingDots />}
          {reply}
          {error && <span style={{ color: "var(--rb-red-500)" }}>{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={generate} disabled={loading} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: 0, background: "var(--rb-blue-500)", color: "#fff", fontWeight: 700, fontSize: 13.5, fontFamily: "var(--rb-font-text)", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" }}>
            <Sparkle size={14} color="#fff" /> {reply ? "Regenerate" : "Generate reply"}
          </button>
          {reply && <button style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--rb-border-2)", background: "transparent", color: "var(--rb-fg-1)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Use as template →</button>}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rb-fg-3)" }}>KB-grounded &middot; real product</span>
        </div>
      </div>
    </div>
  );
};

const DemoSection = () => (
  <section id="demo" style={{ padding: "140px 0", background: "var(--rb-bg-canvas)" }}>
    <Container w={1240}>
      <div style={{ marginBottom: 56, maxWidth: 880 }}>
        <Kicker accent="var(--rb-purple-500)">Try it · no sign-up · no card</Kicker>
        <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(48px, 5.5vw, 76px)", lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.045em", color: "var(--rb-fg-1)", marginTop: 22 } as React.CSSProperties}>
          Reply to a 1★ review. <span style={{ fontStyle: "italic", color: "var(--rb-fg-3)" }}>Right here.</span>
        </h2>
        <p style={{ fontSize: 18, color: "var(--rb-fg-2)", marginTop: 20, maxWidth: 660, lineHeight: 1.55 }}>Pick a review on the left. Hit generate. The drafter on the right is the same model we ship — KB-grounded, tone-trained, ~3 seconds.</p>
      </div>
      <AIReplyDemo />
    </Container>
  </section>
);

// ─── Roles ────────────────────────────────────────────────────────────────────

const SupportPanel = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {[{ l: "median", v: "11m" }, { l: "p95", v: "1h 06m" }, { l: "1★ replied", v: "94%" }].map((m, i) => (
        <div key={i} style={{ padding: "12px 14px", borderRadius: 9, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)" }}>
          <div style={{ fontSize: 10.5, color: "var(--rb-fg-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>{m.l}</div>
          <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 22, fontWeight: 700, color: "var(--rb-blue-500)", marginTop: 4, letterSpacing: "-0.025em" }}>{m.v}</div>
        </div>
      ))}
    </div>
    {[{ who: "Alex K.", n: 47, sla: 94 }, { who: "Sam P.", n: 38, sla: 88 }, { who: "Maria J.", n: 31, sla: 100 }, { who: "Kev R.", n: 22, sla: 72 }].map((a, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 99, background: "var(--rb-blue-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{a.who[0]}</div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--rb-fg-1)" }}>{a.who}</div>
        <div style={{ fontSize: 11.5, color: "var(--rb-fg-3)", width: 70, fontFamily: "var(--rb-font-mono)" }}>{a.n} replies</div>
        <div style={{ width: 120, height: 6, borderRadius: 99, background: "var(--rb-bg-sunken)", overflow: "hidden" }}>
          <div style={{ width: `${a.sla}%`, height: 6, background: a.sla >= 90 ? "var(--rb-green-500)" : a.sla >= 80 ? "var(--rb-amber-500)" : "var(--rb-red-500)" }} />
        </div>
        <div style={{ fontSize: 11.5, fontFamily: "var(--rb-font-mono)", color: "var(--rb-fg-1)", width: 36, textAlign: "right", fontWeight: 700 }}>{a.sla}%</div>
      </div>
    ))}
  </div>
);

const ProductPanel = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {[{ t: "Auth & login", p: 78, k: "neg" }, { t: "Onboarding", p: 55, k: "pos" }, { t: "Performance", p: 48, k: "neg" }, { t: "Pricing", p: 32, k: "neg" }, { t: "Notifications", p: 23, k: "neu" }, { t: "Search", p: 16, k: "pos" }].map((t) => (
      <div key={t.t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--rb-fg-1)" }}>{t.t}</div>
        <div style={{ width: 140, height: 6, borderRadius: 99, background: "var(--rb-bg-sunken)", overflow: "hidden" }}>
          <div style={{ width: `${t.p}%`, height: 6, background: t.k === "pos" ? "var(--rb-green-500)" : t.k === "neu" ? "var(--rb-amber-500)" : "var(--rb-red-500)" }} />
        </div>
      </div>
    ))}
  </div>
);

const ReleasePanel = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[{ v: "4.2.1", r: 4.18, d: "−0.42", state: "degraded" }, { v: "4.2.0", r: 4.61, d: "+0.04", state: "healthy" }, { v: "4.1.4", r: 4.57, d: "+0.12", state: "healthy" }, { v: "4.1.3", r: 4.45, d: "−0.03", state: "monitoring" }].map((rel, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9, background: rel.state === "degraded" ? "color-mix(in oklch, var(--rb-red-500) 8%, transparent)" : "var(--rb-bg-sunken)", border: `1px solid ${rel.state === "degraded" ? "color-mix(in oklch, var(--rb-red-500) 24%, transparent)" : "var(--rb-border-1)"}` }}>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: rel.state === "degraded" ? "var(--rb-red-500)" : rel.state === "monitoring" ? "var(--rb-amber-500)" : "var(--rb-green-500)", flexShrink: 0 }} />
        <div style={{ fontFamily: "var(--rb-font-mono)", fontSize: 12.5, color: "var(--rb-fg-1)", fontWeight: 600 }}>v{rel.v}</div>
        <div style={{ flex: 1, fontSize: 11, color: "var(--rb-fg-3)", textTransform: "capitalize", fontFamily: "var(--rb-font-mono)" }}>{rel.state}</div>
        <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 17, fontWeight: 700, color: "var(--rb-fg-1)" }}>{rel.r.toFixed(2)}</div>
        <div style={{ fontFamily: "var(--rb-font-mono)", fontSize: 11.5, color: rel.d.startsWith("−") ? "var(--rb-red-500)" : "var(--rb-green-500)", fontWeight: 700, width: 50, textAlign: "right" }}>{rel.d}</div>
      </div>
    ))}
  </div>
);

const Roles = () => {
  const [active, setActive] = useState("support");
  const role = ROLES.find(r => r.id === active)!;
  return (
    <section style={{ padding: "140px 0", background: "var(--rb-bg-surface)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)" }}>
      <Container>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, gap: 40, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 700 }}>
            <Kicker>For your team</Kicker>
            <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(40px, 4.5vw, 60px)", lineHeight: 0.96, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
              Pick your role.<br />Same inbox, different lens.
            </h2>
          </div>
          <div style={{ display: "inline-flex", padding: 4, borderRadius: 10, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)" }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setActive(r.id)} style={{ padding: "10px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, cursor: "pointer", border: 0, background: active === r.id ? "var(--rb-blue-500)" : "transparent", color: active === r.id ? "#fff" : "var(--rb-fg-2)", fontFamily: "var(--rb-font-text)", letterSpacing: "-0.005em", transition: "all 120ms" }}>{r.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--rb-blue-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, fontFamily: "var(--rb-font-mono)" }}>{role.kicker}</div>
            <h3 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(28px, 3vw, 42px)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--rb-fg-1)", marginBottom: 20 } as React.CSSProperties}>{role.h}</h3>
            <p style={{ fontSize: 16, color: "var(--rb-fg-2)", lineHeight: 1.6, marginBottom: 28 }}>{role.body}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {role.bullets.map(b => <li key={b} style={{ display: "flex", gap: 10, fontSize: 14.5, color: "var(--rb-fg-1)", lineHeight: 1.5 }}><Check size={18} /> {b}</li>)}
            </ul>
            <div style={{ marginTop: 32, padding: "22px 26px", background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)", borderRadius: 12, display: "flex", alignItems: "center", gap: 24 }}>
              <div>
                <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 32, fontWeight: 700, color: "var(--rb-blue-500)", letterSpacing: "-0.03em" }}>{role.metric.v}</div>
                <div style={{ fontSize: 12.5, color: "var(--rb-fg-3)", marginTop: 4 }}>{role.metric.l}</div>
              </div>
              <Link href="/customers/acme-banking" style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 600, color: "var(--rb-fg-1)", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>Read case study <Arrow size={12} /></Link>
            </div>
          </div>
          <div style={{ borderRadius: 14, border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-raised)", overflow: "hidden", boxShadow: "var(--rb-shadow-lg)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--rb-border-1)", display: "flex", alignItems: "center", gap: 10, background: "var(--rb-bg-sunken)" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--rb-fg-3)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>
                {active === "support" ? "/ reply SLA" : active === "product" ? "/ topic clusters" : "/ release health"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)" }}>last 30d</span>
            </div>
            <div style={{ padding: 22, minHeight: 340 }}>
              {active === "support" && <SupportPanel />}
              {active === "product" && <ProductPanel />}
              {active === "release" && <ReleasePanel />}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

// ─── Quote ────────────────────────────────────────────────────────────────────

const QuoteSection = () => (
  <section style={{ padding: "140px 0", background: "var(--rb-bg-canvas)" }}>
    <Container w={1140}>
      <Kicker>Customer story · Acme Banking</Kicker>
      <p style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.035em", color: "var(--rb-fg-1)", marginTop: 24, marginBottom: 40 } as React.CSSProperties}>
        <span style={{ color: "var(--rb-blue-500)" }}>&ldquo;</span>We cut median reply time from 38 hours to 11 minutes and our 30-day rating moved from 4.21 to 4.58. ReviewBox is the first tool I&apos;ve put in front of the support team where nobody asked for training.<span style={{ color: "var(--rb-blue-500)" }}>&rdquo;</span>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 99, background: "linear-gradient(135deg, var(--rb-blue-400), var(--rb-blue-700))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>M</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--rb-fg-1)" }}>Mariejean Cole</div>
            <div style={{ fontSize: 13, color: "var(--rb-fg-3)" }}>Head of Mobile Support, Acme Banking</div>
          </div>
        </div>
        <div style={{ height: 40, width: 1, background: "var(--rb-border-1)" }} />
        <div style={{ display: "flex", gap: 32 }}>
          {[{ v: "4.21 → 4.58", l: "30-day rating in 6 weeks" }, { v: "38h → 11m", l: "Median reply time" }, { v: "94%", l: "1★ reply rate" }].map((m, i) => (
            <div key={i}>
              <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 26, fontWeight: 700, color: "var(--rb-blue-500)", letterSpacing: "-0.025em" }}>{m.v}</div>
              <div style={{ fontSize: 12, color: "var(--rb-fg-3)", marginTop: 4 }}>{m.l}</div>
            </div>
          ))}
        </div>
        <Link href="/customers/acme-banking" style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700, color: "var(--rb-blue-500)", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--rb-font-mono)", textDecoration: "none" }}>FULL CASE STUDY <Arrow size={12} /></Link>
      </div>
    </Container>
  </section>
);

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PricingSection = () => (
  <section style={{ padding: "140px 0", background: "var(--rb-bg-surface)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)" }}>
    <Container>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 64, alignItems: "flex-end", marginBottom: 56 }}>
        <div>
          <Kicker>Pricing</Kicker>
          <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(40px, 4.5vw, 60px)", lineHeight: 0.96, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
            One number.<br />Hold the &quot;contact us.&quot;
          </h2>
        </div>
        <p style={{ fontSize: 17, color: "var(--rb-fg-2)", lineHeight: 1.55, maxWidth: 540 }}>14-day free trial on every tier. No credit card. Annual saves you 20% — we say so in checkout, not in a tooltip.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid var(--rb-border-1)", borderRadius: 18, overflow: "hidden" }}>
        {PRICING.map((p, i) => (
          <div key={p.name} style={{ background: p.popular ? "var(--rb-bg-sunken)" : "var(--rb-bg-raised)", padding: 36, position: "relative", borderRight: i < 2 ? "1px solid var(--rb-border-1)" : 0 }}>
            {p.popular && <span style={{ position: "absolute", top: 24, right: 24, padding: "3px 10px", borderRadius: 99, background: "var(--rb-blue-500)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "var(--rb-font-mono)" }}>MOST POPULAR</span>}
            <div style={{ fontSize: 13, fontWeight: 700, color: p.popular ? "var(--rb-blue-500)" : "var(--rb-fg-2)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>{p.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "16px 0 6px" }}>
              <span style={{ fontFamily: "var(--rb-font-display)", fontSize: 56, fontWeight: 700, letterSpacing: "-0.045em", color: "var(--rb-fg-1)", lineHeight: 1 }}>{p.price}</span>
              <span style={{ fontSize: 14, color: "var(--rb-fg-3)" }}>/ mo</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--rb-fg-3)", marginBottom: 24, lineHeight: 1.5, minHeight: 40 }}>{p.body}</p>
            <Btn kind={p.popular ? "primary" : "secondary"} size="md" href="/sign-up" style={{ width: "100%", justifyContent: "center" }}>{p.cta} <Arrow size={13} /></Btn>
            <div style={{ height: 1, background: "var(--rb-border-1)", margin: "28px 0 22px" }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
              {p.features.map(f => <li key={f} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--rb-fg-2)" }}><Check size={14} /> {f}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 32, fontSize: 13, color: "var(--rb-fg-3)" }}>
        Need SOC 2, custom DPA, or invoicing? <Link href="/contact" style={{ color: "var(--rb-blue-500)", fontWeight: 700 }}>Talk to us →</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        Compared to AppFollow at $399? <Link href="/compare" style={{ color: "var(--rb-blue-500)", fontWeight: 700 }}>See the table →</Link>
      </div>
    </Container>
  </section>
);

// ─── Integrations ─────────────────────────────────────────────────────────────

const Integrations = () => (
  <section style={{ padding: "100px 0", background: "var(--rb-bg-canvas)" }}>
    <Container>
      <div style={{ marginBottom: 40, maxWidth: 720 }}>
        <Kicker>Integrations</Kicker>
        <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(36px, 4vw, 48px)", lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.035em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
          Plugs into the stack<br />you already pay for.
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--rb-border-1)", border: "1px solid var(--rb-border-1)", borderRadius: 14, overflow: "hidden" }}>
        {INTEGRATIONS.map(it => (
          <div key={it.n} style={{ padding: 22, background: "var(--rb-bg-raised)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--rb-font-mono)", fontWeight: 700, fontSize: 13, color: "var(--rb-blue-500)" }}>{it.g}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--rb-fg-1)" }}>{it.n}</div>
            <div style={{ fontSize: 11.5, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)" }}>{it.note}</div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

// ─── Free Tools ───────────────────────────────────────────────────────────────

const Tools = () => (
  <section style={{ padding: "120px 0", background: "var(--rb-bg-surface)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)" }}>
    <Container>
      <div style={{ marginBottom: 48, maxWidth: 800 }}>
        <Kicker>Free tools</Kicker>
        <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(40px, 4.5vw, 60px)", lineHeight: 0.96, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
          Useful <span style={{ fontStyle: "italic", color: "var(--rb-blue-500)" }}>before</span> the trial.
        </h2>
        <p style={{ fontSize: 16, color: "var(--rb-fg-2)", marginTop: 16, maxWidth: 560 }}>Five things we built and gave away. No sign-up, no card, no &ldquo;free with email.&rdquo; Just the tool.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {FREE_TOOLS.map((t, i) => (
          <Link key={t.n} href="/sign-up" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 26, background: "var(--rb-bg-raised)", border: "1px solid var(--rb-border-1)", borderRadius: 14, textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "var(--rb-font-mono)", fontSize: 14, fontWeight: 700, color: "var(--rb-blue-500)" }}>0{i + 1}</div>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--rb-blue-500)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 99, background: "var(--rb-bg-accent-soft)", border: "1px solid color-mix(in oklch, var(--rb-blue-500) 30%, transparent)", fontFamily: "var(--rb-font-mono)" }}>{t.k}</span>
            </div>
            <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 20, fontWeight: 700, color: "var(--rb-fg-1)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>{t.n}</div>
            <div style={{ fontSize: 13.5, color: "var(--rb-fg-3)", lineHeight: 1.55 }}>{t.d}</div>
            <div style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--rb-blue-500)", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em" }}>OPEN TOOL <Arrow size={11} /></div>
          </Link>
        ))}
      </div>
    </Container>
  </section>
);

// ─── Resources ────────────────────────────────────────────────────────────────

const Resources = () => (
  <section style={{ padding: "100px 0", background: "var(--rb-bg-canvas)" }}>
    <Container>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, gap: 40, flexWrap: "wrap" }}>
        <div>
          <Kicker>Resources</Kicker>
          <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 0.98, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>Words about the work.</h2>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {["Blog", "Guides", "Changelog"].map(l => (
            <Link key={l} href={`/${l.toLowerCase()}`} style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rb-fg-2)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em", textDecoration: "none" }}>/{l.toLowerCase()}</Link>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 14 }}>
        <Link href="/blog/ai-cost-reduction" style={{ display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden", border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-surface)", textDecoration: "none" }}>
          <div style={{ aspectRatio: "16/10", background: "linear-gradient(135deg, var(--rb-blue-500) 0%, var(--rb-purple-500) 60%, #1D1D1F 100%)", display: "flex", alignItems: "flex-end", padding: 28 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>Benchmark · 2026</span>
          </div>
          <div style={{ padding: "24px 26px" }}>
            <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 22, lineHeight: 1.18, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--rb-fg-1)", marginBottom: 12 }}>State of App Reviews 2026: 312 apps, 1.8M reviews, one rating crisis.</div>
            <div style={{ fontSize: 14, color: "var(--rb-fg-3)", lineHeight: 1.55 }}>Median rating dropped 0.18★ year-over-year. Reply rates flatlined. We dug into why.</div>
            <div style={{ marginTop: 16, fontSize: 11.5, color: "var(--rb-fg-4)", fontFamily: "var(--rb-font-mono)" }}>32 min read · MAY 2026</div>
          </div>
        </Link>
        {[
          { t: "How to reply to a 1★ review without making it worse", k: "Guide", href: "/blog" },
          { t: "Your rating is a release-engineering metric, actually", k: "Essay", href: "/blog" },
          { t: "12 highest-converting reply templates we've measured", k: "Templates", href: "/reply-kit" },
          { t: "Apple's reply API: what's true, what's coming, what's not", k: "Deep dive", href: "/blog" },
        ].map((p, i) => (
          <Link key={i} href={p.href} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24, borderRadius: 16, border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-surface)", textDecoration: "none" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rb-blue-500)", fontFamily: "var(--rb-font-mono)" }}>{p.k}</div>
            <div style={{ fontFamily: "var(--rb-font-display)", fontSize: 18, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--rb-fg-1)" }}>{p.t}</div>
          </Link>
        ))}
      </div>
    </Container>
  </section>
);

// ─── Security ─────────────────────────────────────────────────────────────────

const Security = () => (
  <section style={{ padding: "100px 0", background: "var(--rb-bg-surface)", borderTop: "1px solid var(--rb-border-1)", borderBottom: "1px solid var(--rb-border-1)" }}>
    <Container>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 64, alignItems: "center" }}>
        <div>
          <Kicker accent="var(--rb-green-500)">Security</Kicker>
          <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(28px, 3vw, 38px)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
            For teams whose security review takes longer than their tooling decision.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[{ t: "SOC 2 Type II", d: "in progress · Q3 target" }, { t: "GDPR + CCPA", d: "EU-hosted option, DPA on request" }, { t: "AES-256 at rest", d: "key rotation every 90d" }, { t: "Row-level security", d: "workspace isolation in-DB" }, { t: "No model training", d: "Groq / Anthropic, no retention" }, { t: "Single sign-on", d: "Okta · Google · custom OIDC" }].map(s => (
            <div key={s.t} style={{ padding: 16, borderRadius: 10, background: "var(--rb-bg-raised)", border: "1px solid var(--rb-border-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={14} color="var(--rb-green-500)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--rb-fg-1)" }}>{s.t}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--rb-fg-3)", marginTop: 6, marginLeft: 22, fontFamily: "var(--rb-font-mono)" }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  </section>
);

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ = () => {
  const [open, setOpen] = useState<number>(0);
  return (
    <section style={{ padding: "140px 0", background: "var(--rb-bg-canvas)" }}>
      <Container w={920}>
        <div style={{ marginBottom: 48 }}>
          <Kicker>FAQ</Kicker>
          <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(40px, 4.5vw, 60px)", lineHeight: 0.96, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--rb-fg-1)", marginTop: 18 } as React.CSSProperties}>
            Questions we get<br />on the sales call.
          </h2>
        </div>
        <div style={{ borderTop: "1px solid var(--rb-border-1)" }}>
          {FAQ_ITEMS.map((f, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--rb-border-1)" }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: "100%", padding: "24px 0", background: "transparent", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", fontFamily: "var(--rb-font-text)" }}>
                <span style={{ fontFamily: "var(--rb-font-mono)", fontSize: 13, color: "var(--rb-fg-4)", width: 32, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: "var(--rb-font-display)", fontSize: 18, fontWeight: 600, color: "var(--rb-fg-1)", letterSpacing: "-0.02em", flex: 1, lineHeight: 1.3 }}>{f.q}</span>
                <span style={{ flexShrink: 0, color: "var(--rb-fg-3)", transform: open === i ? "rotate(45deg)" : "rotate(0)", transition: "transform 160ms", display: "inline-flex" }}>
                  <Plus size={20} />
                </span>
              </button>
              {open === i && <div style={{ paddingBottom: 24, paddingLeft: 48, fontSize: 15, color: "var(--rb-fg-2)", lineHeight: 1.65, maxWidth: 760 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};

// ─── Bottom CTA ───────────────────────────────────────────────────────────────

const BottomCTA = () => (
  <section style={{ padding: "120px 0", background: "var(--rb-bg-canvas)", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 100%, color-mix(in oklch, var(--rb-blue-500) 20%, transparent), transparent 70%)", pointerEvents: "none" }} />
    <Container w={1080}>
      <div style={{ position: "relative", textAlign: "center" }}>
        <Kicker>14-day free trial · no card</Kicker>
        <h2 style={{ fontFamily: "var(--rb-font-display)", fontSize: "clamp(56px, 8vw, 96px)", lineHeight: 0.94, fontWeight: 700, letterSpacing: "-0.045em", color: "var(--rb-fg-1)", margin: "20px 0 24px", textWrap: "balance" } as React.CSSProperties}>
          Reply to your worst review <span style={{ color: "var(--rb-blue-500)" }}>first. We&apos;ll wait.</span>
        </h2>
        <p style={{ fontSize: 18, color: "var(--rb-fg-2)", lineHeight: 1.55, maxWidth: 600, margin: "0 auto 36px" }}>Connect your first app in 60 seconds. Watch ReviewBox draft a reply to the highest-impact review you&apos;ve been ignoring.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Btn size="lg" kind="primary" href="/sign-up">Start free trial <Arrow /></Btn>
          <Btn size="lg" kind="secondary" href="/contact">Book a 20-min demo</Btn>
        </div>
      </div>
    </Container>
  </section>
);

// ─── Page root ────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Hero />
      <InboxShowcase />
      <TrustStrip />
      <Pain />
      <Pillars />
      <DemoSection />
      <Roles />
      <QuoteSection />
      <PricingSection />
      <Integrations />
      <Tools />
      <Resources />
      <Security />
      <FAQ />
      <BottomCTA />
      <MarketingFooter />
    </MarketingShell>
  );
}
