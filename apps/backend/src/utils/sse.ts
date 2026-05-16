import { Response } from 'express';

// SSE client registry: orgId → list of active response streams
const sseClients = new Map<string, Response[]>();

export function registerSSEClient(orgId: string, res: Response): void {
  sseClients.set(orgId, [...(sseClients.get(orgId) ?? []), res]);
}

export function unregisterSSEClient(orgId: string, res: Response): void {
  const clients = sseClients.get(orgId) ?? [];
  sseClients.set(orgId, clients.filter(c => c !== res));
}

export function broadcastToOrg(orgId: string, event: string, data: object): void {
  const clients = sseClients.get(orgId) ?? [];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}
