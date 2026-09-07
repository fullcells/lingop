import Phaser from "phaser";

import {
  PhaserBilingualLabel,
  type PhaserBilingualContent,
  type PhaserBilingualLabelOptions,
} from "./bilingual-label.js";
import { bindPhaserFocusSpeech, type PhaserFocusSpeechHost } from "./focus-speech.js";

export type PhaserBilingualButtonTheme = {
  background: number;
  hoverBackground: number;
  selectedBackground: number;
  shadow: number;
  accent: number;
  iconTint: number;
  hoverIconTint: number;
  disabledAlpha: number;
  radius: number;
};

export type PhaserButtonIconOptions = {
  texture: string;
  frame?: string | number;
  size?: number;
  tint?: number;
  x?: number;
};

export type PhaserBilingualButtonOptions = {
  width: number;
  height: number;
  content: PhaserBilingualContent;
  onPress: () => void;
  label?: PhaserBilingualLabelOptions;
  icon?: PhaserButtonIconOptions;
  speechHost?: PhaserFocusSpeechHost;
  speakOnPress?: boolean;
  theme?: Partial<PhaserBilingualButtonTheme>;
  enabled?: boolean;
  selected?: boolean;
  toggleState?: boolean;
};

const DEFAULT_THEME: PhaserBilingualButtonTheme = {
  background: 0x172c26,
  hoverBackground: 0x1c352d,
  selectedBackground: 0x24533f,
  shadow: 0x000000,
  accent: 0xc8a45b,
  iconTint: 0xf3ead7,
  hoverIconTint: 0xffffff,
  disabledAlpha: 0.38,
  radius: 10,
};

/** A ready-made bilingual Phaser button with optional icon and toggle state. */
export class PhaserBilingualButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly hoverSurface: Phaser.GameObjects.Graphics;
  private readonly label: PhaserBilingualLabel;
  private readonly theme: PhaserBilingualButtonTheme;
  private readonly widthPx: number;
  private readonly heightPx: number;
  private readonly onPress: () => void;
  private icon: Phaser.GameObjects.Image | null = null;
  private toggleObjects: Phaser.GameObjects.GameObject[] = [];
  private enabledState: boolean;
  private selectedState: boolean;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PhaserBilingualButtonOptions) {
    super(scene, x, y);
    this.widthPx = options.width;
    this.heightPx = options.height;
    this.onPress = options.onPress;
    this.theme = { ...DEFAULT_THEME, ...options.theme };
    this.enabledState = options.enabled ?? true;
    this.selectedState = options.selected ?? false;
    this.background = scene.add.graphics();
    this.hoverSurface = scene.add.graphics();
    this.hoverSurface.fillStyle(this.theme.accent, 0.18)
      .fillRoundedRect(-this.widthPx / 2 + 2, -this.heightPx / 2 + 2, this.widthPx - 4, this.heightPx - 4, this.theme.radius)
      .setAlpha(0);
    const labelOptions = { ...options.label };
    delete labelOptions.speechHost;
    this.label = new PhaserBilingualLabel(scene, 0, 0, options.content, labelOptions);
    this.add([this.background, this.hoverSurface, this.label]);
    this.setSize(this.widthPx, this.heightPx);
    scene.add.existing(this);
    if (options.icon) this.setIcon(options.icon);
    if (options.toggleState !== undefined) this.setToggleState(options.toggleState);
    this.setEnabled(this.enabledState);
    this.setSelected(this.selectedState);

    if (options.speechHost) {
      bindPhaserFocusSpeech(scene, this, {
        host: options.speechHost,
        getSpeechText: () => this.label.speechText,
        getFocusObjects: () => this.label.focusVisualObjects(),
        speakOnPress: options.speakOnPress ?? true,
      });
    }
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (!this.enabledState) return;
      this.hovered = true;
      this.draw();
      scene.tweens.killTweensOf(this.hoverSurface);
      scene.tweens.add({ targets: this.hoverSurface, alpha: 1, duration: 170, ease: "Sine.Out" });
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.hovered = false;
      this.draw();
      scene.tweens.killTweensOf(this.hoverSurface);
      scene.tweens.add({ targets: this.hoverSurface, alpha: 0, duration: 210, ease: "Sine.Out" });
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.enabledState) return;
      scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.96, yoyo: true, duration: 70 });
      this.onPress();
    });
  }

  setContent(content: PhaserBilingualContent): this {
    this.label.setContent(content);
    this.layoutContent();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    if (enabled) this.setInteractive({ useHandCursor: true });
    else this.disableInteractive();
    this.setAlpha(enabled ? 1 : this.theme.disabledAlpha);
    if (!enabled) this.hoverSurface.setAlpha(0);
    this.draw();
    return this;
  }

  setSelected(selected: boolean): this {
    this.selectedState = selected;
    this.draw();
    return this;
  }

  setIcon(options: PhaserButtonIconOptions): this {
    this.icon?.destroy();
    const size = options.size ?? 24;
    const defaultX = -this.widthPx / 2 + Math.max(27, size / 2 + 13);
    this.icon = this.scene.add.image(options.x ?? defaultX, 0, options.texture, options.frame)
      .setDisplaySize(size, size)
      .setTint(options.tint ?? this.theme.iconTint);
    this.add(this.icon);
    this.layoutContent();
    return this;
  }

  setToggleState(enabled: boolean): this {
    this.toggleObjects.forEach((object) => object.destroy());
    const x = this.widthPx / 2 - 58;
    const track = this.scene.add.graphics();
    track.fillStyle(enabled ? 0x66a978 : 0x53645e, 1).fillRoundedRect(x - 30, -16, 60, 32, 16);
    track.lineStyle(1.5, enabled ? 0xa4dab1 : 0x879891, 0.9).strokeRoundedRect(x - 30, -16, 60, 32, 16);
    const thumb = this.scene.add.circle(x + (enabled ? 14 : -14), 0, 11, 0xf3ead7, 1);
    this.add([track, thumb]);
    this.toggleObjects = [track, thumb];
    this.layoutContent(true);
    return this;
  }

  private layoutContent(hasToggle = this.toggleObjects.length > 0): void {
    this.label.setX(hasToggle ? -36 : this.icon ? 12 : 0);
  }

  private draw(): void {
    this.background.clear();
    this.background.fillStyle(this.theme.shadow, 0.28)
      .fillRoundedRect(-this.widthPx / 2 + 2, -this.heightPx / 2 + 4, this.widthPx, this.heightPx, this.theme.radius);
    const fill = this.selectedState
      ? this.theme.selectedBackground
      : this.hovered && this.enabledState ? this.theme.hoverBackground : this.theme.background;
    this.background.fillStyle(fill, 1)
      .fillRoundedRect(-this.widthPx / 2, -this.heightPx / 2, this.widthPx, this.heightPx, this.theme.radius);
    this.background.lineStyle(this.selectedState ? 3 : this.hovered ? 2 : 1.5, this.theme.accent, this.selectedState || this.hovered ? 1 : 0.7)
      .strokeRoundedRect(-this.widthPx / 2, -this.heightPx / 2, this.widthPx, this.heightPx, this.theme.radius);
    this.icon?.setTint(this.hovered ? this.theme.hoverIconTint : this.theme.iconTint);
  }
}
