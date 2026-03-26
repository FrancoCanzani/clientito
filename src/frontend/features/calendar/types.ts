export type AgendaEvent = {
  id: string;
  source: "google" | "proposed";
  title: string;
  startAt: number;
  endAt: number;
  location?: string;
  isAllDay: boolean;
  status: "confirmed" | "pending";
  htmlLink?: string;
  proposedId?: number;
  emailId?: number;
  description?: string;
};
