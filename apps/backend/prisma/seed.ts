import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    email: 'demo@aisdr.dev',
    password: 'demo1234',
    name: 'Demo User',
    org: 'Acme Sales Co',
    plan: 'GROWTH' as const,
    leadsLimit: 2000,
  },
  {
    email: 'admin@aisdr.dev',
    password: 'admin1234',
    name: 'Sarah Admin',
    org: 'Techflow Inc',
    plan: 'AGENCY' as const,
    leadsLimit: 10000,
  },
];

const SAMPLE_LEADS = [
  { firstName: 'Marcus',  lastName: 'Thompson', email: 'marcus@stripe.com',     title: 'VP of Sales',           company: 'Stripe',     industry: 'Payments',  country: 'US', city: 'San Francisco', score: 92, status: 'HOT'        as const },
  { firstName: 'Elena',   lastName: 'Vasquez',  email: 'elena@notion.so',       title: 'Head of Growth',        company: 'Notion',     industry: 'SaaS',      country: 'US', city: 'New York',     score: 88, status: 'REPLIED'    as const },
  { firstName: 'David',   lastName: 'Park',     email: 'dpark@linear.app',      title: 'Director of Sales',     company: 'Linear',     industry: 'SaaS',      country: 'US', city: 'Remote',       score: 81, status: 'CONTACTED'  as const },
  { firstName: 'Aisha',   lastName: 'Khan',     email: 'aisha@vercel.com',      title: 'Sales Operations',      company: 'Vercel',     industry: 'DevTools',  country: 'US', city: 'San Francisco', score: 74, status: 'CONTACTED'  as const },
  { firstName: 'Lucas',   lastName: 'Müller',   email: 'l.muller@hubspot.com',  title: 'Account Executive',     company: 'HubSpot',    industry: 'Marketing', country: 'DE', city: 'Berlin',       score: 67, status: 'NEW'        as const },
  { firstName: 'Priya',   lastName: 'Sharma',   email: 'priya@figma.com',       title: 'Revenue Operations',    company: 'Figma',      industry: 'Design',    country: 'US', city: 'San Francisco', score: 79, status: 'CONTACTED'  as const },
  { firstName: 'Tomáš',   lastName: 'Novák',    email: 'tomas@gitlab.com',      title: 'Senior Sales Manager',  company: 'GitLab',     industry: 'DevTools',  country: 'CZ', city: 'Prague',       score: 71, status: 'NEW'        as const },
  { firstName: 'Sophie',  lastName: 'Laurent',  email: 'sophie@datadog.com',    title: 'VP Sales EMEA',         company: 'Datadog',    industry: 'Observability', country: 'FR', city: 'Paris',    score: 85, status: 'REPLIED'    as const },
  { firstName: 'Ravi',    lastName: 'Patel',    email: 'ravi@snowflake.com',    title: 'Director, Mid-Market',  company: 'Snowflake',  industry: 'Data',      country: 'US', city: 'San Mateo',    score: 90, status: 'HOT'        as const },
  { firstName: 'Anna',    lastName: 'Schmidt',  email: 'anna@asana.com',        title: 'Sales Development Rep', company: 'Asana',      industry: 'SaaS',      country: 'DE', city: 'Munich',       score: 58, status: 'NEW'        as const },
  { firstName: 'Jonah',   lastName: 'Reyes',    email: 'jonah@retool.com',      title: 'Head of Sales',         company: 'Retool',     industry: 'DevTools',  country: 'US', city: 'San Francisco', score: 83, status: 'CONTACTED'  as const },
  { firstName: 'Mei',     lastName: 'Lin',      email: 'mei@airtable.com',      title: 'Customer Success Lead', company: 'Airtable',   industry: 'SaaS',      country: 'US', city: 'San Francisco', score: 62, status: 'NEW'        as const },
];

const SAMPLE_CAMPAIGNS = [
  {
    name: 'Q2 Outbound — SaaS DACH',
    status: 'ACTIVE'  as const,
    channel: 'EMAIL'  as const,
    targetIndustry: 'SaaS',
    targetCountry: 'DE',
    targetSize: '50-200',
    dailyLimit: 50,
  },
  {
    name: 'Enterprise Decision Makers',
    status: 'ACTIVE'  as const,
    channel: 'EMAIL'  as const,
    targetIndustry: 'DevTools',
    targetCountry: 'US',
    targetSize: '200-1000',
    dailyLimit: 100,
  },
  {
    name: 'LinkedIn Warm-up',
    status: 'PAUSED'  as const,
    channel: 'LINKEDIN' as const,
    targetIndustry: 'SaaS',
    targetCountry: 'US',
    targetSize: '10-50',
    dailyLimit: 20,
  },
  {
    name: 'Re-engagement (Cold)',
    status: 'DRAFT'   as const,
    channel: 'EMAIL'  as const,
    targetIndustry: 'Marketing',
    dailyLimit: 30,
  },
];

