import { DEFAULT_FORM, type SetupForm } from '@/sports/tennis';

/** The setup travels to the match screen as a route parameter. */
export const encodeForm = (form: SetupForm) => JSON.stringify(form);

export function decodeForm(raw: string | undefined): SetupForm {
  if (raw == null) return DEFAULT_FORM;
  try {
    return { ...DEFAULT_FORM, ...(JSON.parse(raw) as Partial<SetupForm>) };
  } catch {
    return DEFAULT_FORM;
  }
}
