import { z } from 'zod';
import { err } from '../utils/httpError.js';
import { env } from '../config/env.js';

const nonEmptyText = z.string().trim().min(1);

const baseQuestionSchema = z.object({
  order: z.coerce.number().int().min(1).default(1),
  question: nonEmptyText,
  explanation: z.string().trim().max(5000).optional().nullable(),
  points: z.coerce.number().int().min(1).max(100).default(1)
});

const singleQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('single'),
  options: z.array(nonEmptyText).min(2).max(12),
  correctIndex: z.coerce.number().int().min(0)
}).superRefine((value, ctx) => {
  if (value.correctIndex >= value.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'INVALID_ANSWER_INDEX'
    });
  }
});

const multipleQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('multiple'),
  options: z.array(nonEmptyText).min(2).max(12),
  correctIndices: z.array(z.coerce.number().int().min(0)).min(1)
}).superRefine((value, ctx) => {
  const unique = new Set(value.correctIndices);
  if (unique.size !== value.correctIndices.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'INVALID_ANSWER_INDEX'
    });
  }
  for (const index of unique) {
    if (index >= value.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'INVALID_ANSWER_INDEX'
      });
    }
  }
});

const matchingPairSchema = z.object({
  left: nonEmptyText,
  right: nonEmptyText
});

const matchingQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('matching'),
  matchingPairs: z.array(matchingPairSchema).min(2).max(20)
});

export const questionSchema = z.discriminatedUnion('type', [
  singleQuestionSchema,
  multipleQuestionSchema,
  matchingQuestionSchema
]);

const generationTypeSchema = z.enum(['course', 'lesson', 'test', 'question', 'matching']);

const generationInputSchema = z.object({
  subjectArea: z.string().trim().max(env.aiMaxPromptLength).optional(),
  courseId: z.coerce.number().int().positive().optional(),
  lessonId: z.coerce.number().int().positive().optional(),
  testName: z.string().trim().max(200).optional(),
  questionPrompt: z.string().trim().max(env.aiMaxPromptLength).optional(),
  matchingPrompt: z.string().trim().max(env.aiMaxPromptLength).optional(),
  questionsCount: z.coerce.number().int().min(1).max(env.aiMaxGeneratedItems).optional(),
  lessonCount: z.coerce.number().int().min(1).max(env.aiMaxGeneratedItems).optional(),
  includeExplanations: z.coerce.boolean().optional()
});

export const aiGenerateSchema = z.object({
  generationType: generationTypeSchema,
  input: generationInputSchema.default({})
});

export const aiConfirmSchema = z.object({
  output: z.record(z.any()).optional()
});

export function parseOrThrow(schema, value, errorCode = 'REQUEST_ERROR') {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw err(400, first?.message && first.message !== 'Invalid input' ? first.message : errorCode, {}, result.error.issues);
  }
  return result.data;
}
