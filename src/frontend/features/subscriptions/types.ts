export type Subscription = {
  fromAddr: string;
  fromName: string | null;
  emailCount: number;
  lastReceived: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
};

export type UnsubscribeResult = {
  method: "one-click" | "mailto" | "manual";
  fromAddr: string;
  success: boolean;
  url?: string;
};
