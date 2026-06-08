import axios, { AxiosInstance } from 'axios';



type JsonObject = Record<string, unknown>;

type CleanupTask = {

  name: string;

  fn: () => Promise<void>;

};



const baseURL = (process.env.SMOKE_BASE ?? 'http://localhost:3099').replace(/\/$/, '');

const demoEmail = process.env.SMOKE_EMAIL ?? 'demo@aisdr.dev';

const demoPassword = process.env.SMOKE_PASSWORD ?? 'demo1234';



const publicApi = axios.create({

  baseURL,

  timeout: 30_000,

});



const api = axios.create({

  baseURL,

  timeout: 30_000,

});



const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const smokeIndustry = `Smoke QA ${suffix}`;

const smokeCountry = 'Austria';

const manualEmail = `smoke.manual.${suffix}@example.com`;

const importEmail = `smoke.import.${suffix}@example.com`;



const cleanupTasks: CleanupTask[] = [];



let passed = 0;

let failed = 0;

const failures: string[] = [];



let token = '';

let manualLeadId = '';

let importedLeadId = '';

let campaignId = '';

let generatedMessageId = '';

let outboundMessageId = '';

let analyticsBeforeSent = 0;

let runNowSent = 0;



function isRecord(value: unknown): value is JsonObject {

  return typeof value === 'object' && value !== null && !Array.isArray(value);

}



function getStringField(value: unknown, key: string): string | null {

  if (!isRecord(value)) return null;

  const raw = value[key];

  return typeof raw === 'string' ? raw : null;

}



function getNumberField(value: unknown, key: string): number | null {

  if (!isRecord(value)) return null;

  const raw = value[key];

  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

}



function getArrayField(value: unknown, key: string): JsonObject[] {

  if (!isRecord(value)) return [];

  const raw = value[key];

  return Array.isArray(raw) ? raw.filter(isRecord) : [];

}



function getCollection(value: unknown, keys: string[]): JsonObject[] {

  if (Array.isArray(value)) return value.filter(isRecord);

  if (!isRecord(value)) return [];



  for (const key of keys) {

    const raw = value[key];

    if (Array.isArray(raw)) return raw.filter(isRecord);

  }



  return [];

}



function assert(condition: unknown, message: string): asserts condition {

  if (!condition) throw new Error(message);

}



function preview(value: unknown): string {

  try {

    const text = JSON.stringify(value);

    return text.length > 700 ? `${text.slice(0, 700)}...` : text;

  } catch {

    return String(value);

  }

}



function describeError(err: unknown): string {

  if (axios.isAxiosError(err)) {

    const status = err.response?.status;

    const data = err.response?.data;

    if (status) return `HTTP ${status}: ${preview(data ?? err.message)}`;

    return err.message;

  }



  return err instanceof Error ? err.message : String(err);

}



function extractToken(value: unknown, depth = 0): string | null {

  if (depth > 4 || !isRecord(value)) return null;



  const preferredKeys = ['token', 'accessToken', 'access_token', 'jwt'];



  for (const key of preferredKeys) {

    const raw = value[key];

    if (typeof raw === 'string' && raw.length > 10) return raw;

  }



  for (const [key, raw] of Object.entries(value)) {

    const normalized = key.toLowerCase();

    if (

      typeof raw === 'string' &&

      raw.length > 10 &&

      normalized.includes('token') &&

      !normalized.includes('refresh')

    ) {

      return raw;

    }

  }



  for (const key of ['data', 'auth', 'session', 'user']) {

    const found = extractToken(value[key], depth + 1);

    if (found) return found;

  }



  return null;

}



function requireId(value: unknown, label: string): string {

  const id = getStringField(value, 'id');

  assert(id, `${label}: response does not contain id`);

  return id;

}



function addCleanup(name: string, fn: () => Promise<void>): void {

  cleanupTasks.push({ name, fn });

}



