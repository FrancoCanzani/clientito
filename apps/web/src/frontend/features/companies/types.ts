import type { Note } from "@/features/notes/types";
import type { Person } from "@/features/people/types";
import type { Task } from "@/features/tasks/types";

export type Company = {
  id: number;
  domain: string;
  name: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  createdAt: number;
};

export type CompanyListItem = Company & {
  peopleCount: number;
};

export type CompanyDetail = {
  company: Company;
  people: Person[];
  tasks: Task[];
  notes: Note[];
};

export type CompaniesResponse = {
  data: CompanyListItem[];
};

export type CompanyDetailResponse = {
  data: CompanyDetail;
};
