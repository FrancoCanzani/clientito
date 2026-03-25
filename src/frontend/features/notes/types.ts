export type Note = {
  id: number;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type NotesListResponse = {
  data: NoteSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type NoteSummary = Pick<Note, "id" | "title" | "isPinned" | "createdAt" | "updatedAt">;
