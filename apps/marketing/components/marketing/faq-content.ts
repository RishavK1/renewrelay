/** Answers describe existing product rules, not guarantees about live providers. */
export const faqItems = [
  {
    id: "provider-action",
    question: "Does RenewRelay renew services automatically?",
    answer: "Your agency handles the renewal or cancellation with the provider. RenewRelay keeps the dates, quoted terms, client decision and assigned teammate together, then lets your team record what happened. A client’s approval is not a completed renewal.",
  },
  {
    id: "client-access",
    question: "Do clients need a workspace account?",
    answer: "No. A client responds through a private link scoped to their decision request, after verification. They can approve, decline or ask a question without joining your agency workspace or seeing other client records.",
  },
  {
    id: "trial-access",
    question: "What happens after the trial?",
    answer: "The trial lasts 14 days and includes 10 active renewal items and 3 team seats. If it ends without an active subscription, your records remain available to read and export. Operational changes and outbound reminders pause until access is active again.",
  },
  {
    id: "existing-records",
    question: "Can I bring in existing renewal records?",
    answer: "Yes. You can import renewal records using the supported CSV format, review the preview and confirm the import. You can also add records individually and export your renewal data. The current workspace limits still apply.",
  },
  {
    id: "cancellation",
    question: "What happens when I cancel?",
    answer: "Cancellation is scheduled for the end of your current paid period. You keep paid access through that period, then the workspace moves to read-and-export access. Cancelling the subscription does not renew or cancel services with your clients’ providers.",
  },
] as const;
