import { z } from "zod";
import raw from "@/lib/demo/personas.public.json";

const localized = z.object({ en: z.string(), id: z.string() });

const personaSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  name: z.string(),
  account_id: z.string(),
  role: localized,
  blurb: localized,
  secret_key: z.string().nullable(),
});

export type Persona = z.infer<typeof personaSchema>;

export const personas: Persona[] = z.array(personaSchema).parse(raw.personas);

export function findPersona(id: string | null | undefined): Persona | null {
  return personas.find((p) => p.id === id) ?? null;
}
