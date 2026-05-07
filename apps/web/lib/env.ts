import { z } from "zod";

const Schema = z.object({
  NEXT_PUBLIC_API_BASE: z.string().default("/api"),
});

export const env = Schema.parse({
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
});
