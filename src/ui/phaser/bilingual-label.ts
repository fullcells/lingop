import Phaser from "phaser";

import type { AnnotatedText } from "../../core/annotation/types.js";
import { PhaserAnnotatedText } from "./annotated-text.js";
import { bindPhaserFocusSpeech, type PhaserFocusSpeechHost } from "./focus-speech.js";

export type PhaserBilingualTextPart = {
  lang: string;
  text: string;
  annotatedText?: AnnotatedText;
  fontFamily?: string;
};

export type PhaserBilingualContent = {
  gui: PhaserBilingualTextPart;
  focus: PhaserBilingualTextPart;
  /** Shared value appended after both labels, for example `: EN→JA`. */
  suffix?: string;
  /** Defaults to focus.text. */
  speechText?: string;
};

export type PhaserBilingualLabelOptions = {
  layout?: "horizontal" | "vertical";
  guiFontSize?: number;
  focusFontSize?: number;
  guiColor?: string;
  focusColor?: string;
  spellingColor?: string;
  separatorColor?: string;
  suffixColor?: string;
  gap?: number;
  wrapWidth?: number;
  hitWidth?: number;
  hitHeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  spellingScale?: number;
  rubyGap?: number;
  lineSpacing?: number;
  resolution?: number;
  showGuiAnnotations?: boolean;
  showFocusAnnotations?: boolean;
  speechHost?: PhaserFocusSpeechHost;
  speakOnPress?: boolean;
};

type ResolvedOptions = Required<Omit<
  PhaserBilingualLabelOptions,
  "wrapWidth" | "hitWidth" | "hitHeight" | "speechHost" | "resolution"
>> & {
  wrapWidth: number | undefined;
  hitWidth: number | undefined;
  hitHeight: number | undefined;
  speechHost: PhaserFocusSpeechHost | undefined;
  resolution: number | undefined;
};

