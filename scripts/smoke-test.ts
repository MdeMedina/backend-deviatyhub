import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const GATEWAY_URL = 'http://localhost:3000/api';
const WEBHOOK_URL = 'http://localhost:3005';

async function runSmokeTest() {
  console.log('🚀 Iniciando Smoke Test Final E2E...');
  console.log('------------------------------------');

  try {
    // 1. LOGIN
    console.log('[1/7] Intentando Login...');
    const loginRes = await axios.post(`${GATEWAY_URL}/auth/login`, {
      email: 'demo@deviaty.com',
      password: 'password123'
    });
    const { accessToken } = loginRes.data;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    console.log('✅ Login exitoso.');

    // 2. CLINIC CONFIG
    console.log('[2/7] Actualizando configuración de clínica...');
    await axios.put(`${GATEWAY_URL}/core/clinic/schedules`, [
      { dayOfWeek: 1, openTime: '08:00', closeTime: '19:00', isOpen: true }
    ], { headers: authHeaders });
    console.log('✅ Configuración de clínica actualizada.');

    // 3. WHATSAPP INBOUND SIMULATION
    console.log('[3/7] Simulando mensaje de paciente (WhatsApp Inbound)...');
    // Simulamos el payload que enviaría Meta
    const mockPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '56912345678',
              text: { body: 'Hola, quiero agendar una limpieza por favor' },
              type: 'text'
            }]
          }
        }]
      }]
    };
    
    // Inyectamos directo al webhook-service (bypass signature validation para test o usar secret)
    // Nota: Como es smoke test local, podemos configurar el webhook-service para saltar validación en TEST_MODE
    // o simplemente enviarlo si tenemos el secret. Usaremos el secret de .env si existe.
    await axios.post(`${WEBHOOK_URL}/webhook/whatsapp`, mockPayload, {
        headers: { 'X-Hub-Signature-256': 'sha256=valid_test_sig' } 
    });
    console.log('✅ Mensaje de paciente encolado.');

    // Esperar un momento para que el agente procese
    console.log('⏳ Esperando procesamiento de IA (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    // 4. VERIFY CONVERSATION
    console.log('[4/7] Verificando creación de conversación...');
    const convsRes = await axios.get(`${GATEWAY_URL}/core/conversations`, { headers: authHeaders });
    const conversations = convsRes.data;
    const myConv = conversations.find((c: any) => c.contactPhone === '56912345678');
    
    if (!myConv) throw new Error('Conversación no encontrada tras mensaje de WhatsApp');
    const convId = myConv.id;
    console.log(`✅ Conversación detectada (ID: ${convId}).`);

    // 5. HUMAN TAKEOVER
    console.log('[5/7] Ejecutando Human Takeover...');
    await axios.post(`${GATEWAY_URL}/core/conversations/${convId}/takeover`, {}, { headers: authHeaders });
    console.log('✅ Takeover completado.');

    // 6. OPERATOR MESSAGE
    console.log('[6/7] Enviando mensaje manual del operador...');
    await axios.post(`${GATEWAY_URL}/core/conversations/${convId}/message`, {
      content: 'Hola, soy el Dr. Smith. ¿En qué horario le acomoda?'
    }, { headers: authHeaders });
    console.log('✅ Mensaje manual enviado.');

    // 7. METRICS SUMMARY
    console.log('[7/7] Verificando métricas del dashboard...');
    const metricsRes = await axios.get(`${GATEWAY_URL}/core/metrics/summary?period=1`, { headers: authHeaders });
    console.log(`✅ Resumen de métricas: ${metricsRes.data.conversations_attended} conversaciones atendidas.`);

    console.log('------------------------------------');
    console.log('🏆 SMOKE TEST COMPLETADO CON ÉXITO 🏆');

  } catch (error: any) {
    console.error('❌ ERROR EN EL SMOKE TEST:', error.response?.data || error.message);
    process.exit(1);
  }
}

runSmokeTest();
