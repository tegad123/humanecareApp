import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ScanResult {
  docType: string | null;
  expirationDate: string | null;
  clinicianName: string | null;
  confidence: number;
  rawResponse: any;
}

@Injectable()
export class AiScannerService {
  private readonly logger = new Logger(AiScannerService.name);
  private client: Anthropic;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    this.client = new Anthropic({ apiKey });
  }

  async analyzeDocument(params: {
    fileBase64: string;
    mimeType: string;
    fileName: string;
    knownDocTypes: string[];
    knownClinicianNames: string[];
  }): Promise<ScanResult> {
    const mediaType = this.toMediaType(params.mimeType);
    if (!mediaType) {
      return {
        docType: null,
        expirationDate: null,
        clinicianName: null,
        confidence: 0,
        rawResponse: { error: `Unsupported media type: ${params.mimeType}` },
      };
    }

    const docTypesHint =
      params.knownDocTypes.length > 0
        ? `Match to one of these document types: ${params.knownDocTypes.join(', ')}`
        : 'Classify the document type (e.g., license, certification, insurance, background check)';

    const clinicianHint =
      params.knownClinicianNames.length > 0
        ? `Match the person's name to one of: ${params.knownClinicianNames.join(', ')}`
        : 'Extract the person/clinician name if visible';

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: params.fileBase64,
                },
              },
              {
                type: 'text',
                text: `Analyze this healthcare/compliance document. Extract the following:

1. Document type — ${docTypesHint}
2. Expiration date — if any, in ISO 8601 format (YYYY-MM-DD). Look for "Expiration Date", "Valid Until", "Expires", "Exp Date", etc.
3. Clinician/person name — ${clinicianHint}
4. Confidence score — your overall confidence in the extraction (0.0 to 1.0)

Return ONLY valid JSON with no extra text:
{"docType": "..." or null, "expirationDate": "YYYY-MM-DD" or null, "clinicianName": "..." or null, "confidence": 0.XX}`,
              },
            ],
          },
        ],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const parsed = this.parseJsonResponse(text);
      return {
        docType: parsed.docType || null,
        expirationDate: parsed.expirationDate || null,
        clinicianName: parsed.clinicianName || null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        rawResponse: parsed,
      };
    } catch (err: any) {
      this.logger.error(`AI scan failed for ${params.fileName}: ${err.message}`);
      return {
        docType: null,
        expirationDate: null,
        clinicianName: null,
        confidence: 0,
        rawResponse: { error: err.message },
      };
    }
  }

  private toMediaType(
    mimeType: string,
  ): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
    const map: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
    };
    return map[mimeType] || null;
  }

  private parseJsonResponse(text: string): any {
    try {
      // Try direct parse first
      return JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch {
          // fall through
        }
      }
      // Try finding JSON object in text
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          // fall through
        }
      }
      return { error: 'Failed to parse AI response', raw: text };
    }
  }
}
