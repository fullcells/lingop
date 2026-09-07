import Phaser from "phaser";

import { nestedPhaserTextObjects } from "./text-utils.js";

export const PHASER_FOCUS_SPEECH_STARTED = "lingop-focus-speech-started";
export const PHASER_FOCUS_SPEECH_ENDED = "lingop-focus-speech-ended";

export type PhaserFocusSpeechHost = {
  setHoveredFocusText(text: string | null): void;
  requestFocusSpeech(text: string): void;
};

export type BindPhaserFocusSpeechOptions = {
  host: PhaserFocusSpeechHost;
  getSpeechText: () => string;
  getFocusObjects?: () => Phaser.GameObjects.GameObject[];
  speakOnPress?: boolean;
  hoverColor?: string;
  speakingColor?: string;
  hoverDuration?: number;
  speakingStartedEvent?: string;
  speakingEndedEvent?: string;
};

/** Adds reusable hover, press-to-speak, and active-speaking states. */
export function bindPhaserFocusSpeech<
  T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform,
>(scene: Phaser.Scene, target: T, options: BindPhaserFocusSpeechOptions): T {
  const {
    host,
    getSpeechText,
    getFocusObjects = () => [target],
    speakOnPress = true,
    hoverColor = "#f0d48f",
    speakingColor = "#7ed6c3",
    hoverDuration = 180,
    speakingStartedEvent = PHASER_FOCUS_SPEECH_STARTED,
    speakingEndedEvent = PHASER_FOCUS_SPEECH_ENDED,
  } = options;
  let hovered = false;
  const originalColors = new Map<Phaser.GameObjects.Text, string>();
  const focusTexts = (): Phaser.GameObjects.Text[] =>
    getFocusObjects().flatMap((object) => nestedPhaserTextObjects(object));
  const tint = (color: string): void => {
    if (originalColors.size === 0) {
      focusTexts().forEach((text) => {
        if (typeof text.style.color === "string") originalColors.set(text, text.style.color);
      });
    }
    focusTexts().forEach((text) => {
      if (text.active) text.setColor(color);
    });
  };
  const restore = (): void => {
    originalColors.forEach((color, text) => {
      if (text.active) text.setColor(color);
    });
    originalColors.clear();
  };
  const settle = (): void => {
    const texts = focusTexts();
    scene.tweens.killTweensOf(texts);
    texts.forEach((text) => text.setAlpha(1));
  };
  const onSpeechStarted = (text: string): void => {
    if (!hovered || text !== getSpeechText()) return;
    tint(speakingColor);
    const texts = focusTexts();
    scene.tweens.killTweensOf(texts);
    scene.tweens.add({ targets: texts, alpha: 0.78, duration: 280, yoyo: true, repeat: 1, ease: "Sine.InOut" });
  };
  const onSpeechEnded = (): void => {
    settle();
    if (hovered) tint(hoverColor);
  };

  if (!target.input) target.setInteractive({ useHandCursor: true });
  else target.input.cursor = "pointer";
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
    hovered = true;
    host.setHoveredFocusText(getSpeechText());
    tint(hoverColor);
    const texts = focusTexts();
    scene.tweens.killTweensOf(texts);
    texts.forEach((text) => text.setAlpha(0.76));
    scene.tweens.add({ targets: texts, alpha: 1, duration: hoverDuration, ease: "Sine.Out" });
  });
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    hovered = false;
    host.setHoveredFocusText(null);
    settle();
    restore();
  });
  if (speakOnPress) {
    target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => host.requestFocusSpeech(getSpeechText()));
  }
  scene.events.on(speakingStartedEvent, onSpeechStarted);
  scene.events.on(speakingEndedEvent, onSpeechEnded);
  target.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(speakingStartedEvent, onSpeechStarted);
    scene.events.off(speakingEndedEvent, onSpeechEnded);
  });
  return target;
}
