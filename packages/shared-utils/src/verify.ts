import { 
  encryptAES256, 
  decryptAES256, 
  isWithinSchedule, 
  calculateSlots,
  signJWT,
  verifyJWT
} from './index';

console.log('--- 🧪 Iniciando Verificación Atómica: shared-utils ---\n');

/**
 * TEST 1: Cifrado/Descifrado AES-256 (HAPPY PATH)
 */
function test1() {
  const secret = 'my-super-secret-key-32-chars-long!';
  const text = 'Hello Deviaty';
  
  const encrypted = encryptAES256(text, secret);
  const decrypted = decryptAES256(encrypted, secret);
  
  if (text === decrypted) {
    console.log('✅ TEST 1: Cifrado AES-256 reversible correctamente.');
  } else {
    throw new Error('FALLO TEST 1: El texto descifrado no coincide.');
  }
}

/**
 * TEST 2: Lógica de horarios isWithinSchedule (HAPPY PATH)
 */
function test2() {
  const timezone = 'America/Santiago';
  // Simular una fecha personalizada (Lunes a las 10:00 AM)
  const monday10AM = new Date('2024-01-01T13:00:00Z'); // 10:00 Santiago (GMT-3)
  
  const ok = isWithinSchedule(monday10AM, '09:00', '18:00', timezone);
  const tooLate = isWithinSchedule(monday10AM, '12:00', '18:00', timezone);
  
  if (ok && !tooLate) {
    console.log('✅ TEST 2: Lógica de horarios validada.');
  } else {
    throw new Error(`FALLO TEST 2: Horarios incorrectos. ok=${ok}, tooLate=${tooLate}`);
  }
}

/**
 * TEST 3: Cálculo de slots (HAPPY PATH)
 */
function test3() {
  const slots = calculateSlots('09:00', '11:00', 30);
  // Esperado: 09:00, 09:30, 10:00, 10:30 (4 slots)
  if (slots.length === 4 && slots[0] === '09:00' && slots[3] === '10:30') {
    console.log('✅ TEST 3: Cálculo de slots correcto (4 slots de 30 min).');
  } else {
    throw new Error(`FALLO TEST 3: Slots incorrectos. length=${slots.length}`);
  }
}

/**
 * TEST 4: JWT Expirado (ERROR ESPERADO)
 */
function test4() {
  const secret = 'shhhh';
  // Creamos un token que expira en 0 segundos
  const token = signJWT({ user: 'test' }, secret, '0s');
  
  try {
    // Esperamos un pequeño delay para asegurar la expiración
    verifyJWT(token, secret);
    console.log('❌ TEST 4: FALLO (El token debería haber expirado)');
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      console.log('✅ TEST 4: Token expirado capturado correctamente.');
    } else {
      console.log('❌ TEST 4: Error inesperado', e.name);
    }
  }
}

/**
 * TEST 5: Descifrado con clave incorrecta (ERROR ESPERADO)
 */
function test5() {
  const secret = 'correct-key-32-chars-long-aaaaaa';
  const wrongSecret = 'wrong-key-32-chars-long-bbbbbbbb';
  const text = 'Secret message';
  
  const encrypted = encryptAES256(text, secret);
  
  try {
    decryptAES256(encrypted, wrongSecret);
    console.log('❌ TEST 5: FALLO (Debería fallar con clave incorrecta)');
  } catch (e) {
    console.log('✅ TEST 5: Error de descifrado capturado (clave incorrecta).');
  }
}

// Ejecución
async function run() {
  test1();
  test2();
  test3();
  test4();
  test5();
  console.log('\n--- 🎉 Verificación de shared-utils FINALIZADA ---');
}

run();
