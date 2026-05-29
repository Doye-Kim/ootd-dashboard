import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const VISION_TEMPERATURE = 0;
export const VISION_MODEL = 'claude-sonnet-4-6';
export const CALIBRATION_MODEL = 'claude-haiku-4-5-20251001';
