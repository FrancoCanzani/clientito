export type EmailView =
 | "inbox"
 | "sent"
 | "spam"
 | "trash"
 | "archived"
 | "starred"
 | "important";

export type EmailFolderView = Exclude<EmailView, "inbox">;
export type InboxLabelView = "important" | (string & {});

const VIEW_VALUES: ReadonlyArray<EmailView> = [
 "inbox",
 "sent",
 "spam",
 "trash",
 "archived",
 "starred",
 "important",
];

const FOLDER_VIEW_VALUES: ReadonlyArray<EmailFolderView> = [
 "sent",
 "spam",
 "trash",
 "archived",
 "starred",
];

const INBOX_LABEL_VALUES: ReadonlyArray<InboxLabelView> = [
 "important",
];

const VIEW_VALUE_SET = new Set<string>(VIEW_VALUES);
const FOLDER_VIEW_SET = new Set<string>(FOLDER_VIEW_VALUES);
const INBOX_LABEL_SET = new Set<string>(INBOX_LABEL_VALUES);
const NUMERIC_PARAM_PATTERN = /^\d+$/;

export function isEmailView(value: unknown): value is EmailView {
 return typeof value === "string" && VIEW_VALUE_SET.has(value);
}

export function isEmailFolderView(value: unknown): value is EmailFolderView {
 return typeof value === "string" && FOLDER_VIEW_SET.has(value);
}

export function isInboxLabelView(value: unknown): value is InboxLabelView {
 return typeof value === "string" && (INBOX_LABEL_SET.has(value) || value.startsWith("Label_"));
}

export function parseEmailFolderParam(value: string): EmailFolderView {
 if (isEmailFolderView(value)) {
 return value;
 }

 throw new Error("Invalid email folder");
}

export function parseInboxLabelParam(value: string): InboxLabelView {
 if (isInboxLabelView(value)) {
 return value;
 }

 throw new Error("Invalid inbox label");
}

export function parseEmailIdParam(value: string): string {
 if (NUMERIC_PARAM_PATTERN.test(value)) {
 return value;
 }

 throw new Error("Invalid email id");
}

export const VIEW_LABELS: Record<EmailView, string> = {
 inbox: "Inbox",
 sent: "Sent",
 spam: "Spam",
 trash: "Trash",
 archived: "Done",
 starred: "Starred",
 important: "Important",
};
