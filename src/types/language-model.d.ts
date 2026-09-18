/**
 * Chrome's built-in Prompt API, typed locally.
 *
 * Stable for extensions since Chrome 138 and **needs no manifest entry**: the
 * old `aiLanguageModelOriginTrial` permission is for the trial that ended and
 * must not be added — Chrome rejects an unknown permission and the extension
 * fails to load. `@types/chrome` does not carry `LanguageModel`, so this is the
 * declaration rather than a `chrome.*` namespace.
 *
 * Only the members this project calls are declared. Every one of them is behind
 * an `"LanguageModel" in self` check at the call site, because the hardware
 * requirement (22GB free disk, a 4GB GPU or 16GB of RAM) means most student
 * laptops will not have it and its absence has to read as today's behaviour.
 */

declare global {
  type LanguageModelAvailability = "unavailable" | "downloadable" | "downloading" | "available";

  interface LanguageModelInitialPrompt {
    role: "system" | "user" | "assistant";
    content: string;
  }

  interface LanguageModelCreateOptions {
    initialPrompts?: LanguageModelInitialPrompt[];
    expectedInputs?: { type: "text" | "image" | "audio"; languages?: string[] }[];
    expectedOutputs?: { type: "text"; languages?: string[] }[];
    monitor?: (monitor: EventTarget) => void;
    signal?: AbortSignal;
    temperature?: number;
    topK?: number;
  }

  interface LanguageModelPromptOptions {
    /** A JSON Schema the answer is constrained to. */
    responseConstraint?: object;
    omitResponseConstraintInput?: boolean;
    signal?: AbortSignal;
  }

  interface LanguageModelSession {
    prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
    /**
     * A new session with this one's initial prompts and none of its history.
     *
     * The reason this project needs it: a session accumulates, so a second
     * `prompt()` on one session sends the first prompt, the first answer and
     * the second prompt — while the summary in each was sized for an empty
     * window. `authorAdapter` retries, so every attempt runs on a clone.
     */
    clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
    /** Tokens this model can hold, shared between the prompt and the answer. */
    readonly contextWindow: number;
    readonly inputUsage: number;
    readonly inputQuota: number;
    measureInputUsage(input: string, options?: LanguageModelPromptOptions): Promise<number>;
    destroy(): void;
  }

  const LanguageModel: {
    availability(options?: LanguageModelCreateOptions): Promise<LanguageModelAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  };
}

export {};