/** Renderer-native horizontal or vertical bilingual text for Phaser. */
export class PhaserBilingualLabel extends Phaser.GameObjects.Container {
  private content: PhaserBilingualContent;
  private readonly options: ResolvedOptions;
  private guiObject!: Phaser.GameObjects.Text | PhaserAnnotatedText;
  private focusObject!: Phaser.GameObjects.Text | PhaserAnnotatedText;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: PhaserBilingualContent,
    options: PhaserBilingualLabelOptions = {},
  ) {
    super(scene, x, y);
    this.content = content;
    this.options = {
      layout: options.layout ?? "horizontal",
      guiFontSize: options.guiFontSize ?? 16,
      focusFontSize: options.focusFontSize ?? 16,
      guiColor: options.guiColor ?? "#f3ead7",
      focusColor: options.focusColor ?? "#d9bb76",
      spellingColor: options.spellingColor ?? "#ead8a5",
      separatorColor: options.separatorColor ?? "#9b917c",
      suffixColor: options.suffixColor ?? "#f3ead7",
      gap: options.gap ?? 9,
      wrapWidth: options.wrapWidth,
      hitWidth: options.hitWidth,
      hitHeight: options.hitHeight,
      fontFamily: options.fontFamily ?? "sans-serif",
      fontStyle: options.fontStyle ?? "bold",
      spellingScale: options.spellingScale ?? 0.5,
      rubyGap: options.rubyGap ?? 5,
      lineSpacing: options.lineSpacing ?? 5,
      resolution: options.resolution,
      showGuiAnnotations: options.showGuiAnnotations ?? false,
      showFocusAnnotations: options.showFocusAnnotations ?? true,
      speechHost: options.speechHost,
      speakOnPress: options.speakOnPress ?? true,
    };
    scene.add.existing(this);
    this.rebuild();
    if (this.options.speechHost) {
      bindPhaserFocusSpeech(scene, this, {
        host: this.options.speechHost,
        getSpeechText: () => this.speechText,
        getFocusObjects: () => this.focusVisualObjects(),
        speakOnPress: this.options.speakOnPress,
      });
    }
  }

  get speechText(): string {
    return this.content.speechText ?? this.content.focus.text;
  }

  setContent(content: PhaserBilingualContent): this {
    this.content = content;
    this.rebuild();
    return this;
  }

  focusVisualObjects(): Phaser.GameObjects.GameObject[] {
    return [this.focusObject];
  }

  private makePart(part: PhaserBilingualTextPart, isFocus: boolean): Phaser.GameObjects.Text | PhaserAnnotatedText {
    const size = isFocus ? this.options.focusFontSize : this.options.guiFontSize;
    const color = isFocus ? this.options.focusColor : this.options.guiColor;
    const showAnnotation = isFocus ? this.options.showFocusAnnotations : this.options.showGuiAnnotations;
    if (showAnnotation && part.annotatedText) {
      return new PhaserAnnotatedText(this.scene, 0, 0, part.annotatedText, {
        mainFontSize: size,
        spellingFontSize: Math.max(7, Math.round(size * this.options.spellingScale)),
        mainColor: color,
        spellingColor: this.options.spellingColor,
        fontFamily: part.fontFamily ?? this.options.fontFamily,
        fontStyle: this.options.fontStyle,
        rubyGap: this.options.rubyGap,
        lineSpacing: this.options.lineSpacing,
        ...(this.options.wrapWidth === undefined ? {} : { maxWidth: this.options.wrapWidth }),
        ...(this.options.resolution === undefined ? {} : { resolution: this.options.resolution }),
      });
    }
    return this.scene.add.text(0, 0, part.text, {
      fontFamily: part.fontFamily ?? this.options.fontFamily,
      fontSize: `${size}px`,
      fontStyle: this.options.fontStyle,
      color,
      align: "center",
      ...(this.options.wrapWidth === undefined ? {} : { wordWrap: { width: this.options.wrapWidth } }),
    }).setOrigin(0.5).setResolution(this.options.resolution ?? 2);
  }

  private rebuild(): void {
    this.removeAll(true);
    this.guiObject = this.makePart(this.content.gui, false);
    this.focusObject = this.makePart(this.content.focus, true);
    const separator = this.options.layout === "horizontal" ? this.makeAccessory("/", this.options.separatorColor) : null;
    const suffix = this.options.layout === "horizontal" && this.content.suffix
      ? this.makeAccessory(this.content.suffix, this.options.suffixColor)
      : null;
    const ordered = [this.guiObject, ...(separator ? [separator] : []), this.focusObject, ...(suffix ? [suffix] : [])];

    if (this.options.layout === "horizontal") this.layoutHorizontal(ordered);
    else this.layoutVertical(ordered);
    this.setSize(
      Math.max(this.width, this.options.hitWidth ?? 0),
      Math.max(this.height, this.options.hitHeight ?? 0),
    );
    this.add(ordered);
    if (this.options.speechHost) this.setInteractive({ useHandCursor: true });
  }

  private makeAccessory(text: string, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text, {
      fontFamily: this.options.fontFamily,
      fontSize: `${Math.min(this.options.guiFontSize, this.options.focusFontSize)}px`,
      fontStyle: this.options.fontStyle,
      color,
    }).setOrigin(0.5).setResolution(this.options.resolution ?? 2);
  }

  private layoutHorizontal(objects: Array<Phaser.GameObjects.Text | PhaserAnnotatedText>): void {
    objects.forEach((object) => {
      if (object instanceof PhaserAnnotatedText) object.setY(-object.getMainLineCenterOffset());
    });
    const totalWidth = objects.reduce((sum, object) => sum + object.width, 0)
      + this.options.gap * (objects.length - 1);
    let cursor = -totalWidth / 2;
    objects.forEach((object) => {
      object.setX(cursor + object.width / 2);
      cursor += object.width + this.options.gap;
    });
    this.setSize(totalWidth, Math.max(...objects.map((object) => object.height)));
  }

  private layoutVertical(objects: Array<Phaser.GameObjects.Text | PhaserAnnotatedText>): void {
    const totalHeight = objects.reduce((sum, object) => sum + object.height, 0)
      + this.options.gap * (objects.length - 1);
    let cursor = -totalHeight / 2;
    objects.forEach((object) => {
      object.setY(cursor + object.height / 2);
      cursor += object.height + this.options.gap;
    });
    this.setSize(Math.max(...objects.map((object) => object.width)), totalHeight);
  }
}
