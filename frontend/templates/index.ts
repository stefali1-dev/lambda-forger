import { CHAT_COMPLETION_TEMPLATE } from "./chatCompletion";

export const templates = {
  chatCompletion: CHAT_COMPLETION_TEMPLATE,
} as const;

export type TemplateName = keyof typeof templates;
