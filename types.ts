
export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'none';

export interface TransitionSettings {
  type: TransitionType;
  duration: number; // in ms
}

export interface Scene {
  id: number;
  narrative: string;
  imagePrompt: string;
  imageData?: string; // Base64 image
  audioData?: AudioBuffer; // Decoded audio buffer
  audioBase64?: string; // Raw Base64 PCM for storage/rehydration
  transition?: TransitionSettings;
}

export type MusicMood = 'none' | 'ethereal' | 'suspense' | 'scifi';

export interface Story {
  title: string;
  scenes: Scene[];
  backgroundMusic?: MusicMood;
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  REVIEW_STORY = 'REVIEW_STORY',
  PLAYING = 'PLAYING',
  EXPORTING = 'EXPORTING',
  ERROR = 'ERROR'
}

export interface GenerationProgress {
  totalScenes: number;
  completedScenes: number;
  currentStep: string;
}
