export type Label = {
  gmailId: string;
  name: string;
  type: "system" | "user";
  textColor: string | null;
  backgroundColor: string | null;
  messagesTotal: number;
  messagesUnread: number;
};

export type CreateLabelInput = {
  name: string;
  textColor?: string;
  backgroundColor?: string;
};

export type UpdateLabelInput = {
  name?: string;
  textColor?: string;
  backgroundColor?: string;
};

export const GMAIL_LABEL_COLORS = [
  { bg: "#000000", text: "#ffffff" },
  { bg: "#434343", text: "#ffffff" },
  { bg: "#666666", text: "#ffffff" },
  { bg: "#999999", text: "#ffffff" },
  { bg: "#cccccc", text: "#000000" },
  { bg: "#efefef", text: "#000000" },
  { bg: "#f3f3f3", text: "#000000" },
  { bg: "#fb4c2f", text: "#ffffff" },
  { bg: "#ffad47", text: "#000000" },
  { bg: "#fad165", text: "#000000" },
  { bg: "#16a766", text: "#ffffff" },
  { bg: "#43d692", text: "#000000" },
  { bg: "#4a86e8", text: "#ffffff" },
  { bg: "#a479e2", text: "#ffffff" },
  { bg: "#f691b3", text: "#000000" },
  { bg: "#f6c5be", text: "#000000" },
  { bg: "#ffe6c7", text: "#000000" },
  { bg: "#fef1d1", text: "#000000" },
  { bg: "#b9e4d0", text: "#000000" },
  { bg: "#c6f3de", text: "#000000" },
  { bg: "#c9daf8", text: "#000000" },
  { bg: "#e4d7f5", text: "#000000" },
  { bg: "#fcdee8", text: "#000000" },
  { bg: "#eba8a8", text: "#000000" },
  { bg: "#f7cb4d", text: "#000000" },
  { bg: "#68dfa9", text: "#000000" },
  { bg: "#6d9eeb", text: "#ffffff" },
  { bg: "#b694e8", text: "#ffffff" },
  { bg: "#f7a7c0", text: "#000000" },
  { bg: "#cc3a21", text: "#ffffff" },
  { bg: "#eaa041", text: "#000000" },
  { bg: "#f2c960", text: "#000000" },
  { bg: "#149e60", text: "#ffffff" },
  { bg: "#3dc789", text: "#000000" },
  { bg: "#3c78d8", text: "#ffffff" },
  { bg: "#8e63ce", text: "#ffffff" },
  { bg: "#e07798", text: "#ffffff" },
] as const;
