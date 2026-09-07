import Phaser from "phaser";

import { PhaserBilingualLabel, type PhaserBilingualContent } from "./bilingual-label.js";
import type { PhaserSpeechHintAdapter } from "./speech-controller.js";

export type PhaserSpeechHintOptions = {
  content: PhaserBilingualContent;
  onSpeak: () => void;
  spellingForText?: (text: string) => string;
  x?: number;
  y?: number;
  key?: string;
  loaderTexture?: string;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: number;
  accent?: number;
  maxTextWidth?: number;
  resolution?: number;
};

/** Animated top-right speech shortcut and in-progress pronunciation display. */
export class PhaserSpeechHint extends Phaser.GameObjects.Container implements PhaserSpeechHintAdapter {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly indicator: Phaser.GameObjects.Graphics;
  private readonly keyText: Phaser.GameObjects.Text;
  private readonly speakingLabel: Phaser.GameObjects.Text;
  private readonly idleLabel: PhaserBilingualLabel;
  private readonly loader: Phaser.GameObjects.Image | null;
  private readonly spellingForText: (text: string) => string;
  private readonly restingX: number;
  private readonly accent: number;
  private readonly backgroundColor: number;
  private hoveredText: string | null = null;
  private speaking = false;

  constructor(scene: Phaser.Scene, options: PhaserSpeechHintOptions) {
    const x = options.x ?? scene.scale.gameSize.width - 38;
    const y = options.y ?? 36;
    super(scene, x, y);
    this.restingX = x;
    this.accent = options.accent ?? 0xc8a45b;
    this.backgroundColor = options.backgroundColor ?? 0x0b1e19;
    this.spellingForText = options.spellingForText ?? ((text) => text);
    const resolution = options.resolution ?? 2;
    const fontFamily = options.fontFamily ?? "sans-serif";
    this.background = scene.add.graphics();
    this.indicator = scene.add.graphics();
    this.keyText = scene.add.text(0, 0, options.key ?? "S", {
      fontFamily,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#f3ead7",
    }).setOrigin(0.5).setResolution(resolution);
    this.speakingLabel = scene.add.text(0, 0, "", {
      fontFamily,
      fontSize: "15px",
      fontStyle: "bold",
      color: options.textColor ?? "#f3ead7",
      align: "right",
      wordWrap: { width: options.maxTextWidth ?? 360 },
      lineSpacing: 3,
    }).setOrigin(1, 0.5).setResolution(resolution);
    this.idleLabel = new PhaserBilingualLabel(scene, 0, 0, options.content, {
      layout: "horizontal",
      guiFontSize: 15,
      focusFontSize: 15,
      resolution,
      showFocusAnnotations: true,
    });
    this.loader = options.loaderTexture
      ? scene.add.image(0, 0, options.loaderTexture).setDisplaySize(28, 28).setTint(this.accent).setVisible(false)
      : null;
    this.add([
      this.background,
      this.indicator,
      ...(this.loader ? [this.loader] : []),
      this.keyText,
      this.speakingLabel,
      this.idleLabel,
    ]);
    this.setDepth(200).setVisible(false).setAlpha(0);
    scene.add.existing(this);
    this.setInteractive(new Phaser.Geom.Rectangle(-440, -34, 440, 68), Phaser.Geom.Rectangle.Contains)
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, options.onSpeak);
    if (this.input) this.input.cursor = "pointer";
    this.renderIdle();
  }

  setContent(content: PhaserBilingualContent): this {
    this.idleLabel.setContent(content);
    if (!this.speaking) this.renderIdle();
    return this;
  }

  setHoveredText(text: string | null): void {
    if (!this.active) return;
    this.hoveredText = text;
    if (this.speaking) return;
    this.renderIdle();
    if (text) this.showAnimated();
    else this.hideAnimated();
  }

  beginSpeaking(text: string): void {
    if (!this.active) return;
    this.speaking = true;
    this.idleLabel.setVisible(false);
    this.speakingLabel.setVisible(true).setText(this.spellingForText(text));
    this.layout(true);
    this.showAnimated();
    if (this.loader) {
      this.scene.tweens.killTweensOf(this.loader);
      this.scene.tweens.add({ targets: this.loader, angle: 360, duration: 850, repeat: -1, ease: "Linear" });
    }
  }

  endSpeaking(): void {
    if (!this.active) return;
    this.speaking = false;
    if (this.loader) {
      this.scene.tweens.killTweensOf(this.loader);
      this.loader.setAngle(0);
    }
    this.renderIdle();
    if (this.hoveredText) this.showAnimated();
    else this.hideAnimated();
  }

  private renderIdle(): void {
    this.speakingLabel.setVisible(false);
    this.idleLabel.setVisible(true).setX(-this.idleLabel.width / 2);
    this.layout(false);
  }

  private layout(active: boolean): void {
    const indicatorWidth = 38;
    const labelWidth = active ? this.speakingLabel.width : this.idleLabel.width;
    const indicatorLeft = -labelWidth - indicatorWidth - 12;
    const centerX = indicatorLeft + indicatorWidth / 2;
    this.background.clear();
    this.indicator.clear();
    if (active) {
      const panelLeft = indicatorLeft - 10;
      const panelHeight = Math.max(44, this.speakingLabel.height + 18);
      this.background.fillStyle(this.backgroundColor, 0.96).fillRoundedRect(panelLeft, -panelHeight / 2, -panelLeft + 8, panelHeight, 10);
      this.background.lineStyle(1, this.accent, 0.62).strokeRoundedRect(panelLeft, -panelHeight / 2, -panelLeft + 8, panelHeight, 10);
      this.loader?.setPosition(centerX, 0).setVisible(true);
      this.keyText.setVisible(this.loader === null).setPosition(centerX, 0);
    } else {
      this.indicator.fillStyle(this.backgroundColor, 0.98).fillRoundedRect(indicatorLeft, -18, indicatorWidth, 36, 7);
      this.indicator.lineStyle(1.5, this.accent, 0.95).strokeRoundedRect(indicatorLeft, -18, indicatorWidth, 36, 7);
      this.loader?.setVisible(false);
      this.keyText.setVisible(true).setPosition(centerX, 0);
    }
  }

  private showAnimated(): void {
    this.scene.tweens.killTweensOf(this);
    if (!this.visible || this.alpha === 0) this.setPosition(this.restingX + 18, this.y).setAlpha(0);
    this.setVisible(true);
    this.scene.tweens.add({ targets: this, x: this.restingX, alpha: 1, duration: 190, ease: "Cubic.Out" });
  }

  private hideAnimated(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      x: this.restingX + 12,
      alpha: 0,
      duration: 150,
      ease: "Cubic.In",
      onComplete: () => {
        if (!this.hoveredText && !this.speaking) this.setVisible(false);
      },
    });
  }
}
