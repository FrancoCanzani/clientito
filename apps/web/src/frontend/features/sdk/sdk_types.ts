export interface SdkConfigRow {
  projectId: string;
  theme: string | null;
  position: string | null;
  zIndex: number | null;
  customCss: string | null;
  updatedAt: number;
}

export type SdkConfigResponse = {
  data: SdkConfigRow | null;
  sdkKey: string;
};

export type UpdateSdkConfigInput = {
  position: string;
  zIndex: number;
  customCss: string | null;
  theme: Record<string, unknown>;
};
