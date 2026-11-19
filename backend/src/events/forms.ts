import { BadRequestException } from '@nestjs/common';

/** Registration form questions, built per event by its publisher. */
export const QUESTION_TYPES = [
  'short',
  'paragraph',
  'choice',
  'checkboxes',
  'dropdown',
  'number',
  'date',
  'link',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Question = {
  id: string;
  type: QuestionType;
  title: string;
  help?: string;
  required: boolean;
  /** Choice types only. */
  options?: string[];
  /** Choice types only: adds an "Other" with a text box. */
  other?: boolean;
  /** Link only: accept Google Drive / Docs links only. */
  driveOnly?: boolean;
};

export type Answers = Record<string, string | string[]>;

export const DEFAULT_FORM: Question[] = [
  { id: 'phone', type: 'short', title: 'Phone', required: true },
  { id: 'faculty', type: 'short', title: 'Faculty', required: true },
  { id: 'year', type: 'short', title: 'Academic year', required: true },
];

export const DRIVE_HINT =
  "Make sure the file is shared as 'Anyone with the link'";

const MAX_QUESTIONS = 30;
const MAX_OPTIONS = 30;
const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const CHOICE_TYPES = new Set<QuestionType>([
  'choice',
  'checkboxes',
  'dropdown',
]);
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const fail = (message: string): never => {
  throw new BadRequestException(message);
};
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const isChoice = (t: QuestionType) => CHOICE_TYPES.has(t);

/** Check and normalise a form sent by the dashboard. */
export function parseForm(input: unknown): Question[] {
  if (!Array.isArray(input)) fail('The form must be a list of questions.');
  const list = input as unknown[];
  if (list.length > MAX_QUESTIONS) {
    fail(`A form can have at most ${MAX_QUESTIONS} questions.`);
  }
  const ids = new Set<string>();
  return list.map((raw, i) => {
    if (!isObject(raw)) return fail(`Question ${i + 1} is not valid.`);
    const title = str(raw.title);
    const label = title ? `"${title}"` : `Question ${i + 1}`;
    if (title.length < 1 || title.length > 200) {
      fail(`${label}: the question needs a title (up to 200 characters).`);
    }
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!ID.test(id) || ids.has(id)) fail(`${label} has an invalid id.`);
    ids.add(id);
    const type = raw.type as QuestionType;
    if (!QUESTION_TYPES.includes(type)) fail(`${label} has an unknown type.`);
    const q: Question = { id, type, title, required: raw.required === true };
    const help = str(raw.help);
    if (help.length > 500)
      fail(`${label}: help text is limited to 500 characters.`);
    if (help) q.help = help;
    if (isChoice(type)) {
      const opts = Array.isArray(raw.options) ? raw.options.map(str) : [];
      if (opts.length < 1 || opts.length > MAX_OPTIONS) {
        fail(`${label} needs between 1 and ${MAX_OPTIONS} options.`);
      }
      if (opts.some((o) => o.length < 1 || o.length > 100)) {
        fail(`${label}: each option must be 1–100 characters.`);
      }
      if (new Set(opts).size !== opts.length) {
        fail(`${label} has the same option twice.`);
      }
      q.options = opts;
      if (raw.other === true) q.other = true;
    }
    if (type === 'link' && raw.driveOnly === true) q.driveOnly = true;
    return q;
  });
}

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Check a student's answers against the event's form; returns cleaned answers. */
export function validateAnswers(form: Question[], input: unknown): Answers {
  if (!isObject(input)) fail('Please fill in the form.');
  const given = input as Record<string, unknown>;
  const byId = new Map(form.map((q) => [q.id, q]));
  for (const key of Object.keys(given)) {
    if (!byId.has(key)) {
      fail('This form was updated — please reload the page and try again.');
    }
  }
  const out: Answers = {};
  for (const q of form) {
    const t = `"${q.title}"`;
    const raw = given[q.id];
    if (q.type === 'checkboxes') {
      if (raw === undefined || raw === null) {
        if (q.required) fail(`${t} is required.`);
        continue;
      }
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
        fail(`${t}: please tick from the list.`);
      }
      const picked = (raw as string[]).map((x) => x.trim());
      if (picked.length === 0) {
        if (q.required) fail(`${t} is required.`);
        continue;
      }
      for (const p of picked) {
        if (q.options!.includes(p)) continue;
        if (!q.other || p.length < 1 || p.length > 200) {
          fail(
            `${t}: please choose from the list${q.other ? ' or fill in "Other"' : ''}.`,
          );
        }
      }
      if (new Set(picked).size !== picked.length)
        fail(`${t}: the same choice is ticked twice.`);
      out[q.id] = picked;
      continue;
    }
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      fail(`${t}: please enter text.`);
    }
    const v = str(raw);
    if (!v) {
      if (q.required) fail(`${t} is required.`);
      continue;
    }
    switch (q.type) {
      case 'short':
        if (v.length > 300) fail(`${t} is limited to 300 characters.`);
        break;
      case 'paragraph':
        if (v.length > 3000) fail(`${t} is limited to 3000 characters.`);
        break;
      case 'choice':
      case 'dropdown':
        if (!q.options!.includes(v) && (!q.other || v.length > 200)) {
          fail(`${t}: please choose from the list.`);
        }
        break;
      case 'number':
        if (!/^-?\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v))) {
          fail(`${t} must be a number.`);
        }
        break;
      case 'date':
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          Number.isNaN(Date.parse(`${v}T00:00:00Z`))
        ) {
          fail(`${t} must be a date.`);
        }
        break;
      case 'link': {
        const u = v.length <= 500 ? isHttpUrl(v) : null;
        if (!u) fail(`${t} must be a link starting with https://`);
        if (q.driveOnly && !DRIVE_HOSTS.has(u!.hostname.toLowerCase())) {
          fail(`${t} must be a Google Drive link. ${DRIVE_HINT}.`);
        }
        break;
      }
    }
    out[q.id] = v;
  }
  return out;
}
