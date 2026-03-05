export type Note = {
  id: number;
  title: string;
  content: string;
  personId: number | null;
  companyId: number | null;
  createdAt: number;
  updatedAt: number;
};

export type NotesListResponse = {
  data: Note[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type NoteSummary = Pick<Note, "id" | "title" | "createdAt" | "updatedAt">;