async function deleteIgnoringCommonCleanupErrors(client: AxiosInstance, path: string): Promise<void> {

  await client.delete(path, {

    validateStatus: (status) =>

      (status >= 200 && status < 300) ||

      status === 404 ||

      status === 409 ||

      status === 500,

  });

}



async function runStep(name: string, fn: () => Promise<void>): Promise<void> {

  try {

    await fn();

    passed++;

    console.log(`PASS ${name}`);

  } catch (err) {

    failed++;

    const message = describeError(err);

    failures.push(`${name}: ${message}`);

    console.log(`FAIL ${name} — ${message}`);

  }

}



async function cleanup(): Promise<void> {

  for (let i = cleanupTasks.length - 1; i >= 0; i--) {

    const task = cleanupTasks[i];



    try {

      await task.fn();

    } catch (err) {

      console.log(`WARN cleanup ${task.name} — ${describeError(err)}`);

    }

  }

}



async function main(): Promise<void> {

  console.log(`SMOKE_BASE ${baseURL}`);



  await runStep('auth login demo', async () => {

    const response = await publicApi.post('/api/auth/login', {

      email: demoEmail,

      password: demoPassword,

    });



    token = extractToken(response.data) ?? '';

    assert(token, `login response does not contain token: ${preview(response.data)}`);



    api.defaults.headers.common.Authorization = `Bearer ${token}`;

  });



  await runStep('auth me', async () => {

    assert(token, 'missing auth token');

    const response = await api.get('/api/auth/me');

    assert(isRecord(response.data), 'GET /api/auth/me returned non-object response');

  });



  await runStep('leads list', async () => {

    const response = await api.get('/api/leads');

    const leads = getCollection(response.data, ['leads', 'data', 'items']);

    assert(Array.isArray(leads), 'GET /api/leads did not return leads collection');

  });



  await runStep('leads create manual', async () => {

    const response = await api.post('/api/leads', {

      firstName: 'Smoke',

      lastName: 'Manual',

      email: manualEmail,

      title: 'Founder',

      company: `Smoke Manual ${suffix}`,

      industry: smokeIndustry,

      country: smokeCountry,

      city: 'Vienna',

      source: 'smoke',

    });



    manualLeadId = requireId(response.data, 'created lead');

    addCleanup('manual lead', async () => {

      if (manualLeadId) await deleteIgnoringCommonCleanupErrors(api, `/api/leads/${manualLeadId}`);

    });

  });



  await runStep('leads get manual by id', async () => {

    assert(manualLeadId, 'missing manual lead id');

    const response = await api.get(`/api/leads/${manualLeadId}`);

    assert(getStringField(response.data, 'id') === manualLeadId, 'GET /api/leads/:id returned wrong lead');

  });



  await runStep('leads update manual', async () => {

    assert(manualLeadId, 'missing manual lead id');

    const response = await api.put(`/api/leads/${manualLeadId}`, {

      title: 'Updated Smoke Founder',

      notes: 'Updated by smoke test',

    });



    assert(

      getStringField(response.data, 'title') === 'Updated Smoke Founder',

      'PUT /api/leads/:id did not update title'

    );

  });



  await runStep('leads delete manual', async () => {

    assert(manualLeadId, 'missing manual lead id');

    const response = await api.delete(`/api/leads/${manualLeadId}`);

    assert(response.status >= 200 && response.status < 300, 'DELETE /api/leads/:id failed');

  });



  await runStep('leads import csv', async () => {

    const csvContent = [

      'firstName,lastName,email,title,company,industry,country,city,website',

      `Smoke,Imported,${importEmail},Head of Growth,Smoke Import ${suffix},${smokeIndustry},${smokeCountry},Vienna,https://example.com`,

    ].join('\n');



    const response = await api.post('/api/leads/import', { csvContent });

    const imported = getNumberField(response.data, 'imported') ?? 0;



    assert(imported >= 1, `CSV import did not import rows: ${preview(response.data)}`);

  });



  await runStep('leads find imported csv lead', async () => {

    const response = await api.get('/api/leads', {

      params: {

        search: importEmail,

        limit: 10,

      },

    });



    const leads = getCollection(response.data, ['leads', 'data', 'items']);

    const imported = leads.find((lead) => getStringField(lead, 'email') === importEmail);



    assert(imported, `imported lead not found by email ${importEmail}`);

    importedLeadId = requireId(imported, 'imported lead');



    addCleanup('imported lead', async () => {

      if (importedLeadId) await deleteIgnoringCommonCleanupErrors(api, `/api/leads/${importedLeadId}`);

    });

  });



  await runStep('campaigns create', async () => {

    const response = await api.post('/api/campaigns', {

      name: `Smoke Campaign ${suffix}`,

      channel: 'EMAIL',

      targetIndustry: smokeIndustry,

      targetCountry: smokeCountry,

      dailyLimit: 20,

    });



    campaignId = requireId(response.data, 'created campaign');

    addCleanup('campaign', async () => {

      if (campaignId) await deleteIgnoringCommonCleanupErrors(api, `/api/campaigns/${campaignId}`);

    });

  });



  await runStep('campaigns get by id', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.get(`/api/campaigns/${campaignId}`);

    assert(getStringField(response.data, 'id') === campaignId, 'GET /api/campaigns/:id returned wrong campaign');

  });



  await runStep('sequences create step 1', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.post(`/api/sequences/${campaignId}`, {

      stepNumber: 1,

      delayDays: 0,

      subject: `Smoke intro ${suffix}`,

      body: 'Hi, this is a smoke-test outreach message. No action is needed.',

      channel: 'EMAIL',

    });



    assert(requireId(response.data, 'sequence step 1'), 'sequence step 1 was not created');

  });



  await runStep('sequences create step 2', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.post(`/api/sequences/${campaignId}`, {

      stepNumber: 2,

      delayDays: 1,

      subject: `Smoke follow-up ${suffix}`,

      body: 'Following up from the smoke test. No action is needed.',

      channel: 'EMAIL',

    });



    assert(requireId(response.data, 'sequence step 2'), 'sequence step 2 was not created');

  });



  await runStep('sequences list by campaign', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.get(`/api/sequences/${campaignId}`);

    const sequences = Array.isArray(response.data) ? response.data.filter(isRecord) : [];

    assert(sequences.length >= 2, `expected at least 2 sequences, got ${sequences.length}`);

  });



  await runStep('analytics stats before send', async () => {

    const response = await api.get('/api/analytics/stats');

    analyticsBeforeSent = getNumberField(response.data, 'emailsSentThisWeek') ?? 0;

    assert(Number.isFinite(analyticsBeforeSent), 'analytics emailsSentThisWeek is not numeric');

  });



  await runStep('campaigns start', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.post(`/api/campaigns/${campaignId}/start`);

    const leadsEnrolled = getNumberField(response.data, 'leadsEnrolled') ?? 0;



    assert(leadsEnrolled > 0, `campaign did not enroll leads: ${preview(response.data)}`);

  });



  await runStep('outreach run-now sends campaign', async () => {

    assert(campaignId, 'missing campaign id');

    const response = await api.post('/api/outreach/run-now', {

      campaignId,

      max: 10,

    });



    const processed = getNumberField(response.data, 'processed') ?? 0;

    runNowSent = getNumberField(response.data, 'sent') ?? 0;



    assert(processed > 0, `run-now processed no campaign leads: ${preview(response.data)}`);

    assert(runNowSent > 0, `run-now sent no messages: ${preview(response.data)}`);

  });



  await runStep('run-now created message and changed lead status', async () => {

    assert(importedLeadId, 'missing imported lead id');

    const response = await api.get(`/api/leads/${importedLeadId}`);

    const leadStatus = getStringField(response.data, 'status');

    const messages = getArrayField(response.data, 'messages');

    const outbound = messages.find((message) =>

      getStringField(message, 'direction') === 'OUTBOUND' && Boolean(getStringField(message, 'sentAt'))

    );



    assert(leadStatus && leadStatus !== 'NEW', `lead status was not changed: ${leadStatus}`);

    assert(outbound, `outbound sent message not found on lead: ${preview(messages)}`);



    outboundMessageId = requireId(outbound, 'outbound message');

  });



  await runStep('analytics stats after send', async () => {

    const response = await api.get('/api/analytics/stats');

    const emailsSentThisWeek = getNumberField(response.data, 'emailsSentThisWeek') ?? 0;



    assert(

      emailsSentThisWeek >= analyticsBeforeSent + 1,

      `analytics did not reflect send: before=${analyticsBeforeSent}, after=${emailsSentThisWeek}`

    );

  });



  await runStep('outreach generate by lead', async () => {

    assert(importedLeadId, 'missing imported lead id');

    const response = await api.post('/api/outreach/generate', {

      leadId: importedLeadId,

      campaignId,

      language: 'en',

      tone: 'professional',

      senderName: 'Smoke Tester',

      senderCompany: 'AI SDR Smoke',

      saveAsMessage: true,

    });



    const body = getStringField(response.data, 'body');

    generatedMessageId = getStringField(response.data, 'messageId') ?? '';



    assert(body && body.length > 0, `generate did not return body: ${preview(response.data)}`);

    assert(generatedMessageId, `generate saveAsMessage did not return messageId: ${preview(response.data)}`);

  });



  await runStep('outreach classify reply', async () => {

    assert(importedLeadId, 'missing imported lead id');

    const response = await api.post('/api/outreach/classify', {

      leadId: importedLeadId,

      messageBody: 'Thanks, this is interesting. Please send me more details.',

    });



    const classification = getStringField(response.data, 'classification');

    assert(

      Boolean(classification),

      `classify did not return classification: ${preview(response.data)}`

    );

  });



  await runStep('outreach auto-reply', async () => {

    const messageId = generatedMessageId || outboundMessageId;

    assert(messageId, 'missing message id for auto-reply');



    const response = await api.post('/api/outreach/auto-reply', {

      messageId,

      replyText: 'Thanks, this is interesting. Please send me more details.',

      senderName: 'Smoke Tester',

      senderTitle: 'QA',

      language: 'en',

      send: false,

    });



    const body = getStringField(response.data, 'body');

    assert(body && body.length > 0, `auto-reply did not return body: ${preview(response.data)}`);

  });



  await runStep('tracking open pixel without auth', async () => {

    assert(outboundMessageId, 'missing outbound message id');

    const response = await publicApi.get(`/api/track/open/${outboundMessageId}`, {

      responseType: 'arraybuffer',

      validateStatus: (status) => status === 200,

    });



    const contentType = String(response.headers['content-type'] ?? '');

    assert(response.status === 200, 'tracking pixel did not return 200');

    assert(contentType.includes('image/gif'), `tracking pixel content-type is ${contentType}`);

  });



  await runStep('billing subscription', async () => {

    const response = await api.get('/api/billing/subscription');

    const plan = getStringField(response.data, 'plan');



    assert(response.status === 200, 'billing subscription did not return 200');

    assert(plan, `billing subscription did not return plan: ${preview(response.data)}`);

  });



  await cleanup();



  console.log(`SUMMARY passed=${passed} failed=${failed}`);



  if (failures.length > 0) {

    console.log('FAILURES');

    for (const item of failures) {

      console.log(`- ${item}`);

    }

  }



  if (failed > 0) {

    process.exit(1);

  }

}



main().catch(async (err) => {

  failed++;

  failures.push(`fatal: ${describeError(err)}`);

  console.log(`FAIL fatal — ${describeError(err)}`);



  await cleanup();



  console.log(`SUMMARY passed=${passed} failed=${failed}`);

  process.exit(1);

});