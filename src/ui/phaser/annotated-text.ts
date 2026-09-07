import Phaser from "phaser";

import type { AnnotatedText, AnnotatedToken } from "../../core/annotation/types.js";

export type PhaserAnnotatedTextStyle = {
  mainFontSize: number;
  spellingFontSize: number;
  mainColor: string;
  spellingColor: string;
  fontFamily: string;
  fontStyle: string;
  partGap: number;
  tokenGap: number;
  rubyGap: number;
  maxWidth?: number;
  lineSpacing: number;
  resolution: number;
};

type RubyPart = {
  main: string;
  spelling: string | null;
  tokenEnd: boolean;
};

function defaultResolution(): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.max(2, Math.min(ratio, 2));
}

export function defaultPhaserAnnotatedTextStyle(): PhaserAnnotatedTextStyle {
  return {
    mainFontSize: 20,
    spellingFontSize: 11,
    mainColor: "#f3ead7",
    spellingColor: "#d4b86f",
    fontFamily: "sans-serif",
    fontStyle: "bold",
    partGap: 0,
    tokenGap: 2,
    rubyGap: 5,
    lineSpacing: 5,
    resolution: defaultResolution(),
  };
}

function tokenParts(token: AnnotatedToken): RubyPart[] {
  const phonetic = token.phoneticToken;
  if (!phonetic?.length) {
    return [{ main: token.text, spelling: null, tokenEnd: true }];
  }

  return phonetic.map(([main, reading], index) => ({
    main: main.replaceAll("‿", ""),
    spelling: reading && reading !== main && reading !== "ー" ? reading : null,
    tokenEnd: index === phonetic.length - 1,
  }));
}

/**
 * Renderer-native annotated text built from Phaser Text objects. It supports
 * furigana, Jyutping, token-aware wrapping, high-DPI text, and normal Phaser
 * container transforms without requiring a DOM overlay.
 */
export class PhaserAnnotatedText extends Phaser.GameObjects.Container {
  private annotatedText: AnnotatedText;
  private styleConfig: PhaserAnnotatedTextStyle;
  private mainLineCenterOffset = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    annotatedText: AnnotatedText,
    style: Partial<PhaserAnnotatedTextStyle> = {},
  ) {
    super(scene, x, y);
    this.annotatedText = annotatedText;
    this.styleConfig = { ...defaultPhaserAnnotatedTextStyle(), ...style };
    scene.add.existing(this);
    this.rebuild();

    if (typeof document !== "undefined") {
      void document.fonts?.ready.then(() => {
        if (this.active) this.rebuild();
      });
    }
  }

  setAnnotatedText(annotatedText: AnnotatedText): this {
    this.annotatedText = annotatedText;
    this.rebuild();
    return this;
  }

  setTextStyle(style: Partial<PhaserAnnotatedTextStyle>): this {
    this.styleConfig = { ...this.styleConfig, ...style };
    this.rebuild();
    return this;
  }

  /** Offset from the container center to the first main-text line's center. */
  getMainLineCenterOffset(): number {
    return this.mainLineCenterOffset;
  }

  private rebuild(): void {
    this.removeAll(true);
    const style = this.styleConfig;
    const columns = this.annotatedText.tokens.flatMap(tokenParts).map((part) => {
      const main = this.scene.add.text(0, 0, part.main, {
        fontFamily: style.fontFamily,
        fontSize: `${style.mainFontSize}px`,
        fontStyle: style.fontStyle,
        color: style.mainColor,
        padding: { x: 0, y: 0 },
      }).setOrigin(0.5).setResolution(style.resolution);
      const spelling = part.spelling
        ? this.scene.add.text(0, 0, part.spelling, {
          fontFamily: style.fontFamily,
          fontSize: `${style.spellingFontSize}px`,
          fontStyle: style.fontStyle,
          color: style.spellingColor,
          padding: { x: 0, y: 0 },
        }).setOrigin(0.5).setResolution(style.resolution)
        : null;
      return { ...part, main, spelling, width: Math.max(main.width, spelling?.width ?? 0) };
    });

    const columnGap = (column: (typeof columns)[number]): number =>
      column.tokenEnd ? style.tokenGap : style.partGap;
    const groups: Array<typeof columns> = [];
    let group: typeof columns = [];
    for (const column of columns) {
      group.push(column);
      if (column.tokenEnd) {
        groups.push(group);
        group = [];
      }
    }
    if (group.length) groups.push(group);

    const widthOf = (items: typeof columns): number => items.reduce(
      (sum, column, index) => sum + column.width + (index === items.length - 1 ? 0 : columnGap(column)),
      0,
    );
    const lines: Array<typeof columns> = [];
    let line: typeof columns = [];
    let lineWidth = 0;
    for (const tokenGroup of groups) {
      const width = widthOf(tokenGroup);
      const nextWidth = line.length ? lineWidth + style.tokenGap + width : width;
      if (line.length && style.maxWidth !== undefined && nextWidth > style.maxWidth) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      line.push(...tokenGroup);
      lineWidth = lineWidth ? lineWidth + style.tokenGap + width : width;
    }
    if (line.length) lines.push(line);

    const lineWidths = lines.map(widthOf);
    const lineHeight = style.mainFontSize + style.spellingFontSize + style.rubyGap;
    const totalHeight = lines.length * lineHeight + Math.max(0, lines.length - 1) * style.lineSpacing;
    const mainY = (style.spellingFontSize + style.rubyGap) / 2;
    const spellingY = -style.mainFontSize / 2;
    this.mainLineCenterOffset = -totalHeight / 2 + lineHeight / 2 + mainY;

    lines.forEach((items, lineIndex) => {
      const centerY = -totalHeight / 2 + lineHeight / 2 + lineIndex * (lineHeight + style.lineSpacing);
      let cursor = -(lineWidths[lineIndex] ?? 0) / 2;
      items.forEach((column, index) => {
        const x = cursor + column.width / 2;
        column.main.setPosition(x, centerY + mainY);
        this.add(column.main);
        if (column.spelling) {
          column.spelling.setPosition(x, centerY + spellingY);
          this.add(column.spelling);
        }
        cursor += column.width + (index === items.length - 1 ? 0 : columnGap(column));
      });
    });
    this.setSize(Math.max(...lineWidths, 0), totalHeight);
  }
}
