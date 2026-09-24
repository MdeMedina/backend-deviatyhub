import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';

/**
 * Cálculo de horas libres. Vive aquí porque había DOS implementaciones
 * distintas: la del agente y la de la agenda del panel. Divergían —la del panel
 * ni siquiera miraba qué profesional atiende cada tratamiento— así que lo que
 * veía la clínica en pantalla y lo que el agente le ofrecía a un paciente no
 * tenían por qué coincidir.
 *
 * Recibe el cliente de Prisma como parámetro para no atar este paquete al
 * esquema; se tipa de forma laxa a propósito.
 */

interface Tramo {
  desde: number;
  hasta: number;
}

export const aMinutos = (hhmm: string): number => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Intersección de dos listas de tramos. El resultado nunca amplía a ninguna. */
export const intersectarTramos = (a: Tramo[], b: Tramo[]): Tramo[] => {
  const out: Tramo[] = [];
  for (const x of a) {
    for (const y of b) {
      const desde = Math.max(x.desde, y.desde);
      const hasta = Math.min(x.hasta, y.hasta);
      if (desde < hasta) out.push({ desde, hasta });
    }
  }
  return out;
};

export interface AvailabilityOptions {
  /** Excluir las horas ya pasadas cuando la fecha consultada es hoy. */
  excluirPasado?: boolean;
  /**
   * Cita que se está moviendo. Su hora actual NO cuenta como ocupada.
   *
   * Sin esto, al reprogramar, la propia cita del paciente bloquea la hora a la
   * que se la acaba de mover: el agente la cambiaba a las 17:00 y acto seguido
   * informaba de que las 17:00 no estaban libres. El paciente elegía otra, se
   * repetía, y la hora acababa rebotando de un lado a otro.
   */
  excluirCitaId?: string;
}

export async function calcularHorasLibres(
  prisma: any,
  clinicId: string,
  date: Date,
  treatmentId?: string,
  doctorId?: string,
  options: AvailabilityOptions = {},
): Promise<string[]> {
  const { excluirPasado = true, excluirCitaId } = options;

  // 1. Duración de la reserva
  let durationMin = 30;
  if (treatmentId) {
    const treatment = await prisma.treatment.findUnique({ where: { id: treatmentId } });
    if (treatment?.durationAvgMin) durationMin = treatment.durationAvgMin;
  }

  // 2. Profesionales candidatos. Con tratamiento, solo los que lo atienden:
  //    ofrecer una hora de alguien que no hace ese tratamiento es ofrecer nada.
  let doctorIds: string[] = [];
  if (doctorId) {
    const doc = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (doc && doc.active !== false) doctorIds = [doctorId];
  } else if (treatmentId) {
    const docsTr = await prisma.doctorTreatment.findMany({
      where: { clinicId, treatmentId },
      include: { doctor: true },
    });
    doctorIds = docsTr
      .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
      .map((dt: any) => dt.doctorId);
  } else {
    const activos = await prisma.doctor.findMany({ where: { clinicId, active: true } });
    doctorIds = activos.map((d: any) => d.id);
  }
  if (doctorIds.length === 0) return [];

  // 3. Horario de la clínica: es el límite exterior
  const dayOfWeek = date.getDay();
  const scheduleDb = await prisma.clinicSchedule.findFirst({ where: { clinicId, dayOfWeek } });
  const schedule = scheduleDb || {
    isOpen: dayOfWeek !== 0,
    openTime: '09:00',
    closeTime: '18:00',
  };
  if (!schedule.isOpen) return [];

  const tramoClinica: Tramo[] = [
    { desde: aMinutos(schedule.openTime), hasta: aMinutos(schedule.closeTime) },
  ];

  // 4-6. Bloqueos de clínica, jornadas y ausencias
  const [blocks, jornadas, ausencias, citas] = await Promise.all([
    prisma.unavailabilityBlock.findMany({
      where: { clinicId, active: true, daysOfWeek: { has: dayOfWeek } },
    }),
    // Se piden TODOS los días, no solo el consultado: hay que distinguir "no
    // trabaja ese día" de "no tiene jornada configurada", y filtrando por
    // dayOfWeek ambos casos llegan aquí como una lista vacía.
    prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId: { in: doctorIds }, active: true },
    }),
    prisma.doctorAbsence.findMany({
      where: {
        clinicId,
        doctorId: { in: doctorIds },
        startsAt: { lt: endOfDay(date) },
        endsAt: { gt: startOfDay(date) },
      },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId: { in: doctorIds },
        scheduledAt: { gte: startOfDay(date), lte: endOfDay(date) },
        status: { not: 'CANCELLED' },
        ...(excluirCitaId ? { id: { not: excluirCitaId } } : {}),
      },
    }),
  ]);

  // 7. Ventana efectiva de cada profesional.
  //
  //    Quien NO tiene jornada configurada en ningún día hereda el horario de la
  //    clínica: así, los profesionales dados de alta antes de existir esta
  //    función siguen comportándose igual en vez de quedarse sin horas de golpe.
  //
  //    Pero en cuanto alguien define su jornada, manda la jornada: un día sin
  //    tramos es un día en el que NO atiende. Si no se distinguieran los dos
  //    casos, configurar "martes y jueves" dejaría el resto de la semana con el
  //    horario completo de la clínica, que es justo lo contrario de lo pedido.
  const ventanaPorDoctor = new Map<string, Tramo[]>();
  for (const docId of doctorIds) {
    const suyos = jornadas.filter((j: any) => j.doctorId === docId);
    const tieneJornadaDefinida = suyos.length > 0;
    const deEseDia = suyos.filter((j: any) => j.dayOfWeek === dayOfWeek);

    if (tieneJornadaDefinida && deEseDia.length === 0) {
      ventanaPorDoctor.set(docId, []);
      continue;
    }

    const base: Tramo[] = tieneJornadaDefinida
      ? deEseDia.map((j: any) => ({ desde: aMinutos(j.startTime), hasta: aMinutos(j.endTime) }))
      : tramoClinica;
    ventanaPorDoctor.set(docId, intersectarTramos(base, tramoClinica));
  }

  // 8. Generar y filtrar
  const slots: string[] = [];
  const current = new Date(date);
  current.setHours(Math.floor(tramoClinica[0].desde / 60), tramoClinica[0].desde % 60, 0, 0);
  const end = new Date(date);
  end.setHours(Math.floor(tramoClinica[0].hasta / 60), tramoClinica[0].hasta % 60, 0, 0);

  const now = new Date();
  const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

  while (current < end) {
    const slotStart = new Date(current);
    const slotEnd = addMinutes(slotStart, durationMin);
    const slotDesde = slotStart.getHours() * 60 + slotStart.getMinutes();
    const slotHasta = slotDesde + durationMin;

    const bloqueado = blocks.some((b: any) => {
      const bStart = aMinutos(b.startTime);
      const bEnd = aMinutos(b.endTime);
      return slotDesde < bEnd && slotHasta > bStart;
    });

    if (!bloqueado) {
      const alguienLibre = doctorIds.some((docId) => {
        const ventana = ventanaPorDoctor.get(docId) || [];
        if (!ventana.some((t) => slotDesde >= t.desde && slotHasta <= t.hasta)) return false;

        const ausente = ausencias.some(
          (a: any) =>
            a.doctorId === docId &&
            slotStart < new Date(a.endsAt) &&
            slotEnd > new Date(a.startsAt),
        );
        if (ausente) return false;

        return !citas.some((app: any) => {
          if (app.doctorId !== docId) return false;
          const appStart = new Date(app.scheduledAt);
          const appEnd = addMinutes(appStart, app.durationMin || 30);
          return slotStart < appEnd && slotEnd > appStart;
        });
      });

      const pasado = excluirPasado && isToday && slotStart <= now;
      if (alguienLibre && !pasado) slots.push(format(slotStart, 'HH:mm'));
    }

    current.setTime(current.getTime() + durationMin * 60 * 1000);
  }

  return slots;
}

