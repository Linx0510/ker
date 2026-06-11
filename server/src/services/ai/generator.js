import { buildPrompt } from './prompts.js';
import { sanitizePromptInput } from './sanitizer.js';
import { moderateAiOutput } from './moderator.js';
import { generateWithFallback } from './fallbackChain.js';
import {
  createDraft,
  getDraftById,
  logAiRequest,
  markDraftDone,
  markDraftError,
  markDraftProcessing
} from './drafts.js';
import { logger } from '../../utils/logger.js';

export async function enqueueGeneration({ generationType, input, requestedBy }) {
  return createDraft({
    generationType,
    input: sanitizePromptInput(input || {}),
    requestedBy
  });
}

export async function processDraft(draftId) {
  const draft = await markDraftProcessing(draftId);
  const requestData = draft.input || {};
  const prompt = buildPrompt(draft.generationType, requestData);
  const startedAt = Date.now();

  try {
    const generated = await generateWithFallback({
      prompt,
      generationType: draft.generationType
    });
    const moderatedOutput = moderateAiOutput(generated.output);
    const doneDraft = await markDraftDone(draft.id, {
      output: moderatedOutput,
      modelUsed: generated.model,
      fallbackChain: generated.fallbackChain
    });
    await logAiRequest({
      draftId: draft.id,
      requestedBy: draft.requestedBy,
      model: generated.model,
      status: 'success',
      promptTokens: generated.usage?.prompt_tokens,
      completionTokens: generated.usage?.completion_tokens,
      durationMs: generated.durationMs || (Date.now() - startedAt),
      requestPayload: {
        generationType: draft.generationType,
        input: requestData,
        cacheKey: generated.cacheKey,
        fromCache: generated.fromCache
      },
      responsePayload: moderatedOutput
    });
    logger.info({
      draftId: draft.id,
      generationType: draft.generationType,
      model: generated.model,
      durationMs: generated.durationMs
    }, 'AI generation completed');
    return doneDraft;
  } catch (error) {
    await markDraftError(draft.id, error.message);
    await logAiRequest({
      draftId: draft.id,
      requestedBy: draft.requestedBy,
      model: draft.modelUsed || 'unknown',
      status: 'error',
      errorText: error.message,
      durationMs: Date.now() - startedAt,
      requestPayload: {
        generationType: draft.generationType,
        input: requestData
      },
      responsePayload: { code: error.code || 'AI_GENERATION_FAILED' }
    });
    logger.error({
      draftId: draft.id,
      generationType: draft.generationType,
      error: error.message,
      code: error.code
    }, 'AI generation failed');
    throw error;
  }
}

export async function getDraftStatus(draftId) {
  return getDraftById(draftId);
}
