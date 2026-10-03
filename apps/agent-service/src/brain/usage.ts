import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

/**
 * Precio por millón de tokens, en USD, según la lista pública de OpenAI.
 * Los tokens de razonamiento de gpt-5 se cobran como salida y ya vienen
 * incluidos en completion_tokens, así que no hace falta tratarlos aparte.
 * La versión de @langchain/openai que usamos no informa los tokens servidos
 * desde caché: se cobran todos a precio de entrada, y el costo sale
 * ligeramente por encima del real.
 */
export const PRECIOS_USD_POR_MILLON: Record<string, { entrada: number; salida: number }> = {
  'gpt-5': { entrada: 1.25, salida: 10 },
  'gpt-5-mini': { entrada: 0.25, salida: 2 },
  'gpt-5-nano': { entrada: 0.05, salida: 0.4 },
  'gpt-4o': { entrada: 2.5, salida: 10 },
  'gpt-4o-mini': { entrada: 0.15, salida: 0.6 },
  'gpt-4.1': { entrada: 2, salida: 8 },
  'gpt-4.1-mini': { entrada: 0.4, salida: 1.6 },
  'gpt-4.1-nano': { entrada: 0.1, salida: 0.4 },
};

/** Precio del modelo; con sufijos de versión ("gpt-5-mini-2025-08-07") se usa el de la familia. */
export function precioDe(modelo: string): { entrada: number; salida: number } | null {
  const m = String(modelo || '').toLowerCase();
  const clave = Object.keys(PRECIOS_USD_POR_MILLON)
    .sort((a, b) => b.length - a.length)
    .find((k) => m === k || m.startsWith(`${k}-`));
  return clave ? PRECIOS_USD_POR_MILLON[clave] : null;
}

export function costoUsd(modelo: string, entrada: number, salida: number): number {
  const p = precioDe(modelo);
  if (!p) return 0;
  return (entrada * p.entrada + salida * p.salida) / 1_000_000;
}

/**
 * Suma los tokens de todas las llamadas al modelo de un turno (el agente puede
 * llamar varias veces si usa herramientas) y el tiempo que pasa dentro.
 */
export class MedidorDeUso extends BaseCallbackHandler {
  name = 'medidor-de-uso';
  entrada = 0;
  salida = 0;
  llamadas = 0;
  ms = 0;
  private inicios = new Map<string, number>();

  constructor(readonly modelo: string) {
    super();
  }

  async handleLLMStart(_llm: unknown, _prompts: string[], runId: string) {
    this.inicios.set(runId, Date.now());
  }

  async handleChatModelStart(_llm: unknown, _messages: unknown, runId: string) {
    this.inicios.set(runId, Date.now());
  }

  async handleLLMEnd(output: any, runId: string) {
    const inicio = this.inicios.get(runId);
    if (inicio) this.ms += Date.now() - inicio;
    this.inicios.delete(runId);
    this.llamadas += 1;

    const uso = output?.llmOutput?.tokenUsage;
    if (uso) {
      this.entrada += uso.promptTokens ?? 0;
      this.salida += uso.completionTokens ?? 0;
      return;
    }
    // Formato más nuevo: el uso viene en el mensaje generado.
    const meta = output?.generations?.[0]?.[0]?.message?.usage_metadata;
    if (meta) {
      this.entrada += meta.input_tokens ?? 0;
      this.salida += meta.output_tokens ?? 0;
    }
  }

  get costo(): number {
    return costoUsd(this.modelo, this.entrada, this.salida);
  }
}

/** Uso de un turno completo, el que viaja de vuelta al worker para guardarlo. */
export interface UsoDelTurno {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  llmMs: number;
  parseError: boolean;
}

export function sumarUso(modeloPrincipal: string, medidores: MedidorDeUso[], parseError: boolean): UsoDelTurno {
  return {
    model: modeloPrincipal,
    promptTokens: medidores.reduce((s, m) => s + m.entrada, 0),
    completionTokens: medidores.reduce((s, m) => s + m.salida, 0),
    costUsd: medidores.reduce((s, m) => s + m.costo, 0),
    llmMs: medidores.reduce((s, m) => s + m.ms, 0),
    parseError,
  };
}
