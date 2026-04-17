"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
console.log('--- 🧪 Iniciando Verificación Atómica: shared-types ---\n');
/**
 * TEST 1: Un objeto que cumple la interfaz IAppointment pasa la validación (HAPPY PATH)
 */
function test1() {
    const appointment = {
        id: 'uuid-1',
        clinic_id: 'clinic-1',
        scheduled_at: new Date(),
        duration_min: 60,
        status: index_1.AppointmentStatus.CONFIRMED,
        source: index_1.AppointmentSource.AGENT,
        reminder_3d_sent: false,
        reminder_1d_sent: false,
        reminder_1h_sent: false,
        created_at: new Date(),
        updated_at: new Date(),
    };
    console.log('✅ TEST 1: IAppointment validado correctamente.');
    return appointment;
}
/**
 * TEST 2: Los enums exportan los valores correctos (HAPPY PATH)
 */
function test2() {
    if (index_1.UserRole.SUPERADMIN === 'SUPERADMIN' && index_1.Channel.WHATSAPP === 'WHATSAPP') {
        console.log('✅ TEST 2: Enums validados correctamente.');
        return true;
    }
    throw new Error('FALLO: Enums no coinciden con los valores esperados.');
}
/**
 * TEST 3: IApiResponse<T> genérico funciona con herencia (HAPPY PATH)
 */
function test3() {
    const response = {
        success: true,
        data: { ok: true }
    };
    console.log('✅ TEST 3: IApiResponse genérico validado.');
    return response;
}
/**
 * TEST 4: Un objeto sin clinic_id NO debe satisfacer una interfaz de dominio (ERROR ESPERADO)
 */
function test4() {
    try {
        // @ts-expect-error - clinic_id is required
        const invalidClinic = {
            id: '123',
            scheduled_at: new Date(),
            duration_min: 30,
            status: index_1.AppointmentStatus.PENDING,
            source: index_1.AppointmentSource.AGENT,
            reminder_3d_sent: false,
            reminder_1d_sent: false,
            reminder_1h_sent: false,
            created_at: new Date(),
            updated_at: new Date(),
        };
        console.log('❌ TEST 4: FALLO (No debería permitir objeto sin clinic_id)');
    }
    catch (e) {
        console.log('✅ TEST 4: Capturado error de tipo (clinic_id faltante).');
    }
}
/**
 * TEST 5: Asignar un valor no permitido a un Enum debe fallar (ERROR ESPERADO)
 */
function test5() {
    try {
        // @ts-expect-error - 'INVALID_STATUS' no existe en el enum
        const invalidAppointment = {
            id: '123',
            clinic_id: '123',
            scheduled_at: new Date(),
            duration_min: 30,
            status: 'INVALID_STATUS',
            source: index_1.AppointmentSource.AGENT,
            reminder_3d_sent: false,
            reminder_1d_sent: false,
            reminder_1h_sent: false,
            created_at: new Date(),
            updated_at: new Date(),
        };
        console.log('❌ TEST 5: FALLO (Permitió valor inválido en status)');
    }
    catch (e) {
        console.log('✅ TEST 5: Capturado error de tipo (Enum inválido).');
    }
}
// Ejecución
test1();
test2();
test3();
test4();
test5();
console.log('\n--- 🎉 Verificación de shared-types FINALIZADA ---');
//# sourceMappingURL=verify.js.map