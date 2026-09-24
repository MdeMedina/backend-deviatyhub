import { Logger } from '@nestjs/common';

/**
 * Envía un mensaje al paciente y lo deja registrado en su conversación.
 *
 * whatsapp-service solo guarda el mensaje cuando el envío FALLA, así que un
 * aviso enviado con éxito no aparecía por ninguna parte: ni el equipo lo veía
 * en el hilo, ni el agente sabía que existía. Si el paciente respondía "no
 * puedo ir", el agente no tenía a qué referirlo.
 *
 * Se guarda como ASSISTANT y no como SYSTEM para que forme parte del historial
 * que el agente lee: para el paciente viene de la clínica, igual que el resto.
 */
export async function enviarYRegistrar(
  prisma: any,
  eventBus: any,
  logger: Logger,
  datos: {
    recipient: string;
    content: string;
    conversationId?: string | null;
    clinicId: string;
  },
): Promise<void> {
  await eventBus.publish('message.outbound', {
    recipient: datos.recipient,
    content: datos.content,
    conversationId: datos.conversationId ?? null,
    clinicId: datos.clinicId,
  });

  if (!datos.conversationId) return; // Sin conversación no hay hilo al que anclarlo.

  try {
    await prisma.message.create({
      data: {
        conversationId: datos.conversationId,
        clinicId: datos.clinicId,
        role: 'ASSISTANT',
        content: datos.content,
        sentAt: new Date(),
      },
    });
  } catch (e) {
    // El paciente ya lo recibió: que no quede en el hilo es molesto, no grave.
    logger.warn(`No se pudo registrar el aviso en la conversación: ${(e as Error).message}`);
  }
}
