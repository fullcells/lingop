import Phaser from "phaser";

import {
  PHASER_FOCUS_SPEECH_ENDED,
  PHASER_FOCUS_SPEECH_STARTED,
  type PhaserFocusSpeechHost,
} from "./focus-speech.js";

export type PhaserSpeechHintAdapter = {
  setHoveredText(text: string | null): void;
  beginSpeaking(text: string): void;
  endSpeaking(): void;
};

export type PhaserFocusSpeechControllerOptions = {
  speak: (text: string) => Promise<void>;
  isEnabled?: () => boolean;
  hint?: PhaserSpeechHintAdapter;
  keyboardKey?: string;
  onError?: (error: unknown) => void;
};

/**
 * Coordinates all focus-language targets in a scene, including the shared
 * keyboard shortcut, speech lifecycle events, and optional screen-level hint.
 */
export class PhaserFocusSpeechController implements PhaserFocusSpeechHost {
  private readonly scene: Phaser.Scene;
  private readonly options: PhaserFocusSpeechControllerOptions;
  private hint: PhaserSpeechHintAdapter | undefined;
  private hoveredText: string | null = null;
  private requestId = 0;
  private readonly keyEvent: string;
  private readonly onKeyDown: () => void;

  constructor(scene: Phaser.Scene, options: PhaserFocusSpeechControllerOptions) {
    this.scene = scene;
    this.options = options;
    this.hint = options.hint;
    this.keyEvent = `keydown-${(options.keyboardKey ?? "S").toUpperCase()}`;
    this.onKeyDown = () => this.speakHoveredText();
    scene.input.keyboard?.on(this.keyEvent, this.onKeyDown);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  setHint(hint: PhaserSpeechHintAdapter | undefined): void {
    this.hint = hint;
    hint?.setHoveredText(this.hoveredText);
  }

  setHoveredFocusText(text: string | null): void {
    this.hoveredText = text;
    this.hint?.setHoveredText(text);
  }

  requestFocusSpeech(text: string): void {
    this.setHoveredFocusText(text);
    this.speakHoveredText();
  }

  speakHoveredText(): void {
    if (!this.hoveredText || this.options.isEnabled?.() === false) return;
    const text = this.hoveredText;
    const requestId = ++this.requestId;
    this.hint?.beginSpeaking(text);
    this.scene.events.emit(PHASER_FOCUS_SPEECH_STARTED, text);
    void this.options.speak(text)
      .catch((error: unknown) => this.options.onError?.(error))
      .finally(() => {
        if (requestId !== this.requestId) return;
        this.hint?.endSpeaking();
        this.scene.events.emit(PHASER_FOCUS_SPEECH_ENDED);
      });
  }

  cancelVisualState(): void {
    this.requestId += 1;
    this.hint?.endSpeaking();
    this.scene.events.emit(PHASER_FOCUS_SPEECH_ENDED);
  }

  destroy(): void {
    this.requestId += 1;
    this.scene.input.keyboard?.off(this.keyEvent, this.onKeyDown);
  }
}
