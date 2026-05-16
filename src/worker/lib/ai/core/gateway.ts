import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { createWorkersAI } from "workers-ai-provider";
import type { z } from "zod";
import { AiError, type AiFeatureConfig, type AiRequestMetadata } from "./types";

type GatewayEnv = Env & {
  CLOUDFLARE_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  CF_AIG_TOKEN?: string;
};

type ConfiguredGatewayEnv = Env & {
  CLOUDFLARE_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  CF_AIG_TOKEN?: string;
};

function metadata(input: AiRequestMetadata) {
  return {
    user_id: input.userId,
    mailbox_id: input.mailboxId,
    feature: input.feature,
    plan: input.plan,
    request_id: input.requestId,
  };
}

function resolveGatewayEnv(env: Env): ConfiguredGatewayEnv {
  const gatewayEnv = env as GatewayEnv;
  if (!gatewayEnv.CLOUDFLARE_ACCOUNT_ID || !gatewayEnv.AI_GATEWAY_ID) {
    throw new AiError("AI_PROVIDER_UNAVAILABLE", "AI Gateway is not configured");
  }
  return gatewayEnv as ConfiguredGatewayEnv;
}

function createWorkersAiModel(
  env: ConfiguredGatewayEnv,
  input: AiRequestMetadata,
  config: AiFeatureConfig<z.ZodTypeAny | null>,
) {
  const workersAi = createWorkersAI({
    binding: env.AI,
    gateway: {
      id: env.AI_GATEWAY_ID,
      skipCache: true,
      collectLog: true,
      metadata: metadata(input),
    },
  });
  return workersAi(config.model as `@cf/${string}`, {
    ...(config.reasoning === "off"
      ? {
          reasoning_effort: null,
          chat_template_kwargs: {
            enable_thinking: false,
          },
        }
      : {}),
  });
}

function createUnifiedGatewayModel(
  env: ConfiguredGatewayEnv,
  input: AiRequestMetadata,
  config: AiFeatureConfig<z.ZodTypeAny | null>,
) {
  const gateway = createAiGateway({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: env.AI_GATEWAY_ID,
    apiKey: env.CF_AIG_TOKEN,
    options: {
      skipCache: true,
      collectLog: true,
      metadata: metadata(input),
    },
  });
  const unified = createUnified();
  return gateway(unified(`openai/${config.model}`));
}

export function createAiModel(
  env: Env,
  input: AiRequestMetadata,
  config: AiFeatureConfig<z.ZodTypeAny | null>,
) {
  const gatewayEnv = resolveGatewayEnv(env);
  if (config.provider === "workers-ai") {
    return createWorkersAiModel(gatewayEnv, input, config);
  }
  return createUnifiedGatewayModel(gatewayEnv, input, config);
}
