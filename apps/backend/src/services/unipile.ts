import axios from 'axios';
import { config } from '../config';

const unipileClient = axios.create({
  baseURL: config.unipile.dsn || 'https://api.unipile.com',
  headers: {
    'X-API-KEY': config.unipile.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  publicIdentifier?: string;
  profileUrl?: string;
}

export interface SendLinkedInMessageOptions {
  recipientProfileUrl: string;
  message: string;
  accountId?: string;
}

export interface LinkedInConnectionRequestOptions {
  recipientProfileUrl: string;
  note?: string;
  accountId?: string;
}

/**
 * Get all connected LinkedIn accounts
 */
export async function getLinkedInAccounts(): Promise<Array<{ id: string; name: string }>> {
  const response = await unipileClient.get<{
    items: Array<{ id: string; name: string; provider: string }>;
  }>('/api/v1/accounts');

  return (response.data.items ?? []).filter((a) => a.provider === 'LINKEDIN');
}

/**
 * Send a LinkedIn message to a profile
 */
export async function sendLinkedInMessage(
  options: SendLinkedInMessageOptions
): Promise<{ id: string }> {
  const accounts = await getLinkedInAccounts();
  const accountId = options.accountId ?? accounts[0]?.id;

  if (!accountId) {
    throw new Error('No LinkedIn account connected via Unipile');
  }

  // First, get or create a chat with the recipient
  const chatResponse = await unipileClient.post<{ id: string }>('/api/v1/chats', {
    account_id: accountId,
    attendees_ids: [options.recipientProfileUrl],
  });

  const chatId = chatResponse.data.id;

  // Then send the message
  const msgResponse = await unipileClient.post<{ id: string }>(`/api/v1/chats/${chatId}/messages`, {
    text: options.message,
  });

  return { id: msgResponse.data.id };
}

/**
 * Send a LinkedIn connection request with optional note
 */
export async function sendConnectionRequest(
  options: LinkedInConnectionRequestOptions
): Promise<{ id: string }> {
  const accounts = await getLinkedInAccounts();
  const accountId = options.accountId ?? accounts[0]?.id;

  if (!accountId) {
    throw new Error('No LinkedIn account connected via Unipile');
  }

  const payload: Record<string, unknown> = {
    account_id: accountId,
    profile_url: options.recipientProfileUrl,
  };

  if (options.note) {
    payload.message = options.note;
  }

  const response = await unipileClient.post<{ id: string }>(
    '/api/v1/users/invite',
    payload
  );

  return { id: response.data.id };
}

/**
 * Get LinkedIn profile info
 */
export async function getLinkedInProfile(
  profileUrl: string,
  accountId?: string
): Promise<LinkedInProfile | null> {
  const accounts = await getLinkedInAccounts();
  const accId = accountId ?? accounts[0]?.id;

  if (!accId) {
    throw new Error('No LinkedIn account connected via Unipile');
  }

  try {
    const response = await unipileClient.get<LinkedInProfile>('/api/v1/users/me', {
      params: {
        account_id: accId,
        linkedin_url: profileUrl,
      },
    });
    return response.data;
  } catch {
    return null;
  }
}
