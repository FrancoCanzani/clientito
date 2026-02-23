import type { Integration, IntegrationType } from "@releaselayer/shared";

export type IntegrationsResponse = { data: Integration[] };

export type CreateIntegrationInput = {
  type: IntegrationType;
  config: Record<string, unknown>;
  isActive?: boolean;
};

export type UpdateIntegrationInput = Partial<CreateIntegrationInput>;
