import {
  DEFAULT_FORM,
  parseForm,
  validateAnswers,
  type Question,
} from './forms';

const q = (
  over: Partial<Question> & Pick<Question, 'id' | 'type'>,
): Question => ({
  title: over.id,
  required: false,
  ...over,
});

describe('DEFAULT_FORM', () => {
  it('asks phone, faculty and year, all required short answers', () => {
    expect(DEFAULT_FORM.map((x) => x.id)).toEqual(['phone', 'faculty', 'year']);
    expect(DEFAULT_FORM.map((x) => x.title)).toEqual([
      'Phone',
      'Faculty',
      'Academic year',
    ]);
    expect(DEFAULT_FORM.every((x) => x.required && x.type === 'short')).toBe(
      true,
    );
  });
});

describe('parseForm', () => {
  it('rejects more than 30 questions', () => {
    const many = Array.from({ length: 31 }, (_, i) =>
      q({ id: `q${i}`, type: 'short' }),
    );
    expect(() => parseForm(many)).toThrow(/30 questions/);
  });
  it('rejects duplicate ids', () => {
    expect(() =>
      parseForm([q({ id: 'a', type: 'short' }), q({ id: 'a', type: 'date' })]),
    ).toThrow();
  });
  it('rejects a choice question without options', () => {
    expect(() =>
      parseForm([q({ id: 'a', type: 'choice', title: 'Track', options: [] })]),
    ).toThrow(/Track/);
  });
  it('rejects duplicate options', () => {
    expect(() =>
      parseForm([q({ id: 'a', type: 'dropdown', options: ['AI', 'AI'] })]),
    ).toThrow();
  });
  it('rejects an empty title', () => {
    expect(() =>
      parseForm([q({ id: 'a', type: 'short', title: '  ' })]),
    ).toThrow();
  });
  it('rejects an unknown type', () => {
    expect(() =>
      parseForm([{ id: 'a', type: 'file', title: 'CV', required: true }]),
    ).toThrow();
  });
  it('rejects bad ids and non-arrays', () => {
    expect(() => parseForm([q({ id: 'a b', type: 'short' })])).toThrow();
    expect(() => parseForm('nope')).toThrow();
  });
  it('keeps only the settings that fit the type', () => {
    const [x, y] = parseForm([
      {
        id: 'a',
        type: 'short',
        title: ' Name ',
        required: true,
        driveOnly: true,
        options: ['x'],
      },
      {
        id: 'b',
        type: 'link',
        title: 'CV',
        required: false,
        driveOnly: true,
        other: true,
      },
    ]);
    expect(x).toEqual({
      id: 'a',
      type: 'short',
      title: 'Name',
      required: true,
    });
    expect(y).toEqual({
      id: 'b',
      type: 'link',
      title: 'CV',
      required: false,
      driveOnly: true,
    });
  });
});

describe('validateAnswers', () => {
  const form: Question[] = [
    ...DEFAULT_FORM,
    q({ id: 'note', type: 'short', title: 'Note' }),
    q({ id: 'bio', type: 'paragraph', title: 'Bio' }),
    q({
      id: 'track',
      type: 'choice',
      title: 'Which track?',
      options: ['AI', 'Web'],
    }),
    q({
      id: 'track2',
      type: 'dropdown',
      title: 'Track 2',
      options: ['AI'],
      other: true,
    }),
    q({
      id: 'langs',
      type: 'checkboxes',
      title: 'Languages',
      options: ['JS', 'Py'],
      other: true,
      required: true,
    }),
    q({ id: 'age', type: 'number', title: 'Age' }),
    q({ id: 'day', type: 'date', title: 'Day' }),
    q({ id: 'site', type: 'link', title: 'Site' }),
    q({ id: 'cv', type: 'link', title: 'CV', driveOnly: true }),
  ];
  const base = { phone: '+20 1', faculty: 'CS', year: '3', langs: ['JS'] };
  const ok = (extra: Record<string, unknown>) =>
    validateAnswers(form, { ...base, ...extra });
  const bad = (extra: Record<string, unknown>) => () =>
    validateAnswers(form, { ...base, ...extra });

  it('requires required questions, naming them', () => {
    expect(() =>
      validateAnswers(form, { faculty: 'CS', year: '3', langs: ['JS'] }),
    ).toThrow(/"Phone" is required/);
  });
  it('omits blank optional answers and trims', () => {
    const a = ok({ note: '  ', faculty: ' CS ' });
    expect(a).not.toHaveProperty('note');
    expect(a.faculty).toBe('CS');
  });
  it('checks choices against the options, unless "Other" is allowed', () => {
    expect(bad({ track: 'Cloud' })).toThrow(/Which track\?/);
    expect(ok({ track: 'AI' }).track).toBe('AI');
    expect(ok({ track2: 'Robotics' }).track2).toBe('Robotics');
  });
  it('validates checkboxes', () => {
    expect(bad({ langs: [] })).toThrow(/"Languages" is required/);
    expect(bad({ langs: ['JS', ''] })).toThrow(/Languages/);
    expect(bad({ langs: 'JS' })).toThrow(/Languages/);
    expect(ok({ langs: ['Py', 'Rust'] }).langs).toEqual(['Py', 'Rust']);
  });
  it('validates numbers', () => {
    expect(ok({ age: '12.5' }).age).toBe('12.5');
    expect(bad({ age: 'abc' })).toThrow(/Age/);
    expect(bad({ age: 'Infinity' })).toThrow(/Age/);
  });
  it('validates dates', () => {
    expect(ok({ day: '2026-11-20' }).day).toBe('2026-11-20');
    expect(bad({ day: '20/11/2026' })).toThrow(/Day/);
  });
  it('validates links and Google Drive links', () => {
    expect(bad({ site: 'ftp://x' })).toThrow(/Site/);
    expect(ok({ site: 'https://github.com/me' }).site).toBe(
      'https://github.com/me',
    );
    expect(ok({ cv: 'https://drive.google.com/file/d/1' }).cv).toBeTruthy();
    expect(ok({ cv: 'https://docs.google.com/document/d/1' }).cv).toBeTruthy();
    expect(bad({ cv: 'https://drive.google.com.evil.com/x' })).toThrow(
      /Google Drive/,
    );
    expect(bad({ cv: 'https://example.com' })).toThrow(/Google Drive/);
  });
  it('asks to reload when an answer is for a question that no longer exists', () => {
    expect(bad({ ghost: 'x' })).toThrow(/reload the page/);
  });
  it('limits lengths', () => {
    expect(bad({ note: 'x'.repeat(301) })).toThrow(/Note/);
    expect(bad({ bio: 'x'.repeat(3001) })).toThrow(/Bio/);
    expect(ok({ bio: 'x'.repeat(3000) }).bio).toHaveLength(3000);
  });
  it('rejects non-object answers', () => {
    expect(() => validateAnswers(form, 'x')).toThrow();
  });
});
