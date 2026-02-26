export function toReminderResponse(record: {
  id: string;
  orgId: string;
  customerId: string;
  userId: string;
  message: string;
  dueAt: number;
  done: boolean;
  createdAt: number;
}) {
  return {
    id: String(record.id),
    orgId: String(record.orgId),
    customerId: String(record.customerId),
    userId: record.userId,
    message: record.message,
    dueAt: record.dueAt,
    done: record.done,
    createdAt: record.createdAt,
  };
}
