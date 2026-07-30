export const WIDTH: 1200;
export const HEIGHT: 900;

export interface PteQuestionTypeData {
  checkedOn: string;
  officialLandingPage: string;
  footer: string;
  questionTypes: Array<Record<string, string | string[]>>;
}

export function buildPreview(data: PteQuestionTypeData): string;
export function buildNotes(data: PteQuestionTypeData): string;