const SAMPLE_SEQUENCE = [
  { stepNumber: 1, delayDays: 0,  subject: 'Quick question about {{company}}', body: 'Hi {{firstName}},\n\nNoticed {{company}} is growing fast in {{industry}}. We help teams like yours automate cold outreach with AI — typically saves 10+ hours/week per SDR.\n\nWorth a quick 15-min chat next week?\n\nBest,\nMarcus' },
  { stepNumber: 2, delayDays: 3,  subject: 'Re: Quick question about {{company}}', body: '{{firstName}},\n\nFollowing up on my note. Did this catch you at a bad time?\n\nHappy to share a 90-sec demo video if easier.\n\n— Marcus' },
  { stepNumber: 3, delayDays: 7,  subject: 'Last note from me', body: '{{firstName}},\n\nLast one from me — I respect your inbox.\n\nIf cold outreach isn\'t a priority right now, totally fair. Otherwise, here\'s our calendar: cal.com/marcus-demo.\n\n— Marcus' },
];

async function main() {
  console.log('[seed] Starting…');

  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);

    const existingUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (existingUser) {
      console.log(`[seed] User ${u.email} already exists, skipping`);
      continue;
    }

    const org = await prisma.organization.create({
      data: {
        name:       u.org,
        plan:       u.plan,
        leadsLimit: u.leadsLimit,
      },
    });

    const user = await prisma.user.create({
      data: {
        email:        u.email,
        passwordHash,
        name:         u.name,
        role:         'OWNER',
        orgId:        org.id,
      },
    });

    console.log(`[seed] Created user ${u.email} (org=${u.org}, plan=${u.plan})`);

    // Seed leads
    const leads = await Promise.all(
      SAMPLE_LEADS.map(l =>
        prisma.lead.create({
          data: {
            ...l,
            source:    'manual',
            enriched:  true,
            orgId:     org.id,
          },
        })
      )
    );
    console.log(`[seed]   → ${leads.length} leads`);

    // Seed campaigns
    for (const [i, c] of SAMPLE_CAMPAIGNS.entries()) {
      const campaign = await prisma.campaign.create({
        data: {
          ...c,
          orgId:  org.id,
          userId: user.id,
        },
      });

      // Sequence for the first 2 campaigns
      if (i < 2) {
        await prisma.sequence.createMany({
          data: SAMPLE_SEQUENCE.map(s => ({
            ...s,
            channel:    c.channel,
            campaignId: campaign.id,
          })),
        });

        // Enroll some leads into the active campaign
        if (c.status === 'ACTIVE') {
          const enrollIds = leads.slice(0, 6).map(l => l.id);
          await prisma.campaignLead.createMany({
            data: enrollIds.map((leadId, idx) => ({
              campaignId:  campaign.id,
              leadId,
              currentStep: idx < 2 ? 2 : idx < 4 ? 1 : 0,
              status:      idx < 2 ? 'REPLIED' as const : 'CONTACTED' as const,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
    console.log(`[seed]   → ${SAMPLE_CAMPAIGNS.length} campaigns`);

    // Seed some message history for activity feed
    for (const lead of leads.slice(0, 8)) {
      const sentAt = new Date(Date.now() - Math.random() * 6 * 86_400_000);
      await prisma.message.create({
        data: {
          leadId:      lead.id,
          direction:   'OUTBOUND',
          channel:     'EMAIL',
          subject:     `Quick question about ${lead.company}`,
          body:        `Hi ${lead.firstName}, …`,
          aiGenerated: true,
          sentAt,
          openedAt:    Math.random() > 0.4 ? new Date(sentAt.getTime() + 3_600_000) : null,
        },
      });

      if (lead.status === 'REPLIED' || lead.status === 'HOT') {
        await prisma.message.create({
          data: {
            leadId:     lead.id,
            direction:  'INBOUND',
            channel:    'EMAIL',
            body:       'Sounds interesting, send me more info',
            replyClass: lead.status === 'HOT' ? 'INTERESTED' : 'FOLLOW_UP',
            sentAt:     new Date(sentAt.getTime() + 86_400_000),
            repliedAt:  new Date(sentAt.getTime() + 86_400_000),
          },
        });
      }
    }
    console.log(`[seed]   → message history`);
  }

  console.log('\n[seed] Done. Demo credentials:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email}  /  ${u.password}    (${u.org} · ${u.plan})`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
