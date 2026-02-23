export interface SdkInitOptions {
  user?: {
    id: string;
    traits?: Record<string, unknown>;
  };
}

export interface SdkInitResponse {
  releases: SdkRelease[];
  config: {
    theme: Record<string, unknown>;
    position: string;
    zIndex: number;
    customCss: string | null;
    brandingEnabled: boolean;
  };
  checklist: SdkChecklist | null;
}

export interface SdkRelease {
  id: string;
  title: string;
  contentHtml: string;
  displayType: "modal" | "banner" | "changelog";
  showOnce: boolean;
  targetTraits: Record<string, unknown> | null;
  publishedAt: number;
}

export interface SdkChecklist {
  id: string;
  title: string;
  description: string | null;
  items: SdkChecklistItem[];
}

export interface SdkChecklistItem {
  id: string;
  title: string;
  description: string | null;
  trackEvent: string;
  sortOrder: number;
}

export interface SdkTrackEvent {
  type: "view" | "dismiss" | "click" | "checklist_complete";
  releaseId?: string;
  checklistItemId?: string;
  endUserId: string;
  data?: Record<string, unknown>;
}
