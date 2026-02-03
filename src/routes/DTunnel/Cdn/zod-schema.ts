import { z } from 'zod';

export const cdnSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().min(1).max(100),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
