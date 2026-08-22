import type { AlertPreference } from "@/types/review";

export const mockAlertPreferences: AlertPreference[] = [
  {
    type: "urgent_review",
    label: "Urgent review alert",
    description:
      "Instant notification when a 1-star review with crash or billing tag arrives.",
    enabled: true,
    channels: { email: true, slack: false },
    scheduleTime: undefined,
  },
  {
    type: "critical_spike",
    label: "Critical spike alert",
    description:
      "Alert when negative reviews spike more than 20% in 24 hours.",
    enabled: true,
    channels: { email: true, slack: false },
  },
  {
    type: "daily_digest",
    label: "Daily digest",
    description:
      "Summary of all reviews, reply rate, and top issues from the past 24 hours.",
    enabled: false,
    channels: { email: true, slack: false },
    scheduleTime: "09:00",
  },
  {
    type: "weekly_digest",
    label: "Weekly digest",
    description:
      "Weekly rating trends, sentiment shifts, top issue tags, and reply performance.",
    enabled: true,
    channels: { email: true, slack: false },
    scheduleTime: "09:00",
    scheduleDayOfWeek: 1,
  },
  {
    type: "monthly_report",
    label: "Monthly report",
    description:
      "Full month in review — rating movement, release impact, team response stats.",
    enabled: false,
    channels: { email: true, slack: false },
    scheduleTime: "09:00",
    scheduleDayOfMonth: 1,
  },
];
