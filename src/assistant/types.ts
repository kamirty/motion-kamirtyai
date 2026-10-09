export type AssistantAction =
  | { type: 'export' }
  | { type: 'generate' }
  | { type: 'useIdea'; text: string }
  | { type: 'ask'; text: string }
  | { type: 'link'; href: string };

export interface AssistantButton {
  label: string;
  action: AssistantAction;
}

export interface IdeaCard {
  title: string;
  angle: string;
  /** Description template in the tool's syntax, with [brackets] for the user's own facts. */
  outline: string;
  kinds: string[];
}

export interface AssistantReply {
  /** Plain text; lines starting with "• " render as bullets. No HTML. */
  text: string;
  buttons?: AssistantButton[];
  ideas?: IdeaCard[];
  /** Suggested follow-up questions. */
  suggestions?: string[];
}

/** What the assistant may know about the visitor's current project. */
export interface AssistantContext {
  sceneCount: number;
  kinds: string[];
  aspect: 'landscape' | 'portrait' | 'square';
  music: string;
  sfx: boolean;
  hasImages: boolean;
  exportFormat: 'mp4' | 'webm' | 'none' | 'unknown';
}
