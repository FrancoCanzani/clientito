export type Subscription = {
  fromAddr: string;
  fromName: string | null;
  emailCount: number;
  lastReceived: number | null;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  status: "active" | "pending_manual";
};

export type UnsubscribeResult = {
  method: "one-click" | "mailto" | "manual";
  fromAddr: string;
  success: boolean;
  url?: string;
};
