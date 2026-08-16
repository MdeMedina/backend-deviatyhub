import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ConfigService } from '@nestjs/config';

export enum Intent {
  AGENDAR_CITA = 'agendar_cita',
  REAGENDAR_CITA = 'reagendar_cita',
  CANCELAR_CITA = 'cancelar_cita',
  CONSULTA_PRECIO = 'consulta_precio',
  CONSULTA_HORARIO = 'consulta_horario',
  CONSULTA_TRATAMIENTO = 'consulta_tratamiento',
  CONSULTA_CLINICA = 'consulta_clinica',
  SALUDO = 'saludo',
  URGENCIA = 'urgencia',
  CONFIRMACION = 'confirmacion',
  NEGACION = 'negacion',
  OTROS = 'otros',
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class IntentionClassifier {
  private readonly logger = new Logger(IntentionClassifier.name);
  private model: ChatOpenAI;
  private parser: JsonOutputParser<IntentResult>;

  constructor(private readonly configService: ConfigService) {
    this.model = new ChatOpenAI({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });
    this.parser = new JsonOutputParser<IntentResult>();
  }

  async classify(text: string): Promise<IntentResult> {
    const prompt = PromptTemplate.fromTemplate(`
      Eres un experto clasificador de intenciones para una clínica dental. 
      Tu objetivo es analizar el mensaje del paciente y clasificarlo en UNA de las siguientes intenciones:
      
      - agendar_cita: El paciente quiere una cita nueva o pregunta por disponibilidad.
      - reagendar_cita: El paciente quiere cambiar la fecha o hora de una cita existente.
      - cancelar_cita: El paciente quiere anular su cita.
      - consulta_precio: Pregunta cuánto cuesta un tratamiento o procedimiento.
      - consulta_horario: Pregunta a qué hora abren o cierran.
      - consulta_tratamiento: Pregunta qué es o cómo funciona un tratamiento (ej: ¿qué es un implante?).
      - consulta_clinica: Pregunta dónde están ubicados, teléfono o información general de la clínica.
      - saludo: Solo saluda o inicia conversación.
      - urgencia: Dolor agudo, sangrado, se cayó un diente, etc.
      - confirmacion: El paciente dice sí, confirma, acepta una propuesta o quiere proceder.
      - negacion: El paciente dice no, declina, rechaza una propuesta o no quiere continuar.
      - otros: No encaja en ninguna anterior.
      
      INSTRUCCIONES DE FORMATO JSON OBLIGATORIO:
      Debes responder ÚNICAMENTE con un objeto JSON estructurado con las siguientes llaves:
      {{
        "intent": "uno de los valores de intención anteriores (ej: agendar_cita, saludo, etc.)",
        "confidence": un número decimal entre 0 y 1 que indica tu confianza,
        "reasoning": "explicación breve de por qué elegiste esta intención"
      }}
      
      MENSAJE DEL PACIENTE: "{text}"
      
      RESPUESTA JSON:
    `);

    const chain = prompt.pipe(this.model as any).pipe(this.parser as any);

    try {
      const result = await chain.invoke({ text }) as IntentResult;
      this.logger.log(`Intención detectada: ${result.intent} (${Math.round(result.confidence * 100)}%)`);
      return result;
    } catch (error) {
      this.logger.error(`Error calificando intención: ${(error as Error).message}`);
      return { intent: Intent.OTROS, confidence: 0, reasoning: 'Error en clasificación' };
    }
  }
}
