import type { Note } from "@/features/notes/types";
import type { Task } from "@/features/tasks/types";

export type Person = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  title: string | null;
  linkedin: string | null;
  companyId: number | null;
  companyName: string | null;
  companyDomain: string | null;
  lastContactedAt: number | null;
  createdAt: number;
};

export type PersonEmail = {
  id: number;
  threadId: string | null;
  fromAddr: string;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
};

export type PersonDetail = {
  person: Person;
  recentEmails: PersonEmail[];
  openTasks: Task[];
  notes: Note[];
};

export type PersonContext = {
  briefing: string;
  suggestedActions: string[];
};

export type PeopleListResponse = {
  data: Person[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type PersonDetailResponse = {
  data: PersonDetail;
};
