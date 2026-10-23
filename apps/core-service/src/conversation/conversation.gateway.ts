import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { verifyJWT } from '@deviaty/shared-utils';
import { IJwtPayload } from '@deviaty/shared-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sala de una clínica: solo sus usuarios reciben lo que pasa en ella. */
export const salaDeClinica = (clinicId: string) => `clinic:${clinicId}`;

/**
 * Orígenes que pueden abrir el socket: el panel (FRONTEND_URL, admite varios
 * separados por coma) y, fuera de producción, el front en local. Se evalúa en
 * cada conexión: el decorador se lee al importar el archivo, antes de que se
 * cargue el .env en desarrollo.
 */
function origenPermitido(origin: string | undefined): boolean {
  // Sin Origin no es un navegador; igual tiene que traer un token válido.
  if (!origin) return true;
  const permitidos = String(process.env.FRONTEND_URL || 'https://app.dentral.cl')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    permitidos.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return permitidos.includes(origin.replace(/\/$/, ''));
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
      cb(null, origenPermitido(origin)),
  },
  namespace: '/',
})
export class ConversationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private logger: Logger = new Logger('ConversationGateway');
  /** Desconexión programada para cuando vence el token de cada socket. */
  private vencimientos = new Map<string, NodeJS.Timeout>();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  /**
   * Por aquí viajan los mensajes de los pacientes: antes cualquiera que abriera
   * un socket, sin sesión, recibía los de todas las clínicas. Ahora hace falta
   * el mismo token de acceso que pide el gateway, y cada socket entra solo a la
   * sala de su clínica.
   */
  handleConnection(client: Socket) {
    const token = this.extraerToken(client);
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      this.logger.error('JWT_ACCESS_SECRET no está configurado: se rechazan todos los sockets.');
      return this.rechazar(client, 'sin secreto');
    }
    if (!token) return this.rechazar(client, 'sin token');

    let payload: IJwtPayload;
    try {
      payload = verifyJWT<IJwtPayload>(token, secret);
    } catch (e) {
      return this.rechazar(client, `token inválido (${(e as Error).message})`);
    }

    let clinicId: string | undefined = payload.clinicId;
    // Igual que en el gateway: el equipo de la plataforma puede trabajar dentro
    // de otra clínica y manda cuál en el handshake. A cualquier otro se le
    // ignora. Sin elegir una no entra en ninguna: la clínica de su cuenta no es
    // la suya (el gateway le rechaza esas rutas por lo mismo).
    if (payload.platformAdmin === true) {
      const actuarComo = String(
        client.handshake.auth?.actAsClinic ?? client.handshake.headers['x-act-as-clinic'] ?? '',
      ).trim();
      clinicId = UUID.test(actuarComo) ? actuarComo : undefined;
    }

    if (clinicId) {
      client.join(salaDeClinica(clinicId));
    }

    // El socket no puede durar más que el token con el que entró: si no, una
    // cuenta desactivada seguiría recibiendo mensajes. El panel vuelve a
    // conectarse con el token renovado.
    if (payload.exp) {
      const restante = payload.exp * 1000 - Date.now();
      const t = setTimeout(() => client.disconnect(true), Math.max(0, restante));
      this.vencimientos.set(client.id, t);
    }

    this.logger.log(`Client connected: ${client.id} (user ${payload.userId}, clinic ${clinicId ?? '—'})`);
  }

  handleDisconnect(client: Socket) {
    const t = this.vencimientos.get(client.id);
    if (t) clearTimeout(t);
    this.vencimientos.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emite un evento solo a los usuarios de una clínica. Nunca a todos: sin
   * clínica no se emite nada.
   */
  emitToClinic(clinicId: string | null | undefined, event: string, payload: any) {
    if (!clinicId) {
      this.logger.warn(`Evento ${event} sin clínica: no se emite.`);
      return;
    }
    this.server.to(salaDeClinica(clinicId)).emit(event, payload);
  }

  /** handshake.auth.token (lo que manda el panel) o la cabecera Authorization. */
  private extraerToken(client: Socket): string | undefined {
    const desdeAuth = client.handshake.auth?.token;
    if (typeof desdeAuth === 'string' && desdeAuth.trim()) {
      return desdeAuth.replace(/^Bearer\s+/i, '').trim();
    }
    const header = client.handshake.headers?.authorization;
    const [tipo, token] = String(header || '').split(' ');
    return tipo === 'Bearer' && token ? token : undefined;
  }

  private rechazar(client: Socket, motivo: string) {
    this.logger.warn(`Socket ${client.id} rechazado: ${motivo}`);
    client.disconnect(true);
  }
}
