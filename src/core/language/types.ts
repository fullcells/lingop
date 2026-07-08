export interface Lang {
  gcode_main: string;
  gcode_options: string;
  name_natural: string;
  name_english: string;
  g_script: string;
  display_code: string;

  // Legacy presence fields to be cleaned in future.
  mttslocale_options: string;
  mttslocale_main: string;
  oai_erate_min: number | null;
  oai_train_audiohrs_total: string;
}

export interface LangScript {
  g_script: string;
  font_label: string;
  is_ltr: boolean;
  font_family: string;
  font_ttf: string;
  is_word_spaced: boolean;
  writing_system: "ABJAD" | "ABUGIDA" | "ALPHABETIC" | "LOGOGRAPHIC";
}

export interface OpenAIVoice {
  voice: string;
  generation: number;
  gender: string;
}

export type LangNameTranslations = Record<string, string>;
export type LangNamesByCode = Record<string, LangNameTranslations>;
