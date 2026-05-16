import type {
  TagDefinition,
  ReplyTemplate,
  AIReplyStyle,
  KnowledgeBaseEntry,
} from "@/types/review";

export const mockTags: TagDefinition[] = [
  // Bugs
  { id: "tag-crash", name: "Crash", color: "#ef4444", category: "bugs" },
  { id: "tag-login", name: "Login issues", color: "#ef4444", category: "bugs" },
  { id: "tag-performance", name: "Performance", color: "#ef4444", category: "bugs" },
  { id: "tag-freeze", name: "App freeze", color: "#ef4444", category: "bugs" },
  { id: "tag-connection", name: "Connection issues", color: "#ef4444", category: "bugs" },
  { id: "tag-payment", name: "Payment issues", color: "#ef4444", category: "bugs" },
  { id: "tag-ui", name: "UI issues", color: "#ef4444", category: "bugs" },

  // User Feedback
  { id: "tag-feature-request", name: "Feature request", color: "#6366f1", category: "user_feedback" },
  { id: "tag-satisfied", name: "Satisfied user", color: "#6366f1", category: "user_feedback" },
  { id: "tag-complicated", name: "App complicated", color: "#6366f1", category: "user_feedback" },
  { id: "tag-notifications", name: "Notifications", color: "#6366f1", category: "user_feedback" },
  { id: "tag-app-update", name: "App update", color: "#6366f1", category: "user_feedback" },

  // Monetization
  { id: "tag-pricing", name: "Pricing", color: "#f59e0b", category: "monetization" },
  { id: "tag-refund", name: "Refund request", color: "#f59e0b", category: "monetization" },
  { id: "tag-monetization", name: "Monetization", color: "#f59e0b", category: "monetization" },
  { id: "tag-fraud", name: "Fraud/scam", color: "#f59e0b", category: "monetization" },
  { id: "tag-subscription", name: "Subscription", color: "#f59e0b", category: "monetization" },
  { id: "tag-billing-error", name: "Billing error", color: "#f59e0b", category: "monetization" },
];

export const mockTemplates: ReplyTemplate[] = [
  {
    id: "tpl-1",
    name: "Thank you â€” 5 star",
    content:
      "Thank you so much for the 5 stars! We're thrilled you're enjoying the experience. Your support means everything to our team.",
    tags: ["feature-request"],
    ratingRange: [5, 5],
    language: "English",
    usageCount: 47,
    createdAt: "Apr 1, 2026",
  },
  {
    id: "tpl-2",
    name: "Crash acknowledgement",
    content:
      "Hi there, we're very sorry to hear you're experiencing crashes. Our team is actively investigating this issue. Please update to the latest version â€” if the problem persists, email us at hello@tryreviewbox.com with your device model.",
    tags: ["crash"],
    ratingRange: [1, 2],
    language: "English",
    usageCount: 23,
    createdAt: "Apr 3, 2026",
  },
  {
    id: "tpl-3",
    name: "Billing complaint",
    content:
      "We sincerely apologize for the billing inconvenience. Please contact hello@tryreviewbox.com directly and our team will resolve this within 24 hours.",
    tags: ["billing"],
    ratingRange: [1, 3],
    language: "English",
    usageCount: 18,
    createdAt: "Apr 5, 2026",
  },
  {
    id: "tpl-4",
    name: "Feature request â€” logged",
    content:
      "Thank you for the suggestion! We've logged this with our product team. Feature requests from users like you directly shape our roadmap.",
    tags: ["feature-request"],
    ratingRange: [3, 5],
    language: "English",
    usageCount: 31,
    createdAt: "Apr 10, 2026",
  },
  {
    id: "tpl-5",
    name: "Login issue",
    content:
      "We're sorry you're having trouble logging in. Please try: 1) Clear app cache, 2) Update to latest version, 3) Reset password. If the issue persists, contact hello@tryreviewbox.com.",
    tags: ["login"],
    ratingRange: [1, 3],
    language: "English",
    usageCount: 14,
    createdAt: "Apr 12, 2026",
  },
  {
    id: "tpl-6",
    name: "Performance â€” fix incoming",
    content:
      "Thank you for flagging this. We've identified the cause of the slowdown and a fix is shipping in the next update. We appreciate your patience.",
    tags: ["performance"],
    ratingRange: [2, 4],
    language: "English",
    usageCount: 9,
    createdAt: "Apr 20, 2026",
  },
];

export const mockAIStyles: AIReplyStyle[] = [
  {
    id: "professional",
    name: "Professional",
    description: "Formal, brand-safe, clear action steps",
    tone: "professional",
    isDefault: true,
    exampleInput: "App keeps crashing",
    exampleOutput:
      "Thank you for bringing this to our attention. We sincerely apologize for the inconvenience. Our engineering team is actively investigating this issue and a fix will be released shortly.",
  },
  {
    id: "empathetic",
    name: "Empathetic",
    description: "Warm, human, acknowledges frustration",
    tone: "empathetic",
    isDefault: false,
    exampleInput: "App keeps crashing",
    exampleOutput:
      "We're really sorry this is happening â€” that sounds incredibly frustrating. Our team is on it and we'll have this fixed as soon as possible. Thank you for your patience.",
  },
  {
    id: "direct",
    name: "Direct",
    description: "Short, no fluff, action-first",
    tone: "direct",
    isDefault: false,
    exampleInput: "App keeps crashing",
    exampleOutput:
      "Sorry for the crash. Fix shipping next update. Email hello@tryreviewbox.com if urgent.",
  },
  {
    id: "casual",
    name: "Casual",
    description: "Friendly, conversational, approachable",
    tone: "casual",
    isDefault: false,
    exampleInput: "App keeps crashing",
    exampleOutput:
      "Ugh, so sorry about that! We know crashes are the worst. Our team is already on it â€” update should be out soon. Hang tight!",
  },
];

export const mockKnowledgeBase: KnowledgeBaseEntry[] = [
  {
    id: "kb-1",
    title: "Current known issues",
    content:
      "v5.42.0 crash on Android 14: fix ships in v5.42.1 (ETA: Monday). Login loop on Samsung S-series: workaround is clearing cache.",
    category: "known_issue",
    createdAt: "May 8, 2026",
  },
  {
    id: "kb-2",
    title: "Product overview",
    content:
      "ReviewBox is an AI-powered app review management tool. We help teams reply faster, spot trends, and protect their ratings.",
    category: "product",
    createdAt: "Apr 1, 2026",
  },
  {
    id: "kb-3",
    title: "Common FAQs",
    content:
      "Q: How do I cancel? A: Settings > Billing > Cancel subscription. Q: Do you support iOS? A: Google Play only for now, App Store coming soon.",
    category: "faq",
    createdAt: "Apr 1, 2026",
  },
  {
    id: "kb-4",
    title: "Roadmap highlights",
    content:
      "Q2 2026: App Store support, Automation rules, Slack integration. Q3 2026: Multi-language reply generation, API access.",
    category: "roadmap",
    createdAt: "May 1, 2026",
  },
];

