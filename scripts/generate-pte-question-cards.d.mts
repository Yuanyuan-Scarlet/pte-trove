export const WIDTH: 900;
export const HEIGHT: 1200;

export interface PteQuestionWeighting {
  id: string;
  overall: string;
  listening: string | null;
  reading: string | null;
  speaking: string | null;
  writing: string | null;
}

export interface PteQuestionTypeData {
  checkedOn: string;
  officialLandingPage: string;
  footer: string;
  weightingSource: string;
  weightingTable: PteQuestionWeighting[];
  questionTypes: Array<Record<string, string | string[]>>;
}

export function buildPreview(data: PteQuestionTypeData): string;
export function buildNotes(data: PteQuestionTypeData): string;