/**
 * Por qué no hay horas ese día.
 *
 * Existe porque devolver un "no hay disponibilidad" a secas deja al modelo sin
 * explicación, y cuando no la tiene se la inventa: a un paciente que pidió el
 * viernes 25 le respondió que ese día "ya pasó", faltando dos días para él y
 * habiendo dicho el propio agente, un mensaje antes, que hoy era el 23.
 *
 * Solo se llama cuando no hay horas, así que el coste de estas consultas se
 * paga en un camino poco frecuente.
 */
export async function explicarSinHoras(
  prisma: any,
  clinicId: string,
  date: Date,
  treatmentId?: string,
  doctorId?: string,
): Promise<string> {
  const finDelDia = endOfDay(date);
  if (finDelDia.getTime() < Date.now()) {
    return 'ese día ya pasó';
  }

  const dayOfWeek = date.getDay();
  const horarioClinica = await prisma.clinicSchedule.findFirst({ where: { clinicId, dayOfWeek } });
  if (horarioClinica && horarioClinica.isOpen === false) {
    return 'la clínica está cerrada ese día';
  }

  // Profesionales que pueden atender eso
  let candidatos: { id: string; name: string }[] = [];
  if (doctorId) {
    const d = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (d) candidatos = [{ id: d.id, name: d.name }];
  } else if (treatmentId) {
    const rel = await prisma.doctorTreatment.findMany({
      where: { clinicId, treatmentId },
      include: { doctor: true },
    });
    candidatos = rel
      .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
      .map((dt: any) => ({ id: dt.doctor.id, name: dt.doctor.name }));
  }

  if (!candidatos.length) {
    return 'no hay ningún profesional asignado a ese tratamiento';
  }

  const ids = candidatos.map((c) => c.id);
  const [jornadas, ausencias] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { clinicId, doctorId: { in: ids }, active: true } }),
    prisma.doctorAbsence.findMany({
      where: {
        clinicId,
        doctorId: { in: ids },
        startsAt: { lt: endOfDay(date) },
        endsAt: { gt: startOfDay(date) },
      },
    }),
  ]);

  const motivos: string[] = [];
  for (const c of candidatos) {
    const suyas = jornadas.filter((j: any) => j.doctorId === c.id);
    const eseDia = suyas.filter((j: any) => j.dayOfWeek === dayOfWeek);

    if (suyas.length && !eseDia.length) {
      motivos.push(`${c.name} no atiende ese día de la semana`);
      continue;
    }
    if (ausencias.some((a: any) => a.doctorId === c.id)) {
      motivos.push(`${c.name} tiene una ausencia registrada ese día`);
      continue;
    }
    motivos.push(`${c.name} tiene la agenda llena ese día`);
  }

  return motivos.join('; ');
}
