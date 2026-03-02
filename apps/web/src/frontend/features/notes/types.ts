export type Note = {
  id: number;
  content: string;
  personId: number | null;
  companyId: number | null;
  createdAt: number;
};
