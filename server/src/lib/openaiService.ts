import OpenAI from 'openai';
import type { TranscribedSegment, ProcessResult } from '../types';

export interface TranscriptRequest {
  fileBuffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface AIServiceOptions {
  openaiApiKey: string | undefined;
}

type WhisperSegment = {
  start?: number;
  end?: number;
  text?: string;
};

export class AIService {
  private openai: OpenAI | null;

  constructor(options: AIServiceOptions) {
    this.openai = options.openaiApiKey
      ? new OpenAI({ apiKey: options.openaiApiKey })
      : null;
  }

  /**
   * Transkrypcja audio Whisper-1 ze znacznikami czasu.
   */
  async transcribeAudio(request: TranscriptRequest): Promise<TranscribedSegment[]> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY nie jest skonfigurowany na backendzie');
    }

    const file = new File([request.fileBuffer], request.filename, {
      type: request.mimeType,
    });

    const response = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const rawSegments = (response.segments ?? []) as WhisperSegment[];
    return rawSegments
      .filter((segment) => segment.text !== undefined && segment.text.trim().length > 0)
      .map((segment) => ({
        start: Math.round((segment.start ?? 0) * 1000),
        end: Math.round((segment.end ?? 0) * 1000),
        text: (segment.text ?? '').trim(),
      }));
  }

  /**
   * Podsumowanie notatki na podstawie transkrypcji (LLM).
   */
  async summarize(transcript: TranscribedSegment[], title: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY nie jest skonfigurowany na backendzie');
    }

    const text = transcript.map((segment) => segment.text).join(' ').trim();
    if (!text) {
      return 'Brak zarejestrowanej mowy w nagraniu do podsumowania.';
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Jesteś profesjonalnym asystentem rzeczoznawcy samochodowego. ' +
            'Tworzysz zwięzłe, rzeczowe podsumowanie stanu pojazdu i ustaleń z notatki terenowej. ' +
            'Odpowiadaj czystym językiem polskim.',
        },
        {
          role: 'user',
          content: `Tytuł notatki: ${title}\n\nTranskrypcja nagrania:\n${text}`,
        },
      ],
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  async process(request: TranscriptRequest, title: string): Promise<ProcessResult> {
    const transcript = await this.transcribeAudio(request);
    const summary = await this.summarize(transcript, title);
    return { transcript, summary };
  }
}
