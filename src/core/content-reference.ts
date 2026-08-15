export type ReferenceDB = {
  db: {
    table: string;
    column: string;
    id: number;
    // Optional segment coordinates narrow a document-level DB row to a
    // LocalizationSegment. Omit them for refs that target the whole row/doc.
    line_idx?: number;
    seg_idx?: number;
  };
};

export type ReferenceableFile = "lingodex" | "cl_learn_cefr" | "OAT" | "WORDS";

export type ReferenceFile = {
  file: ReferenceableFile;
};

export type ContentReference = ReferenceDB | ReferenceFile;
