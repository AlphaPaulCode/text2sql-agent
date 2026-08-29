import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const WRITER_MODEL = process.env.WRITER_MODEL ?? "claude-opus-5";
export const CRITIC_MODEL = process.env.CRITIC_MODEL ?? "claude-opus-5";

// USD per million tokens (input, output)
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function newUsage(): UsageTotals {
  return { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

const client = new Anthropic();

export async function callStructured<S extends z.ZodType>(opts: {
  model: string;
  system: string;
  user: string;
  schema: S;
  schemaName: string;
  usage: UsageTotals;
}): Promise<z.infer<S>> {
  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });

  opts.usage.calls += 1;
  opts.usage.inputTokens += response.usage.input_tokens;
  opts.usage.outputTokens += response.usage.output_tokens;
  const [inP, outP] = PRICES[opts.model] ?? PRICES["claude-opus-5"];
  opts.usage.costUsd +=
    (response.usage.input_tokens * inP + response.usage.output_tokens * outP) / 1e6;

  if (response.stop_reason === "refusal") {
    throw new Error("Model refused the request (stop_reason: refusal).");
  }
  if (response.parsed_output == null) {
    throw new Error(`Model output did not match the ${opts.schemaName} schema.`);
  }
  return response.parsed_output;
}
