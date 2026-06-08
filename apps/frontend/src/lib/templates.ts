/**
 * Pre-baked email templates used by the ComposeEmailModal template picker.
 * Mustache-style {{tokens}} are kept inline so the user can edit them after pick.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  category?: 'outreach' | 'follow_up' | 'onboarding' | 'success' | 'hiring';
  subject: string;
  body: string;
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'second-outreach-icp',
    name: 'Second outreach for inbound ICP',
    category: 'follow_up',
    subject: 'Following up — {{company}}',
    body:
      'Hi {{first_name}},\n\n' +
      'I wanted to circle back on my note from last week about how teams like {{company}} are cutting cold-outreach hours by 80% with our AI SDR.\n\n' +
      'If you have 15 minutes this week, I would love to walk you through what a campaign for your team would look like — happy to share specific numbers from companies in your space.\n\n' +
      'Either way, glad to be on your radar.\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'cs-check-in-call',
    name: 'Customer Success — Check in call offer',
    category: 'success',
    subject: 'Quick check-in on {{company}}',
    body:
      'Hi {{first_name}},\n\n' +
      'It has been about a month since you rolled out AI SDR across your team — wanted to make sure everything is humming.\n\n' +
      'Would you have 20 minutes this week for a quick check-in? I can share a few patterns we are seeing from accounts that look similar to yours and answer anything outstanding.\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'outreach-inbound-icp',
    name: 'Outreach for inbound ICP',
    category: 'outreach',
    subject: '{{company}} + AI SDR',
    body:
      'Hi {{first_name}},\n\n' +
      'Noticed {{company}} is hiring across GTM — usually a sign your pipeline is the bottleneck rather than your team.\n\n' +
      'We help B2B teams like yours run fully personalized outbound at the volume of an SDR team, without the headcount. Curious whether a 15-minute look would be useful?\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'onboarding-first-outreach',
    name: 'Onboarding first outreach',
    category: 'onboarding',
    subject: 'Welcome to AI SDR, {{first_name}}',
    body:
      'Hi {{first_name}},\n\n' +
      'Welcome aboard. I am your point of contact at AI SDR for the next two weeks of onboarding.\n\n' +
      'Could you share the campaign you want to launch first? Once I know that, I will send a 3-step setup so you are sending personalized emails before the end of the week.\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'disco-call-follow-up',
    name: 'Disco call follow up',
    category: 'follow_up',
    subject: 'Recap — our call earlier',
    body:
      'Hi {{first_name}},\n\n' +
      'Thanks for taking the time today. Quick recap of what we covered:\n\n' +
      '— Current outbound volume and where it breaks down\n' +
      '— What an AI-driven sequence would replace in your workflow\n' +
      '— Pricing for the {{company}} team size\n\n' +
      'Next step on my side: I will send a proposal by Wednesday. Anything I missed?\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'high-value-inbound',
    name: 'High value inbound leads',
    category: 'outreach',
    subject: 'Saw {{company}} signed up — quick intro',
    body:
      'Hi {{first_name}},\n\n' +
      'Welcome to AI SDR. Given the size of your team and the campaigns you are spinning up, I want to make sure you get a hands-on setup rather than the default self-serve flow.\n\n' +
      'Could you grab 20 minutes with me this week? I will walk you through best-in-class campaigns from accounts like yours and answer anything technical.\n\n' +
      'Best,\n{{sender_name}}',
  },
  {
    id: 'hiring-interview-invite',
    name: 'Hiring — Invitation to interview',
    category: 'hiring',
    subject: 'Interview at {{company}}',
    body:
      'Hi {{first_name}},\n\n' +
      'Thanks for applying. After reviewing your background, we would like to invite you to a first interview with our hiring team next week.\n\n' +
      'Could you share a few time slots that work for you? I will send a calendar invite once we lock in.\n\n' +
      'Best,\n{{sender_name}}',
  },
];
