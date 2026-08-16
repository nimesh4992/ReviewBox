/**
 * brand-voice-stubs.ts
 *
 * Category-specific brand voice stubs pre-filled when a workspace is created.
 * The user can edit or replace these in Settings → AI brand voice.
 *
 * These are deliberately concise (≤ 2 sentences) to stay under the 200-token
 * system prompt budget while still meaningfully shaping AI tone.
 */

export type AppCategory =
  | "productivity"
  | "health_fitness"
  | "finance"
  | "gaming"
  | "shopping"
  | "social"
  | "education"
  | "travel"
  | "utility"
  | "other";

/**
 * `icon` names a lucide icon, resolved to a component by the client that
 * renders it. These were emoji, which draw as a different picture on every
 * operating system and read as a template rather than a product. The name is
 * kept as a plain string so this module stays free of React imports — the
 * onboarding API routes import it server-side.
 */
export const APP_CATEGORIES: { id: AppCategory; label: string; icon: string }[] = [
  { id: "productivity",   label: "Productivity",     icon: "ListChecks" },
  { id: "health_fitness", label: "Health & Fitness", icon: "HeartPulse" },
  { id: "finance",        label: "Finance",          icon: "Wallet" },
  { id: "gaming",         label: "Gaming",           icon: "Gamepad2" },
  { id: "shopping",       label: "Shopping",         icon: "ShoppingBag" },
  { id: "social",         label: "Social",           icon: "Users" },
  { id: "education",      label: "Education",        icon: "GraduationCap" },
  { id: "travel",         label: "Travel",           icon: "Plane" },
  { id: "utility",        label: "Utility",          icon: "Wrench" },
  { id: "other",          label: "Other",            icon: "Shapes" },
];

/**
 * Pre-written brand voice stubs, one per category.
 * Injected into AI system prompts as the starting brand voice
 * until the workspace owner customises it in Settings.
 */
export const BRAND_VOICE_STUBS: Record<AppCategory, string> = {
  productivity:
    "We help people get more done. We reply efficiently, respect the user's time, and always provide a concrete next step. We're professional but approachable — never robotic.",

  health_fitness:
    "We're an encouraging fitness companion. We reply warmly, celebrate effort, and never shame or lecture. Our tone is positive, motivating, and uses simple everyday language.",

  finance:
    "We handle people's money, so trust is everything. We reply calmly and clearly, acknowledge concerns without dismissing them, and always point to a specific action or contact. We avoid jargon.",

  gaming:
    "We make games — we keep it fun. We reply with energy and personality, acknowledge frustration quickly, and keep responses short and punchy. We're on the player's side.",

  shopping:
    "Shopping should be easy and enjoyable. We reply helpfully and quickly, resolve issues without friction, and always leave the customer feeling valued. Friendly, not corporate.",

  social:
    "Community is everything to us. We reply with warmth and genuine care, take feedback seriously, and never sound defensive. We want every user to feel heard.",

  education:
    "Learning is personal. We reply patiently and clearly, celebrate questions, and explain things without condescension. We're supportive, precise, and always constructive.",

  travel:
    "Travel plans are stressful enough. We reply calmly and quickly, resolve issues with minimal steps, and always leave the user feeling confident about their next move.",

  utility:
    "We solve problems quietly. We reply directly with clear troubleshooting steps, avoid over-apologising, and get the user back on track fast. Practical and reliable.",

  other:
    "We care about our users and take every piece of feedback seriously. We reply honestly, helpfully, and always with a path forward. We're human, not a support bot script.",
};

/**
 * Returns the brand voice stub for a given category.
 * Falls back to the "other" stub for unrecognised values.
 */
export function getBrandVoiceStub(category: string): string {
  return BRAND_VOICE_STUBS[category as AppCategory] ?? BRAND_VOICE_STUBS.other;
}

/**
 * Starter Reply-Kit templates seeded for every new workspace.
 * These populate Tier-0 immediately so users get personalised matches
 * from day one without building their own library first.
 */
export const STARTER_REPLY_TEMPLATES: Array<{
  name: string;
  content: string;
  tags: string[];
  rating_min: number;
  rating_max: number;
}> = [
  {
    name:       "5-star thank you",
    content:    "Thank you so much for the 5 stars! We're thrilled you're enjoying {appName}. It means a lot to our team. If you ever have ideas or need help, reach out at {supportEmail}.\n\n- {teamName}",
    tags:       [],
    rating_min: 5,
    rating_max: 5,
  },
  {
    name:       "Crash acknowledgement",
    content:    "We're very sorry for the crash. That's not the experience we want for you. Our team is investigating and a fix is in progress. Please email {supportEmail} with your device model so we can look into your specific case.\n\n- {teamName}",
    tags:       ["crash"],
    rating_min: 1,
    rating_max: 3,
  },
  {
    name:       "Billing issue",
    content:    "We're sorry about the billing issue, and we'll get this sorted for you. Please email {supportEmail} with your account email and transaction details and our team will resolve it within 24 hours.\n\n- {teamName}",
    tags:       ["billing"],
    rating_min: 1,
    rating_max: 4,
  },
  {
    name:       "Login problem",
    content:    "Sorry you're having trouble signing in. Please try the 'Forgot password' link first. If that doesn't work, email {supportEmail} with your account email and we'll get you back in right away.\n\n- {teamName}",
    tags:       ["login"],
    rating_min: 1,
    rating_max: 3,
  },
  {
    name:       "Feature request",
    content:    "Thank you for the suggestion! We've logged this with our product team. Requests like yours directly shape our roadmap. Email {supportEmail} if you'd like to be notified when it ships.\n\n- {teamName}",
    tags:       ["feature-request"],
    rating_min: 1,
    rating_max: 5,
  },
  {
    name:       "Performance complaint",
    content:    "Thanks for flagging this. Performance issues are a top priority. Try clearing the app cache for now, and watch for our next update. If it persists, email {supportEmail} with your device model.\n\n- {teamName}",
    tags:       ["performance"],
    rating_min: 1,
    rating_max: 3,
  },
];
