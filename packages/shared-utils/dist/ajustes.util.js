"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HORAS_DE_RECORDATORIO = void 0;
exports.ajustesDelAgente = ajustesDelAgente;
exports.adaptarTrato = adaptarTrato;
exports.fueraDeAnticipacion = fueraDeAnticipacion;
exports.HORAS_DE_RECORDATORIO = [72, 24, 2];
function ajustesDelAgente(json) {
    const a = (json && typeof json === 'object' ? json : {});
    const r = (a.recordatorios && typeof a.recordatorios === 'object' ? a.recordatorios : {});
    const horas = Array.isArray(r.horas)
        ? r.horas.map(Number).filter((h) => exports.HORAS_DE_RECORDATORIO.includes(h))
        : [...exports.HORAS_DE_RECORDATORIO];
    const min = Number(a.anticipacionMinDias);
    const max = a.anticipacionMaxDias == null || a.anticipacionMaxDias === '' ? null : Number(a.anticipacionMaxDias);
    return {
        nombre: typeof a.nombre === 'string' ? a.nombre.trim() : '',
        trato: a.trato === 'usted' ? 'usted' : 'tu',
        anticipacionMinDias: Number.isFinite(min) && min > 0 ? Math.floor(min) : 0,
        anticipacionMaxDias: max != null && Number.isFinite(max) && max > 0 ? Math.floor(max) : null,
        evaluacionPrimero: a.evaluacionPrimero === true,
        abonoEvaluacionRepetida: a.abonoEvaluacionRepetida === true,
        recordatorios: { horas, pedirConfirmacion: r.pedirConfirmacion === true },
        atencionHumana: typeof a.atencionHumana === 'string' ? a.atencionHumana.trim() : '',
    };
}
/**
 * Pasa a "usted" un texto escrito tuteando. Es para los mensajes que arma el
 * propio sistema (confirmaciones, avisos, recordatorios, correcciones del
 * guardarraíl), que están escritos de tú: en una clínica que trata de usted,
 * un "¿Me das tu RUT?" en medio de una conversación de usted desentona.
 * Sobre un texto que ya está de usted no cambia nada.
 */
function adaptarTrato(texto, trato) {
    if (!texto || trato !== 'usted')
        return texto;
    const reglas = [
        [/\bcontigo\b/g, 'con usted'],
        [/\btú\b/g, 'usted'],
        [/\bTú\b/g, 'Usted'],
        [/\bpara ti\b/g, 'para usted'],
        [/\btus\b/g, 'sus'],
        [/\bTus\b/g, 'Sus'],
        [/\btu\b/g, 'su'],
        [/\bTu\b/g, 'Su'],
        [/\bte\b/g, 'le'],
        [/\bTe\b/g, 'Le'],
        // Imperativos y verbos habituales en los mensajes del sistema.
        [/\bescríbenos\b/g, 'escríbanos'],
        [/\brespóndenos\b/g, 'respóndanos'],
        [/\bRespóndenos\b/g, 'Respóndanos'],
        [/\bdinos\b/g, 'díganos'],
        [/\bDinos\b/g, 'Díganos'],
        [/\bEscríbenos\b/g, 'Escríbanos'],
        [/\bavísame\b/g, 'avíseme'],
        [/\bAvísame\b/g, 'Avíseme'],
        [/\bdime\b/g, 'dígame'],
        [/\bDime\b/g, 'Dígame'],
        [/\bconfírmame\b/g, 'confírmeme'],
        [/\bcuéntame\b/g, 'cuénteme'],
        [/\bCuéntame\b/g, 'Cuénteme'],
        [/\bindícame\b/g, 'indíqueme'],
        [/\bIndícame\b/g, 'Indíqueme'],
        [/\bescribe\b/g, 'escriba'],
        [/\bresponde\b/g, 'responda'],
        [/\bResponde\b/g, 'Responda'],
    ];
    const verbos = [
        ['das', 'da'], ['puedes', 'puede'], ['quieres', 'quiere'], ['prefieres', 'prefiere'],
        ['tienes', 'tiene'], ['necesitas', 'necesita'], ['estás', 'está'],
        ['eres', 'es'], ['sabes', 'sabe'], ['vienes', 'viene'], ['llegas', 'llega'],
        ['confirmas', 'confirma'], ['compartes', 'comparte'], ['pasas', 'pasa'], ['indicas', 'indica'],
        ['deseas', 'desea'], ['buscas', 'busca'], ['recuerdas', 'recuerda'], ['podrías', 'podría'],
    ];
    let t = texto;
    for (const [re, v] of reglas)
        t = t.replace(re, v);
    for (const [de, a] of verbos) {
        t = t.replace(new RegExp(`\\b${de}\\b`, 'g'), a);
        const may = de[0].toUpperCase() + de.slice(1);
        t = t.replace(new RegExp(`\\b${may}\\b`, 'g'), a[0].toUpperCase() + a.slice(1));
    }
    return t;
}
/** ¿Cabe esa fecha dentro de la anticipación de la clínica? Devuelve el motivo si no. */
function fueraDeAnticipacion(fecha, ajustes, hoy = new Date()) {
    const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diferencia = Math.round((dia(fecha) - dia(hoy)) / 86_400_000);
    if (diferencia < ajustes.anticipacionMinDias) {
        return ajustes.anticipacionMinDias === 1
            ? 'la clínica reserva con al menos 1 día de anticipación: no hay horas para hoy'
            : `la clínica reserva con al menos ${ajustes.anticipacionMinDias} días de anticipación`;
    }
    if (ajustes.anticipacionMaxDias != null && diferencia > ajustes.anticipacionMaxDias) {
        return `la clínica solo abre la agenda hasta ${ajustes.anticipacionMaxDias} días hacia adelante`;
    }
    return null;
}
//# sourceMappingURL=ajustes.util.js.map