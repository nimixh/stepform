export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "email"
  | "number"
  | "yes_no"
  | "rating";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  form_id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  position: number;
  settings: {
    options?: ChoiceOption[];
    max_rating?: number;
    [k: string]: unknown;
  };
}

export interface FormDetail {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  theme_bg: string;
  theme_text: string;
  theme_button: string;
  theme_font: string;
  welcome_enabled: boolean;
  welcome_title: string;
  welcome_description: string;
  welcome_button: string;
  thankyou_title: string;
  thankyou_description: string;
  created_at: string | null;
  updated_at: string | null;
  questions: Question[];
  response_count: number;
}

export interface FormSummary {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  response_count: number;
  question_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export const QUESTION_TYPES: { value: QuestionType; label: string; icon: string; hint: string }[] = [
  { value: "short_text", label: "Short text", icon: "T", hint: "A short written answer" },
  { value: "long_text", label: "Long text", icon: "¶", hint: "A longer written answer" },
  { value: "multiple_choice", label: "Multiple choice", icon: "◉", hint: "Pick one from a list" },
  { value: "dropdown", label: "Dropdown", icon: "▾", hint: "Pick from a dropdown" },
  { value: "email", label: "Email", icon: "@", hint: "A valid email address" },
  { value: "number", label: "Number", icon: "#", hint: "A numeric answer" },
  { value: "yes_no", label: "Yes / No", icon: "Y", hint: "A simple yes or no" },
  { value: "rating", label: "Rating", icon: "★", hint: "A score out of N" },
];

export function typeLabel(t: QuestionType): string {
  return QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;
}
