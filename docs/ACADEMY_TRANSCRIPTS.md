# Attio Academy — транскрипты обучающих видео

Скачано yt-dlp, аудио→текст faster-whisper, кадры 2/сек с перцептивным дедупом.

Каждый раздел = один урок (одна фича). Кадры — в `docs/academy/<id>/frames/`.


---

## 01_RG8N7ZRaugw  (24 уник. кадров, 56 реплик)


Кадры: `docs/academy/01_RG8N7ZRaugw/frames/`

```
[0:00:00] Hi, this is Marisa from Atio. In this video, we'll walk through Atio's permissions framework
[0:00:05] and how you can control who can see, edit and manage different parts of your CRM,
[0:00:10] from records and workflows to lists and reports. Before we start, here's a quick overview of
[0:00:17] the different user roles in an Atio workspace, admins and members. Admins can access and manage
[0:00:24] workspace settings, including creating and editing objects, inviting members, managing
[0:00:30] access and billing, and viewing or editing all dashboards, workflows and sequences.
[0:00:36] Members don't have access to workspace settings, can't manage member access or
[0:00:41] send invitations, and can only view or manage the lists, dashboards, workflows and sequences
[0:00:47] that they have been granted access to. By default members can't create or edit objects.
[0:00:54] Atio permissions are based on four access levels, no access, read only, read and write,
[0:01:01] and full access. No access prevents members from seeing the entity, for example a list or a workflow.
[0:01:09] Read only lets members view the entity without making any changes. This is useful for
[0:01:14] stakeholders who need visibility but shouldn't be able to edit the data. Read and write lets
[0:01:20] members view the entity and make edits to the data, but not change the structure or manage
[0:01:25] permissions. This is the most common level for sales and go-to-market teams who use Atio to
[0:01:31] manage and track their work. Finally, full access lets members fully manage an entity,
[0:01:38] for example creating or editing attributes, configuring settings and managing permissions
[0:01:44] for that entity. This gives admin level control over a specific entity without granting access
[0:01:50] to billing or security settings. Access levels can be applied in three ways, workspace, team and
[0:01:57] individual members. Workspace permissions set the default for everyone. Team permissions adjust
[0:02:04] access for groups like sales or revolts, and individual permissions handle exceptions for
[0:02:09] specific users. Permissions granted to more specific hierarchy levels override the broader
[0:02:15] ones. So even if the workspace level access was set to read only, individuals can be granted
[0:02:21] edit access if they need it. This layered approach lets you set sensible defaults with the
[0:02:27] flexibility to grant exceptions for individuals and teams who need it. Now let's take a look
[0:02:33] at how to configure permissions in different parts of Atio. For each object in Atio,
[0:02:39] like people, companies and deals, admins can set permissions for the entire workspace,
[0:02:44] specific teams or individual members. The three access levels here are read only,
[0:02:50] read and write and full access. Here's a common setup for deals. I want deals to be read only
[0:02:57] for most of the workspace but editable by the sales team. To do that I'll go to object settings
[0:03:04] and I will set the workspace access to read only then under teams I'll add the sales team
[0:03:10] with read and write access. I also have a sales contractor who needs to be able to edit deals but
[0:03:15] shouldn't be added to the sales team, so instead I will grant them read and write access under
[0:03:21] individual members which overrides both the workspace and team settings. You'll also see
[0:03:27] automation's permissions here. If you want workflows to take action on records like
[0:03:32] updating attributes or creating tasks then you'll need to explicitly grant permission to
[0:03:37] those workflows. This gives you control over which workflows are allowed to modify your data.
[0:03:43] If you're creating a workflow and it doesn't have the permissions that are needed to perform
[0:03:47] the actions that you've configured you'll see a prompt. If you have the correct access level
[0:03:52] the prompt will present the option of granting the required permission. The same permissions apply
[0:03:58] to lists, dashboards, workflows and sequences. So here I've got a recruitment list which I
[0:04:04] want to be hidden from all workspace members except for our head of talent. I'll open the list
[0:04:10] settings, set the workspace access to no access and override that for this specific member by
[0:04:16] granting full access. Next up I have a dashboard that contains several reports. Permissions are
[0:04:23] set at a dashboard level and apply to all of the reports inside it. I'll set this dashboard to
[0:04:29] read only for the workspace and give the revops team read and write access so that they can
[0:04:34] manage and adjust it. By default any newly created dashboard will only be visible to the user who
[0:04:40] created it and the rest of the workspace will have no access. Permissions can also be set per
[0:04:46] workflow. Earlier we looked at giving workflows permissions to take action on objects like updating
[0:04:53] records whereas here we're controlling who can see the workflow and configure the steps and
[0:04:58] blocks within it. I'll open the workflow settings, set the workspace access to read only and give
[0:05:04] Cassandra read and write access. That way everyone can see how the workflow works but only one person
[0:05:11] can change it. At your permissions framework is designed to scale with your team. You can set
[0:05:17] broad defaults, fine tune access where needed and handle edge cases without creating complexity.
[0:05:24] That way everyone has the access that they need to do their work
[0:05:28] while your data stays accurate, secure and easy to manage.
```


---

## 02_wIrHOjRljCU  (22 уник. кадров, 70 реплик)


Кадры: `docs/academy/02_wIrHOjRljCU/frames/`

```
[0:00:00] Hi, this is Mressa from Ateo.
[0:00:02] In this video, we'll look at how you can use Ask Ateo to search, update and create with AI,
[0:00:08] all through a familiar, easy-to-use chat.
[0:00:11] Ask Ateo is a conversational way to work with your CRM.
[0:00:15] It helps you understand what's happening across your calls, notes, mailbox, integrated data and more,
[0:00:22] bring in additional context through web research and take intelligent action,
[0:00:27] while staying in control of what gets updated or shared.
[0:00:30] Access Ask Ateo from the homepage, sidebar and the top right of most pages in Ateo.
[0:00:36] Let's start with the homepage.
[0:00:38] I'll open Ask Ateo and ask, help me prep for my day.
[0:00:42] This gives me a quick overview of what I need to know, including upcoming meetings,
[0:00:47] deals that need attention and overdue tasks.
[0:00:50] It's a useful way to get orientated without manually checking multiple views or pipelines.
[0:00:56] Ask Ateo can also help with deep analysis across your entire customer relationship.
[0:01:02] This is useful when you want to understand themes or consolidate feedback
[0:01:06] without manually reviewing transcripts, notes or emails.
[0:01:10] For example, I can ask, what objections have come up most often recently?
[0:01:15] Ask Ateo searches across recent calls, notes and emails and returns a summary of what came up,
[0:01:22] along with relevant quotes or call snippets so that I can quickly dig deeper.
[0:01:28] This helps you to quickly and easily spot patterns,
[0:01:31] prepare responses and stay informed without rewatching calls or searching through transcripts.
[0:01:37] For the common actions that you take or questions that you ask,
[0:01:41] you can create and save prompts to reuse later.
[0:01:44] To do this, I'll navigate to the prompt section in my account settings
[0:01:48] and enter a prompt I know that I'll use often.
[0:01:51] For example, here's a more detailed call prep prompt that I might save.
[0:01:55] I'll give it a name and now it's available wherever I use ask Ateo.
[0:02:00] I might also want to save a lighter version of this prompt for quicker prep.
[0:02:04] So what do I need to know to run this call?
[0:02:07] Save prompts help you to work faster and stay consistent
[0:02:12] while still letting you choose how much structure you want each time.
[0:02:16] Now that I have this prompt saved, I can reuse it whenever I'm preparing for a call.
[0:02:21] Instead of digging through emails, transcripts or notes,
[0:02:24] I'll open Ask Ateo and select my prompt.
[0:02:27] Ask Ateo looks at recent calls, notes, emails and deal context
[0:02:32] and summarizes what's important for the call,
[0:02:34] including suggested topics to focus on and any open questions or follow-ups.
[0:02:39] In addition to the data that's inside my CRM,
[0:02:42] Ask Ateo can perform deep internet research to add background on the company,
[0:02:46] their market and recent activity,
[0:02:48] so I can prepare for the call without switching to external tools.
[0:02:52] Once on a call, Ask Ateo can help with questions that come up in real time.
[0:02:57] So for example, if a customer asks about pricing
[0:03:00] and you need to catch up on the information that you've previously shared.
[0:03:03] Instead of searching through records or notes,
[0:03:06] I can ask Ateo, have we spoken to anyone at this company about pricing?
[0:03:11] Ask Ateo will then check the past interactions and return a clear answer,
[0:03:17] including who we spoke with, when the conversation happened and what was discussed.
[0:03:22] This makes it easy to answer questions on the spot
[0:03:25] without leaving the call or breaking the flow of the conversation.
[0:03:29] After the call, Ask Ateo helps make sure nothing gets missed
[0:03:33] without needing to manually update records or remember follow-ups later.
[0:03:37] I can ask Ateo to suggest updates based on what was discussed in the call.
[0:03:42] Once I've reviewed them, Ask Ateo will update the record immediately.
[0:03:46] I can also create follow-ups from the same place.
[0:03:49] So create a task for me to follow up next week.
[0:03:52] This will create a task, link it to the relevant record, and schedule it automatically
[0:03:58] so action items don't get lost after the call.
[0:04:02] And finally, I can ask Ateo to help with follow-up communication.
[0:04:07] draft a follow-up email based on this call.
[0:04:10] Follow-up emails are where the decisions and next steps get confirmed.
[0:04:15] Ask Ateo uses the call context to draft an email that captures what was discussed
[0:04:20] so nothing gets missed.
[0:04:22] And I can review this and send it without writing from scratch.
[0:04:26] Ask Ateo helps you spend less time searching, updating and logging
[0:04:30] and more time taking well-informed next steps.
[0:04:33] By surfacing what matters, capturing updates as they happen
[0:04:37] and turning conversations into clear next steps,
[0:04:40] it helps make sure nothing gets missed, reduces manual work
[0:04:44] and ensures consistency across your team.
```


---

## 03_X4FJY4bMvTk  (33 уник. кадров, 43 реплик)


Кадры: `docs/academy/03_X4FJY4bMvTk/frames/`

```
[0:00:00] Hi, this is Marissa from Atio. In this video we'll look at how you can create custom objects and
[0:00:05] relationship attributes to map your unique data model. Atio comes with five standard objects,
[0:00:10] people, companies, deals, workspaces and users. These standard objects cover many of the common
[0:00:17] elements B2B businesses need to track and in addition to these standard objects,
[0:00:21] custom objects let you extend Atio's data model to track your business exactly as it works.
[0:00:27] For example, in my workspace I've built a custom object called Invoices. Each record is one invoice
[0:00:34] that we've sent to a customer and its attributes include the payment status, due date, amount and
[0:00:39] most importantly which company that invoice is for. Admins can create and manage objects from the
[0:00:46] object menu in workspace settings. You just name your object, pick an icon and then add
[0:00:51] attributes to store the data points that you want to track about this object. So here are some
[0:00:56] examples of attributes for an invoice's object. We've got status to track the payment status,
[0:01:02] date for the invoice's due date, currency for the amount and then either text or number for the
[0:01:08] invoice name. One of the most powerful attribute types is relationship. Relationships link
[0:01:14] records across objects letting you navigate your data in context. So you've already seen this
[0:01:19] with standard objects where companies link to people via the team relationship and also deals
[0:01:24] will link to their company and their associated people. In my Invoices object I've created a
[0:01:31] relationship to the company object. So on the invoice record it shows up as company and on the
[0:01:37] company record the inverse relationship shows up as invoices. Relationships are two-way so you
[0:01:43] can jump between records seamlessly. When setting up a relationship you'll need to specify whether
[0:01:49] the relationship is one-to-one, one-to-many, many-to-one or many-to-many. In this case one company can have
[0:01:56] many invoices but each invoice belongs to just one company. I've also created a relationship
[0:02:03] attribute for the billing contact to indicate who is responsible for paying that invoice
[0:02:08] and the associated workspace that their invoice is for. If an attribute stores an ID or another
[0:02:14] unique identifier you should mark it as unique. That way Atio can prevent duplicates and automatically
[0:02:20] update or create records when syncing from other systems. In this case our invoices are
[0:02:25] generated from our billing system. The unique invoice ID in Atio will correspond to the
[0:02:30] invoice ID from our billing system. Making an attribute required will prevent records from
[0:02:36] being created or updated without a value for that attribute. The record text setting controls
[0:02:41] which attribute is displayed as the record name in Atio. Instead of the default record ID I've set
[0:02:46] mine to show the invoice name so I can identify them quickly and you can select from any text
[0:02:51] attributes on that object. Once your attributes are in place you can start adding data either
[0:02:57] manually by creating the records yourself or automatically through integrations using Atio's
[0:03:03] native integrations, the workflow tool, low code automation platforms like Zapia or NAN
[0:03:09] or directly through Atio's API. When you head into your new object your first set up a view.
[0:03:15] Views control how your data is displayed. You've got table views which are good for structured lists
[0:03:20] similar to a spreadsheet or Kanban views if you want to track by stages. In view settings
[0:03:26] you can control which attributes show up. Since this one is empty I'll click to add a column
[0:03:32] and this is pulling up all existing attributes and also lets me create new ones. You can
[0:03:37] even pull in data from relationships like showing a billing admin's email address.
[0:03:41] Custom objects and relationships let you model your business exactly as it works
[0:03:45] not just how your standard CRM template is expected to. By adding the right attributes,
[0:03:50] linking records together and connecting data automatically you can make Atio your simple
[0:03:55] source of truth for all customer and operational data.
```


---

## 04_J_C7VtVKN5Q  (33 уник. кадров, 57 реплик)


Кадры: `docs/academy/04_J_C7VtVKN5Q/frames/`

```
[0:00:00] Hi, this is Marissa from Atio and this video will explore Atio's standard objects, what
[0:00:04] they are, how they work and how you can tailor them to fit your business.
[0:00:09] In Atio, an object is where you store one type of data, like people, companies or deals.
[0:00:15] Each record is an individual entry within an object.
[0:00:18] Think of an object as a spreadsheet and each record as a row.
[0:00:21] For example, every person in the people object or every company in the companies is its
[0:00:25] own record.
[0:00:27] The companies and people object are enabled by default and when you connect your mailbox
[0:00:32] Atio automatically populates them with everyone you've emailed or met, both historically and
[0:00:37] going forward.
[0:00:38] These two objects form your contact database, giving you a complete, automatically maintained
[0:00:42] view of your network.
[0:00:45] Next is deals, which is used for tracking your sales pipeline.
[0:00:48] Each deal record represents one opportunity and is linked to the company that you
[0:00:52] are selling to and the people that you're engaging with at that company.
[0:00:56] These relationships make it easy to track multiple deals with the same company, whether
[0:01:00] you're working on new sales, renewals or upsells and always know exactly who's
[0:01:04] involved.
[0:01:06] The final two standard objects are workspaces and users.
[0:01:09] These integrate directly with your product or database to capture customer usage data.
[0:01:15] Workspaces represent customer accounts in your product and users represent individual user
[0:01:20] accounts within those workspaces.
[0:01:22] You can sync both directly to your product with integration tools like Segment or from
[0:01:27] your database or data warehouse through reverse ETL tools like Polytomic.
[0:01:31] Bringing product data into Atio gives your whole go to market team access to the current
[0:01:35] and historical state of all of your customers and lets you build automations to flag sales
[0:01:40] opportunities and churn risks.
[0:01:42] So let's see how these work together.
[0:01:44] I've been talking to Lisa at Cosme about buying our software.
[0:01:48] Once I sync my email, Atio creates a person record for Lisa and a company record for Cosme.
[0:01:53] To track the opportunity, I create a deal record that is linked to both.
[0:01:57] If Lisa buys, a workspace record is created when her account is set up in our product,
[0:02:02] bringing in data like subscription status, number of users and engagement metrics.
[0:02:08] Lisa and her teammates become user records which link back to their corresponding person records.
[0:02:13] Each object comes with system attributes which are standard templates for the key
[0:02:17] data points that you should be tracking like company name or email.
[0:02:21] But you can easily add custom attributes to capture what matters most to your team.
[0:02:26] For instance, in the deals, you might want to add a deal type attribute to distinguish
[0:02:31] new business from renewals.
[0:02:33] Atio supports different attribute types like text, number, date, currency and dropdowns
[0:02:39] which are called selects.
[0:02:40] You can also use AI attributes which automatically generate or enrich data for you.
[0:02:46] You can create your own relationships, let's say a billing admin relationship that
[0:02:49] ties a deal to the person that is responsible for billing.
[0:02:52] These relationships are two-way so you can see all of the deals where someone is
[0:02:57] listed as a billing admin right from their person record.
[0:03:00] You can manage attributes in your object settings where you can also
[0:03:04] reorder them or archive the ones that you don't need.
[0:03:07] Data can be added manually or automatically through workflows and integrations.
[0:03:11] For example, syncing user and product data directly from your product,
[0:03:15] also creating deal records when someone fills out your website form
[0:03:19] or enriching data via Atio's research agent or third party tools.
[0:03:24] That's an overview of Atio's five standard objects and how they fit
[0:03:28] together from people and companies to deals, users and workspaces.
[0:03:32] By customizing attributes and relationships, you can shape Atio to
[0:03:36] match exactly how your business works and keep all of your customer data
[0:03:40] connected up to date and ready to act on.
```


---

## 05_jopZf9DANOM  (17 уник. кадров, 22 реплик)


Кадры: `docs/academy/05_jopZf9DANOM/frames/`

```
[0:00:00] Hi, this is Marissa from Atio. In this video we'll look at how to customize record pages
[0:00:04] to surface information that's most useful for your team as they work with customers day to day.
[0:00:10] A quick recap, in Atio your data is stored in objects like companies and people.
[0:00:15] Each individual entry in an object is a record made up of attributes such as company name or
[0:00:20] email. Each type of object has its own record page layout so this gives you control to spot
[0:00:26] like the details that matter most for that record type and the workflows around it.
[0:00:31] Let's use the company's object as an example. Click the three dots at the top right of any
[0:00:36] record page and choose configure page. From here you can adjust four main areas. At the top
[0:00:42] of the overview tab you've got up to six highlight widgets. These are perfect for surfacing key
[0:00:47] attributes like segment or company type so you can see context at a glance and if you're using
[0:00:53] certain integrations you can even add their widgets here too. In the main panel you can
[0:00:58] reorder the default tabs like activity, emails, notes and tasks and you can add relationship
[0:01:04] tabs to show linked records such as a company's team, deals or invoices which I've got synced
[0:01:10] from my invoices object. On the right hand side you can display the attributes that are
[0:01:15] most useful for your team and group them into sections by topic or based on the needs
[0:01:19] of each team. So here we've set up sections for general company information,
[0:01:24] thermographics, location and social media links and you can easily rearrange, add or create new
[0:01:30] sections as needed. And finally at the top right you have action buttons which you can
[0:01:35] reorder based on what your team uses the most. Defaults include core Atio actions and you
[0:01:41] may see additional ones here as well depending on your integrations. So that's how you
[0:01:45] customize record pages in Atio. With every object able to have its own configuration
[0:01:50] you have full flexibility to surface the insights and context that your team needs to work effectively.
```


---

## 06_8G-HQ6rEz1c  (51 уник. кадров, 23 реплик)


Кадры: `docs/academy/06_8G-HQ6rEz1c/frames/`

```
[0:00:00] Hi, this is Marissa from Atio. Today I'll show you how to discover, install and configure apps
[0:00:05] from Atio's ecosystem, a growing catalog of integrations that help you connect Atio to your
[0:00:10] team's tools. Head to the apps page in your workspace settings for the full list of supported
[0:00:16] apps and integrations. You can browse by category and also search for a specific app by name.
[0:00:22] This list is regularly updated as the ecosystem grows. Let's look at Granola. Clicking into
[0:00:28] the app I can see an overview of its capabilities, links to resources and the developer, which in
[0:00:34] this case is Granola themselves. In Atio's ecosystem you will find apps that have been built by integration
[0:00:41] partners like Granola, first-party apps built by Atio and also the developer community.
[0:00:47] The install process varies slightly depending on who built the app. Since this one was built
[0:00:52] by Granola, clicking install prompts me to complete installation and configuration in Granola.
[0:00:57] Now let's take a look at Panda Docs which was built in-house by Atio.
[0:01:02] The app page shows the same overview and resources but this time installation happens
[0:01:07] directly inside Atio so I just click install, connect my Panda Docs account and finish the setup.
[0:01:14] This app also gives me the option to add a widget into my record pages so I can configure it
[0:01:19] right from the app page or later on from a record page and heading to a deal record you
[0:01:24] can see the widget displayed alongside action buttons for quick access.
[0:01:30] By connecting your favorite tools from email and calendar to documents and analytics,
[0:01:34] Atio becomes a central hub where you can streamline communication, automate scheduling,
[0:01:39] keep knowledge organized and unlock richer insights across your workflows.
[0:01:43] That's an overview of how to install and configure apps in Atio's ecosystem.
[0:01:48] Each app has its own setup and use cases so be sure to check out the resources and help
[0:01:52] docs for more details. And if you're interested in building your own apps take a look at our SDK
[0:01:58] at docs.atio.com slash sdk.
```


---

## 07_cpWH3DGjjmc  (33 уник. кадров, 39 реплик)


Кадры: `docs/academy/07_cpWH3DGjjmc/frames/`

```
[0:00:00] Hi, this is Marissa from Atio, and in this video we're going to run through the different
[0:00:03] report types that are available and when you might use them. Atio's reporting tool allows you to
[0:00:08] create reports and group them into dashboards so that you can visually display your team's
[0:00:12] performance, your pipeline health or the state of your business. This gives you an accessible
[0:00:17] and clear overview of your business to enable informed decision making for you and your teams.
[0:00:23] There are five report types in Atio. The ones that you have access to will depend on
[0:00:27] which plan you're on. We'll run through them now one at a time and we'll go into more detail
[0:00:32] and show additional examples in later videos. Insight report is the most flexible report type
[0:00:38] and is likely the type that you will use the most in your dashboards. It shows you the current
[0:00:42] state of your business meaning that it reflects your data as it is at the time that you're
[0:00:46] viewing the report. It gives you the most flexibility when it comes to plotting attributes
[0:00:51] as you can choose one to group by and one to segment by. So here I'm reporting on both
[0:00:56] the stages that my deals are in and their owner. Insight reports that you put any attribute on the
[0:01:01] x-axis including any day attributes. So if for example you wanted to report on how many deals
[0:01:07] were added to your sales pipeline on a weekly basis, then you would use an insight report.
[0:01:12] I have done that in this report here using the created date as the timestamp attribute to
[0:01:17] group by and then selected weekly as the cadence. If I wanted to see the historical
[0:01:23] composition of my pipeline, not just its current state, then I would use Atia's second report type.
[0:01:30] Historical reports will show you a series of historical snapshots of your data so you can
[0:01:34] see how the makeup of your pipeline has changed over time. So as an example, this report shows
[0:01:39] the number of deals in each stage of my pipeline at the end of every week during my chosen time
[0:01:45] period. This differs from insight reports which you can use to display the number of
[0:01:50] deals that were created in any given month. Another example of historical reports is the total
[0:01:55] number of customers showing the total number that existed in our CRM at the end of each week.
[0:02:01] While this does have dates plotted on the x-axis, this is not using a date attribute but rather
[0:02:06] is showing a historical snapshot of my data at the end of each period shown. The final three
[0:02:12] report types are all pipeline reports which help you to understand the health and trends of
[0:02:16] the processes that you track in Atio. They're only available for status attributes which is
[0:02:21] the type of attribute that you should be using to track your different pipeline stages. Funnel
[0:02:25] reports show the conversion and drop-off through the statuses of your pipeline through to your
[0:02:30] target end stage. So I would use one to see the conversion rates or loss to see the loss
[0:02:35] rates. Time and stage shows the minimum, maximum or average amount of time that records are
[0:02:42] spending in the different stages of your pipeline and stage change will show either the number or
[0:02:47] the value of records that have moved into the different stages. So here I have a stage change
[0:02:53] report which only includes the one stage meaning that this is the number of deals that moved into
[0:02:58] one in each time period. I can switch the metric here from count records to deal value
[0:03:04] and now the report is showing me how much revenue was marked as one. That wraps up this
[0:03:09] quick overview of Atio's report types and when to use them. You can learn more and see each type
[0:03:13] in action in our reporting course.
```


---

## 08_hFCh45VrP8Q  (20 уник. кадров, 38 реплик)


Кадры: `docs/academy/08_hFCh45VrP8Q/frames/`

```
[0:00:00] Hi, this is Marissa from ATO, and this video will demonstrate how to use Insight Report.
[0:00:04] Let's start with a quick recap of what an Insight Report is.
[0:00:08] Insight Reports give you a real-time snapshot of your business.
[0:00:11] This means that they show your data exactly as it is at the moment that you open the report.
[0:00:16] Insight Reports give you a flexible canvas to plot attributes on their chart.
[0:00:21] First, you choose your metric that you'd like to plot.
[0:00:23] So here I'd like to report on the total open revenue across our deal object.
[0:00:28] So here is the total dollar value of all deals ever created.
[0:00:32] If I stopped here, I could save this single value as a report on my dashboard.
[0:00:37] But I want to choose an attribute to group my data by.
[0:00:40] So this will be on the x-axis of my chart.
[0:00:43] So I'm selecting sales stage, and I can see the current value of each of our pipeline stages.
[0:00:49] The metric, which is the total dollar value, is my y-axis.
[0:00:53] And my goal here is to report on open pipeline,
[0:00:56] so I will hide the closed one and closed last stages.
[0:00:59] Next, I'll add a segment by attribute to show the composition of each of these bars.
[0:01:04] In this case, I'll add the owner to see how much each of our AEs are contributing to our open pipeline.
[0:01:11] And finally, you can use filters on any report type in Atio to narrow down the records included in the report.
[0:01:18] So here we will just filter by deals owned by our AEs on our US team to just show our US pipeline.
[0:01:27] Some other examples of popular insight reports are how many new customers
[0:01:31] are in each stage of your onboarding pipeline, how many customers churned and for what reasons,
[0:01:36] and how many new workspace signups you've had each week.
[0:01:40] All of these examples use different data types on the x-axis,
[0:01:44] which is possible in insight reports because you can choose which attribute to group your data by.
[0:01:48] So for example, the sales and onboarding reports are both grouped by a status attribute.
[0:01:54] In this case, it is the deal stage and in this case, it's the onboarding stage.
[0:02:00] For the workspace signups example, we're using the created at attribute,
[0:02:05] which is a system generated date attribute.
[0:02:07] And this works well because a workspace record is automatically created
[0:02:11] via our segment integration when a new account is created in our platform.
[0:02:17] If you were logging a signup date, for example, or any other custom date attribute,
[0:02:21] then you could also use that in an insight report to create a time series report.
[0:02:26] And that's everything you need to get started with insight reports.
[0:02:29] They're a powerful way to get real-time answers to key business questions,
[0:02:32] whether you're tracking deal progress, onboarding flow,
[0:02:35] user signups, or churn reasons.
[0:02:38] In the next video, we will explore historical and funnel reports in more detail
[0:02:42] so you can choose the right format for your goals.
```


---

## 09_x9nnoiPPPYw  (22 уник. кадров, 20 реплик)


Кадры: `docs/academy/09_x9nnoiPPPYw/frames/`

```
[0:00:00] Hi this is Marissa from Atio and in this video we'll be looking at how to use historical reports.
[0:00:05] Let's start with a quick recap of what historical report is. Historical reports show you historical
[0:00:10] snapshots of the composition of your pipelines over time. So unlike insight reports which give
[0:00:16] you a real-time snapshot of your data, historical reports will let you track what the data in
[0:00:21] your CRM looked like at prior points in time, week by week, month by month and so on. All
[0:00:26] historical reports use time on the x-axis and you can choose the interval. Unlike insight reports,
[0:00:33] you can't choose a custom date attribute here because historical reports are based on the state of
[0:00:37] your data as it existed at the end of each time period. A common use case for historical reports
[0:00:43] is to see how the makeup of your pipeline has changed over time. This report shows how many
[0:00:48] deals existed in each of our pipeline stages at the end of every week highlighting how the
[0:00:54] size and makeup of our pipeline has fluctuated over time. To set up a historical stage report,
[0:01:00] I first select the object that I'm reporting on and the metric that I want to track. With no
[0:01:05] segmentation, this graph shows the number of deals that existed in any stage at each point in time.
[0:01:12] Segmenting by deal stage using the historical values for that attribute, I can now see how
[0:01:17] many deals were in each stage at the end of each of these weeks. So I'll toggle off the closed
[0:01:23] deals so I can see only the active pipeline. Some other popular use cases are active workspaces or
[0:01:31] users and total revenue from paid invoices. And that's a quick overview of historical reports.
[0:01:38] They're great for spotting trends, measuring progress and understanding how your business
[0:01:42] evolves over time. In the next video, we will look at funnel reports which are designed to
[0:01:47] track how records move through defined stages.
```


---

## 10_u39Xn1nacl8  (37 уник. кадров, 83 реплик)


Кадры: `docs/academy/10_u39Xn1nacl8/frames/`

```
[0:00:00] Hey, this is Marissa from Atio. In this video, I'm going to show you how you can
[0:00:03] import your CSV data into objects in Atio. In this example, we'll walk through migrating
[0:00:09] from an existing CRM from which we've exported two CSVs, one for the companies with which we've
[0:00:15] interacted and another for our deal pipeline. Some of the companies in my CSV already exist in
[0:00:21] Atio since they were automatically created when I synced my mailbox. I want to update
[0:00:25] these records with more details and then also add some new companies that aren't in Atio yet.
[0:00:31] Here is our CSV for companies. We have company name, their company website,
[0:00:36] their status as a prospect or a customer, the date that they first became a customer
[0:00:41] and their location. There are specific formatting requirements for certain data types.
[0:00:46] For example, dates and timestamps need to be ISO standard, European or American format.
[0:00:52] Phone numbers must include the country code and then city, state and country can all be
[0:00:57] imported into Atio, but the values need to be held within one column in your spreadsheet.
[0:01:02] For a full breakdown of formatting, take a look at our formatting guide in the help centre.
[0:01:07] For each object typed reference in your file, it's crucial that you map one of the columns
[0:01:11] in your file to a unique attribute for that object. For each row in your file, Atio will
[0:01:16] take a look for an existing record with the value that you've provided. If a matching record
[0:01:21] exists, it will update that record but if there is no matching record based on this attribute,
[0:01:26] the importer will create a new record. If you don't include a unique attribute in your file at
[0:01:31] all, then Atio will create new records for every single row in that file. To update company records
[0:01:37] in Atio and to prevent duplicates, you must map one of your file columns to Atio's domain
[0:01:42] attribute. Otherwise, the import will create a new company record for every single row in your
[0:01:46] file, even if the company names match companies that exist in Atio.
[0:01:51] Now let's walk through the import process into Atio. I'll go to the company's object, click
[0:01:58] import and export, select import CSV and then choose my CSV file. With the file in Atio,
[0:02:04] the next step is to map the data. On the left hand side here, we have the columns from the
[0:02:10] CSV file and on the right hand side, I have the Atio attributes, which in this case are
[0:02:15] from the company's object. Atio will match your columns and attributes where possible.
[0:02:19] As I mentioned before, it's critical that I've mapped my website column to the company domain's
[0:02:24] attribute. For each column in my file, I'll map it to the appropriate Atio attribute.
[0:02:29] In this case, I don't have an attribute yet for the date that they became a customer,
[0:02:34] so I'll create that as a new attribute on my company object here.
[0:02:39] Next here, we can review the values in our file. Any issues will be flagged with orange
[0:02:44] dots, but Atio hasn't hit any issues with this particular file. Now that's all been reviewed,
[0:02:49] let's click continue to generate a preview of the data before we finalize the import.
[0:02:54] Up here, you can see how many records will be created or updated. You should take a look at
[0:02:58] these numbers as well as the preview of the data that will be imported to make sure that
[0:03:02] everything looks as it's expected to. When I start the import, Atio will track the progress
[0:03:07] forming. At this point, you can navigate away from the page if you don't want to wait for
[0:03:11] the import to continue, and you can track the progress in workspace settings under import history.
[0:03:18] Now, if your import or specific rows in the import have failed, you would receive a warning sign here,
[0:03:24] and if you hover over it, you'll be able to see the error message. We have an article on our
[0:03:29] help center running through the different error messages and how to troubleshoot them.
[0:03:34] Now that I've loaded my companies into Atio, I can move on to my deals.
[0:03:39] Unlike my company's import, where I was updating some records that already existed in Atio and
[0:03:44] creating others, I'll only be creating new deals in this import. It is possible to update deals
[0:03:50] in Atio using its unique identifier, which is the Atio record ID, but since I'm creating these
[0:03:55] for the first time, no record ID exists yet. This is a rare occasion where I don't need
[0:04:01] to map a column in my CSV to a unique attribute on my Atio object. Importing deals introduces
[0:04:07] us to two new concepts. We have required attributes and relationships. You can find out on our help center
[0:04:14] which attributes are required on the standard objects, and then for any custom objects that you've
[0:04:18] created yourself or any lists that you're using, you can navigate to your settings to see this
[0:04:23] information. Deal name, stage, and owner are all required attributes in the Atio deal object,
[0:04:30] meaning they must have a value in order to create a record. So I've included it on my file
[0:04:35] here and every row has a value. In Atio, the information about associations between objects,
[0:04:41] such as a deal being associated with a company, is stored in a special attribute type called a
[0:04:47] relationship attribute. In order to upload the relationship between deals and companies in my
[0:04:52] CSV, we need to supply the unique identifier for the company which is its domain. For any object
[0:04:59] referenced in your file, it's crucial that you map one of the columns to the unique attribute
[0:05:04] for that object. So for example, if I also wanted to upload a relationship to a deal's primary contact
[0:05:11] and associate that with a person's record in Atio, then I would need to provide an email address
[0:05:16] and map that to the associated person's email address attribute. To bring all of these concepts
[0:05:21] together in one example, let's walk through importing our deals. So this time on the deals object,
[0:05:27] I will navigate to the importer. And as before, the first step is to map my CSV columns to attributes
[0:05:35] in Atio. For the company column, you can see that we're selecting the associated company
[0:05:40] relationship attribute and mapping to the company domain. Again, I'll just double check that Atio
[0:05:46] correctly guessed the rest of my mappings and that I've included the required names, stage,
[0:05:51] and owner attributes. In the review step, you'll notice these little orange circles.
[0:05:55] These are warning signs that are letting me know that values are being flagged.
[0:05:59] So let's take a look and see what errors that are with our stages.
[0:06:04] One of the stages I'm trying to import doesn't exist in Atio. From here, I can either select
[0:06:10] an existing stage to reassign it to, or I can click up here and add it in as a stage.
[0:06:15] This one is just a typo, so I'm going to select the correct stage instead.
[0:06:21] Now that's all been reviewed, let's click continue to generate a preview of the data
[0:06:25] before we finalize the import. In the review step, I can see that all of my deals are net new
[0:06:32] and being created. I can also check that the companies I've included were successfully
[0:06:36] mapped to existing companies in Atio. All of the companies already exist, so none will be created.
[0:06:43] Reviewing the final result of this import, let's look at a sample deal record.
[0:06:47] I can see the attribute values were uploaded and if I right click on any of these values,
[0:06:52] I can see exactly when they were created or updated. And now if I look at the associated
[0:06:58] company attribute, I can click through to review the company record as well.
[0:07:03] So that's an overview of how to import CSV data into objects in Atio. We have a separate tutorial
[0:07:09] on how to import into lists and you can view our full guides including formatting and troubleshooting
[0:07:15] in the help center.
```


---

## 11_W_oOficUSqo  (27 уник. кадров, 50 реплик)


Кадры: `docs/academy/11_W_oOficUSqo/frames/`

```
[0:00:00] Hey, this is Marissa from Atio. In this video, I'm going to show you how you can import your CSV
[0:00:04] data into lists in Atio. We've covered importing into objects in another video. If you haven't
[0:00:11] already seen that, I recommend watching it first as it covers all of the key information about
[0:00:15] Atio's importing tool. Importing into lists is largely the same as importing into an object,
[0:00:21] but there are a few differences that we'll run through now. We recently hosted an event for
[0:00:25] Tech Week where attendees could sign up to learn more about our product. I now have the CSV of leads
[0:00:31] that I want to import into a list in Atio. Our six columns are the name of the person who signed up,
[0:00:38] their email address, phone number, lead source, which will be Tech Week event, the stage that
[0:00:43] that lead is in, and then any key information that's been noted. The email address is a unique
[0:00:49] attribute here. For each row in your file, Atio will look for an existing record with the
[0:00:53] value that you've provided. If a matching record exists, it will update that one, and if there's no
[0:00:58] matching record based off of this attribute, then the importer will create a new record.
[0:01:04] If you don't include a unique attribute in your file at all, Atio will create new records for
[0:01:08] every single row. There are no required attributes on the people object or on the list
[0:01:13] that I'm importing into, so I haven't needed to include those. There are specific formatting
[0:01:17] requirements for certain data types. For example, dates and time stamps need to be ISO standard,
[0:01:23] European or American format, and phone numbers must include the country code. For a full breakdown of
[0:01:28] formatting, take a look at our formatting guide in the Help Center. Importing into a list will
[0:01:33] create or update both list entries and the parent record. In this example, for my list of leads,
[0:01:39] the parent object is people, so the import will create or update the list entries for the lead
[0:01:44] list and a person record for each entry. On the left, we have the columns from your csv,
[0:01:49] and on the right, you have Atio attributes. You need to map the columns from your csv to the
[0:01:54] correct attribute in Atio. Because I'm importing into a list, I have access to both the parent
[0:02:01] object attributes, which is the people, and then the list attributes as well. Atio will
[0:02:07] auto-map wherever possible. It's not been able to map the stage here, so I'll do this myself
[0:02:12] by clicking here and then searching for the correct attribute. I haven't actually got
[0:02:18] a summary column set up in this list yet, so I'll create that now by clicking create new attribute,
[0:02:24] choose text as the data type, and then adding summary as its title. That's all mapped now,
[0:02:29] but before moving on to the next step, I need to choose which action Atio should
[0:02:33] take if a list entry already exists for a person in this file. I can choose to update
[0:02:38] the existing list entry or add it again as a separate entry. I'm choosing to add it again
[0:02:44] as these are all new leads from our latest event, and I don't want to overwrite any existing lead
[0:02:48] data. Here we can review the values in our file, and you'll notice the orange circle here,
[0:02:53] which means that values are being flagged. There's an issue with our lead source column.
[0:02:58] The source for all of these leads is Tech Week event, but as you can see here,
[0:03:02] this isn't currently an allowed value for the attribute, so if I click up here,
[0:03:06] I can now add it as an option. Now Atio can assign all of those records to that Tech Week
[0:03:11] event value. With all of this correct, I can continue with the import.
[0:03:16] Up here, you can see how many records or list entries will be created or updated.
[0:03:21] You should take a look at these numbers, as well as the preview of the data that will be imported
[0:03:25] to make sure that everything looks as you expected to. When I start the import,
[0:03:29] Atio will track progress for me, so at this point you can navigate away from the page if
[0:03:33] you don't want to wait for the import to continue, and you can track the progress in
[0:03:37] workspace settings under import history. If your import or specific rows in your
[0:03:41] import failed, then you would receive a warning sign here, so if you hover over it,
[0:03:46] you'll see the error message, and we have an ask call on our help center,
[0:03:49] which runs through all of the different error messages and how to troubleshoot them.
[0:03:54] And here we have our updated list of Tech Week event leads.
[0:03:57] So that's an overview of how to import CSV data into a list in Atio.
[0:04:02] You can also view our full guides, including formatting and troubleshooting in the help center.
```


---

## 12_-HbTAAz9-r0  (31 уник. кадров, 49 реплик)


Кадры: `docs/academy/12_-HbTAAz9-r0/frames/`

```
[0:00:01] Hi this is Marissa from Atio and this is an introduction to Atio's Call Recorder. Atio's
[0:00:07] Call Recorder joins and documents your calls in Zoom, Google Meets and Microsoft Teams
[0:00:12] and stores them right inside of Atio. Transcripts, AI generated summaries and custom AI insight
[0:00:18] templates ensure that your next steps and account context are always easily accessible
[0:00:23] and actionable across your whole team. Before you start using the Call Recorder
[0:00:27] you'll want to configure your settings by navigating to account settings and call recording.
[0:00:32] From here you can choose which types of calls the recorder should automatically join.
[0:00:37] You can also manually add the Call Recorder to any meeting from the meeting details view.
[0:00:42] Additionally you can upload an image or logo to customize the appearance of the recorder
[0:00:47] to participants in your meeting. Once you've synced your email inbox with Atio,
[0:00:51] which you can learn more about in the email sync video in the academy introductions course,
[0:00:56] the Call Recorder will automatically join meetings based on the settings that you've chosen.
[0:01:01] Depending on your video conferencing tools security settings you may need to complete
[0:01:05] additional setup steps in that tool ahead of your first call. With insight templates,
[0:01:10] AI can summarize and highlight the key details from meetings that matter most to you.
[0:01:15] You can create as many templates as you like to easily access consistent summaries,
[0:01:19] analysis and next steps for common call types. Individuals and teams can also create
[0:01:24] personalized templates based on their own needs and follow up responsibilities.
[0:01:28] Here is a template that our sales team uses which summarizes key sales qualification criteria
[0:01:34] like a customer's current tool, what features they need, budgets and timelines.
[0:01:39] With this consistent summary each sales rep has immediate access to the most critical
[0:01:43] data points that they need to plan out next steps in their deal. Let's create a template
[0:01:48] together. On the left set up sections and provide a prompt for each specifying what info you'd
[0:01:54] like the AI to extract, analyze or summarize. Choose whether you'd like the AI response to
[0:01:59] be formatted as texts or bullet points and you can add as many sections as you'd like with this
[0:02:04] button here. You can apply any insight template to any call recording and switch between templates
[0:02:10] to gain multiple perspectives of one call. Depending on how you configure your settings
[0:02:16] the Call Recorder will either automatically join or you can invite it by clicking
[0:02:20] Start Recording on the meeting in Atio. You'll then need to allow it in from the waiting room
[0:02:25] and you can remove it at any time to stop the recording. In the calls tab in Atio you will see
[0:02:31] a live transcript that will be updated in real time while the call is running and being recorded.
[0:02:37] As your CRM Atio is a central repository for your communication history with your customers
[0:02:42] and prospects. Just like emails you can view the entire call history with a given company
[0:02:48] on a company record page or an individual on a person record page. On top of this call recordings
[0:02:53] can be found inside of meeting details on the activity timeline and the calls page that we've
[0:02:58] already seen. The calls page will show all calls from your workspace. You can customize your view
[0:03:04] to show only the calls that are relevant to you by sorting, filtering based on participants
[0:03:09] and associated records which is who else was in the call with you and adding calls to your
[0:03:13] favorites. So as an individual contributor or an AE I'd likely just filter to calls where I was a
[0:03:20] participant but as a team manager I'd have a filtered view to show the calls of everyone in my
[0:03:25] team. If you're on the call page during the recording then you will have seen the transcript
[0:03:29] and insights being added live. Once a call has completed you'll get finalized and updated
[0:03:34] insights. You'll be able to toggle between all of your templates and you'll also receive a
[0:03:39] call summary, meeting chapters on the video, meeting information and speaker stats. Ateo has
[0:03:45] additional payback modes to make it easier to watch a video while also accessing other tabs in
[0:03:50] your browser. Pinned mode which displays video, transcripts and insights as you navigate within
[0:03:55] Ateo and picture-in-picture mode which displays video over all of your windows. Thanks for watching
[0:04:01] this overview of Ateo's call recorder which puts actionable insights from every meeting right
[0:04:06] inside your CRN.
```


---

## 13_3p4HFH3nWaM  (37 уник. кадров, 80 реплик)


Кадры: `docs/academy/13_3p4HFH3nWaM/frames/`

```
[0:00:00] Hi, this is Marissa from ATEO, and this is an overview of AI attributes.
[0:00:04] There are four types of AI attributes, classify record, summarize record, research agent and
[0:00:11] prompt completion.
[0:00:12] You may recognize these names, they're all available as action blocks in our Workflows
[0:00:16] tool, and we have a video in our Academy's Workflows course that runs through these.
[0:00:21] The different AI types work the same as they do in the workflows, but the difference
[0:00:25] is that you can set them up and have them run directly from views and record pages.
[0:00:29] They each serve different purposes and have varying inputs and outputs, so we'll run
[0:00:34] through them individually now.
[0:00:36] You create AI attributes in the same way that you create regular attributes, so either
[0:00:40] from a list or an object view or within your attribute settings.
[0:00:44] When I click create new column and then add new attribute, you can see a shortcut
[0:00:48] to the AI attributes.
[0:00:50] If I click create new attribute here, then you'll have the options in the attribute
[0:00:54] type dropdown and also as a toggle under the other attribute types.
[0:00:59] The AI options that appear here will depend on what attribute type you have chosen.
[0:01:04] Summarized record and research agent will always generate a text output, prompt
[0:01:09] completion can generate a number, text or currency, and classify record will
[0:01:14] generate a select or multi-select.
[0:01:16] Let's create an AI attribute.
[0:01:18] For this example, I'm in my onboarding pipeline, which is a list of workspace
[0:01:22] records, but AI attributes can be created in any object or list.
[0:01:27] This list is used by our onboarding team and workspaces are added from a
[0:01:31] workflow when they convert from a trial into a paying customer.
[0:01:35] We'll be using summarized record to help the onboarding specialist get
[0:01:38] out to speed.
[0:01:39] Summarized record will generate a free text summary for any given record.
[0:01:43] For this attribute, I'm selecting text and giving it a title.
[0:01:48] Guidance is optional.
[0:01:50] If I left this blank, then the AI would summarize the whole record.
[0:01:53] I want it to be a little bit more specific, so I'll add in a prompt to
[0:01:57] provide information on the workspace and company data.
[0:02:00] To run this and calculate the value, I can click this icon within the cell
[0:02:04] on a table or a card row on a Kanban board.
[0:02:07] I can also click on the attribute label up here to run it for all rows
[0:02:11] in the current view, or I can go directly onto the record page.
[0:02:15] I'll calculate for this example here, and once I click confirm,
[0:02:18] I can see that the AI is thinking.
[0:02:21] So a summary has now been generated, and this enables our onboarding
[0:02:24] specialist to kickstart the onboarding process without the need to comb through
[0:02:28] the record and create their own overview in advance.
[0:02:31] This view within my deals object is filtered to show new inbound leads.
[0:02:36] We have a workflow triggered by a type form submission, which is how we host
[0:02:39] our talk to sales form on our website that creates a new deal record using
[0:02:43] the information submitted on the form.
[0:02:46] The form includes questions about the company and what they would like to talk to us about.
[0:02:50] I've got the three remaining AI attribute types set up in this view.
[0:02:55] First, we have research agent, which allows you to ask questions or
[0:02:58] provide guidance for it to research and provide an answer.
[0:03:02] Here I have an attribute called ICP, which stands for Ideal Customer Profile.
[0:03:07] I've provided an overview of what our ICP definition is and
[0:03:11] asked the agent to tell me if the company associated to this deal meets that criteria.
[0:03:17] We also have an example of the ClassifyRecord AI attribute, which reviews
[0:03:22] an entire record and categorizes it using tags.
[0:03:25] For this attribute, we're rooting the lead to the relevant team based off of
[0:03:28] what they want to discuss.
[0:03:30] And finally, there is prompt completion, which is an LLM or large language model.
[0:03:34] This AI attribute requires a prompt and gives you the ability to ask specific
[0:03:39] questions and receive answers using only the variables that you provide.
[0:03:43] I'm going to use this for some data cleanup.
[0:03:45] So I've asked it to take a look at the answer provided in the location question
[0:03:49] on the form and convert this to the correct ISO country code.
[0:03:53] The form allows free text as an answer, but for reporting and filtering purposes,
[0:03:57] I want to make sure that all deals follow the same standards.
[0:04:00] I'll recalculate these and
[0:04:02] we'll see the values populating across these deals.
[0:04:05] AI attributes and their values can be used anywhere in Atio where you'd use an attribute,
[0:04:10] like reporting or triggering workflows.
[0:04:12] As you will have seen throughout this video, when we've clicked to calculate AI values,
[0:04:16] these attributes run on credits.
[0:04:18] Like workflows, the research agent uses 10 credits per run and
[0:04:22] the summarized record, ClassifyRecord and
[0:04:24] prompt completion use one credit each.
[0:04:27] All Atio plans include a set amount of credits each month and
[0:04:30] you can purchase additional credits if needed.
[0:04:33] If you navigate to Workspace Settings and Billing,
[0:04:36] you can see how many credits you've used as well as a breakdown of how and
[0:04:39] when they were used.
[0:04:41] And that concludes this video on AI attributes and
[0:04:43] how you can use them to improve data quality and streamline processes.
```


---

## 14_hPgRSOe_4VM  (22 уник. кадров, 41 реплик)


Кадры: `docs/academy/14_hPgRSOe_4VM/frames/`

```
[0:00:00] Hey it's Marissa from Atio. So far we've covered how you can create sequences and add
[0:00:04] recipients to them and in this video we'll take a look at monitoring and managing your
[0:00:08] sequences once they're live. After you've published your sequence and added recipients
[0:00:12] you'll want to be able to track its performance and make updates where necessary.
[0:00:16] In the sequences tab you will be able to see all of your sequences. Here you have the
[0:00:20] option to archive or delete a sequence. Once a sequence is published it can no longer be
[0:00:26] Archiving a published sequence will prevent new recipients from being added
[0:00:30] but the sequence will complete its course for any existing enrolled recipients.
[0:00:35] To restore an archive sequence toggle the show archived option under view settings
[0:00:40] and then restore sequence. Clicking into a specific sequence allows you to edit it.
[0:00:46] If you head back to the first video in this course you can review all of the
[0:00:49] settings that are available in the sequence editor. When you edit and publish changes
[0:00:54] to a sequence new recipients will receive the latest published version and those who
[0:00:59] were already enrolled will continue to receive the version that was active when they were enrolled.
[0:01:05] Here you have your recipients list where you'll see who enrolled them, their sender and their
[0:01:09] progress. For example I can see that this person received all of the emails in the sequence
[0:01:15] but this person replied to the first email and therefore was exited from the sequence.
[0:01:20] For active recipients you can pause and consequently resume or manually exit them from
[0:01:24] the sequence. Pausing a sequence for an active recipient will prevent future emails from being
[0:01:29] sent until they're manually resumed. During this pause the countdown on any delay step will be
[0:01:35] stopped and then resume where it left off when you unpause that recipient. Exiting will
[0:01:40] permanently remove that recipient from the sequence. You can see insights at the bottom
[0:01:45] here of how many recipients are active enrolled and exited. Ateo will automatically identify
[0:01:50] out of office replies to your sequence. If the sender provides a return to office date in their
[0:01:55] email Ateo would delay the remaining sequence until the day after their return. Ateo limits the
[0:02:01] frequency of emails sent from a single mailbox to protect your deliverability. For each mailbox a
[0:02:06] maximum of 12 emails can be sent per hour and Ateo waits five minutes between each send.
[0:02:11] The daily limit of emails that can be sent with sequences is 200 emails per mailbox.
[0:02:16] You can read more about email deliverability in our help centre.
[0:02:20] During the delivery window set for a sequence queued emails will appear in the outbox under
[0:02:24] emails in the left hand sidebar. If you click onto an email in the outbox you can preview it
[0:02:29] see which sequence it's part of and check when it's scheduled for delivery.
[0:02:34] Admins will have additional visibility in workspace settings. Here you'll be able
[0:02:38] to see all of the sequences in your workspace and edit their permissions
[0:02:41] as well as see a full list of people who have unsubscribed. You'll see the email address that
[0:02:46] unsubscribed, the reason what they unsubscribed from and the date and time that they unsubscribed.
[0:02:52] Once a contact has unsubscribed it's not possible to enroll them in any sequences
[0:02:56] with the same sender. It's also not possible to remove contacts from the unsubscribed list
[0:03:02] unless they were added due to a bounce or manually added from within Ateo.
[0:03:06] That concludes the third and final video in our introductory sequences course
[0:03:10] where we've covered how to create sequences, how to enroll recipients and how to manage your sequences.
```


---

## 15_1afurxoqTPI  (19 уник. кадров, 46 реплик)


Кадры: `docs/academy/15_1afurxoqTPI/frames/`

```
[0:00:00] Hey, it's Mress from Atio and in this video we'll take a look at how you can enroll recipients into your sequences.
[0:00:07] You can add recipients to your sequences manually or through a workflow. Let's start with the manual option.
[0:00:13] The first way that you can manually enroll people to your sequences is within the sequence editor by clicking enroll recipients up here.
[0:00:21] You'll also find an enroll to sequence button on the object views and record pages for people as well as in people lists.
[0:00:28] So if I wanted to hand select who I'm adding to a sequence, let's say for an event that we're hosting in our office,
[0:00:34] I could apply filters to narrow down my view to a specific subset of people,
[0:00:38] click the tick box next to their names and select enroll to sequence.
[0:00:42] On my London locals view here,
[0:00:46] I have a filter for city is London and then another one for associated user status is active,
[0:00:53] which finds all of our active customers that are in the same area as our office.
[0:00:57] So I can either select a few or I could click here to select all from this filtered view.
[0:01:03] Now I can add them to the sequence and choose the sender.
[0:01:07] So in our last video, we explained that you can both invite other team members as senders on your sequence and that each sender can decide whether to delegate sending,
[0:01:15] which allows others to enroll recipients on their behalf. Here you can see that Heather has enabled delegated sending,
[0:01:21] so I'm going to add these emails to the sequence with her as the sender.
[0:01:25] In addition to manually enrolling recipients,
[0:01:27] you can automate enrollment based on key triggers in your go-to-market process using Atio's workflows.
[0:01:33] Let's use the inbound lead sequence that I created in the previous video and run through an example workflow.
[0:01:40] Workflows are Atio's powerful process automation tool that lets you trigger actions from activity within Atio or external inputs.
[0:01:48] To learn more about workflows, head over to the Workflows Academy course.
[0:01:52] This workflow is triggered when someone fills out the talk-to-sales form on our website requesting a demo.
[0:01:57] We use type form, so form submitted is the trigger.
[0:02:01] We then use the data that's been inputted into the form to create or update a person record and delay for five minutes.
[0:02:08] The reason for the delay is that we want to use Atio's enriched attributes on the company record in the next step.
[0:02:14] So we want to give enough time for the company to be created off the back of the person's record and also for those smart attributes to be populated with data.
[0:02:22] Next, we use if-else to determine whether the inbound lead is our ideal customer profile,
[0:02:28] which is essentially a VC-backed tech startup founded in the last five years.
[0:02:33] I'm taking data like category, foundation day, funding raised, and adding it into the condition.
[0:02:40] So if the lead meets this criteria, meaning that this is our ICP, the workflow will continue on the true path.
[0:02:47] If it's not our ICP, then it will continue down the false path.
[0:02:50] For that false path, we are first using a round robin block.
[0:02:55] Then we create a deal record and assign it in the lead stage.
[0:02:58] Our sales team will review these lower priority deals on a daily basis to determine the appropriate follow-up steps.
[0:03:04] For the true path, which is the inbound leads that match our ICP,
[0:03:08] we've set up our workflow to automatically reach out and offer a demo call.
[0:03:12] This gives these high priority customers immediate access to our sales team as soon as they fill out our lead form.
[0:03:18] So again, we'll use a round robin block and create a deal.
[0:03:21] But on this deal, we'll mark it as ICP so that the sales team can easily identify this.
[0:03:27] And instead of adding it to the lead stage, we'll add it to the contactor stage.
[0:03:31] Because the final step that we're using here is enrolling it into our sequence with the enrolled sequence block.
[0:03:37] So here I have selected the sequence, the recipient, and the sender.
[0:03:41] And I'm using the picked user from the round robin or the deal owner to be the sender.
[0:03:47] This is just one example of how you might automatically enroll leads into an email sequence.
[0:03:52] The trigger, logic and action blocks in Atio workflows give you infinite flexibility to decide how and when you enroll recipients in sequences.
[0:04:00] And that wraps up our video on enrolling recipients.
[0:04:03] In the next video, we'll be looking at how you can manage your sequences.
```


---

## 16_YlzA4wxHVhI  (24 уник. кадров, 71 реплик)


Кадры: `docs/academy/16_YlzA4wxHVhI/frames/`

```
[0:00:00] Hey, it's Marissa from Atio and welcome to the first video in our Sequences introduction course.
[0:00:05] Our new email sequencing tool allows you to create adaptive, dynamically triggered email
[0:00:10] sequences based on real-time data right inside of Atio. In this first video, we'll look at
[0:00:15] creating sequences. You'll find sequences under Automations in the left-hand menu of Atio.
[0:00:21] Before you create your first sequence, you need to ensure that you're aware of and
[0:00:25] are following best practices for email deliverability to ensure that your email
[0:00:30] successfully reach your recipients. We have an article on our Help Center that runs
[0:00:34] through this in detail, so be sure to give that a read. Now we're ready to create our
[0:00:38] first sequence, so I'm going to click New Sequence here and give it a title,
[0:00:44] ICP Impound Leads. ICP stands for Ideal Customer Profile, which will be the target
[0:00:49] group for my sequence. So I'm building a sequence to follow up with these
[0:00:54] ICP prospects who have filled out our talk-to-sales form. For these high value
[0:00:58] inbound leads, we'd like to arrange a call with our sales team as soon as
[0:01:02] possible, as well as offer training resources to ensure that they're
[0:01:05] successful with our product. In settings, I can fine-tune exactly when my emails
[0:01:10] will be sent to give the emails the best chance of being opened and
[0:01:14] responded to. The sending window are the hours in which Atio will send
[0:01:18] emails as they're scheduled in the sequence and queued to send.
[0:01:21] If I set the window to 9am to 6pm, for example, but I enrolled someone into the
[0:01:27] sequence at 10pm, their email would get sent to the
[0:01:31] outbox queue at 9am the next day. And depending on the size of your queue, it
[0:01:35] might get sent straight away at 9am or later on in the day.
[0:01:38] For each mailbox, a maximum of 12 emails can be sent per hour
[0:01:42] and Atio waits five minutes between each send. The daily limit of emails that
[0:01:46] can be sent with sequences is 200 emails per mailbox.
[0:01:49] Atio enforces these limits to help with email deliverability, which again you
[0:01:53] can read more about in our help centre. Here you can choose to send emails on
[0:01:57] business days or you can toggle this off to include the weekends.
[0:02:01] You can also choose your preferred wording for the unsubscribe link that will
[0:02:05] be added to the bottom of every email and you'll also get a preview of how
[0:02:08] that will look. This lets you select whether you
[0:02:11] would like subsequent emails in your sequence to reply to the same thread
[0:02:15] or instead be sent in a new one. And here you can choose if you would
[0:02:18] like to include your Atio signature at the end of your emails.
[0:02:21] If you haven't already you can set up your email signature in mailbox settings.
[0:02:25] The exit criteria determines what action should remove a recipient from a
[0:02:29] sequence, preventing them from receiving any remaining emails in that sequence.
[0:02:33] You can choose from reply received and meeting booked.
[0:02:37] By default, all members of your workspace can see and edit your sequence
[0:02:41] but you can restrict access to specific colleagues or only yourself
[0:02:44] from the share menu. Delegated sending is a powerful feature which
[0:02:49] lets your team members enroll recipients into your sequence and have the
[0:02:52] email sent from your inbox. When you toggle the delegated switch to
[0:02:56] on anyone with access to the sequence can enroll recipients on your behalf.
[0:03:01] To enroll recipients using a colleague as a sender, invite them as a sender
[0:03:05] and then have them enable delegated sending. So now I finished
[0:03:08] configuring my settings I can set up the email steps in my
[0:03:11] sequence. By default the first email will be added
[0:03:15] to the email queue as soon as the recipient is enrolled
[0:03:18] or if that recipient is added outside of a delivery window
[0:03:21] at the start of the next window. You can also set a number of days to wait
[0:03:25] before sending the initial email. Let's add in copy for the first email.
[0:03:29] Variables let you personalize your emails with attributes from the
[0:03:32] recipients at your person record. I'm going to use an existing
[0:03:36] template but you can also start from scratch.
[0:03:39] So I'm selecting my ICP leads template. This email is already customized to
[0:03:44] include a variable for the recipient's name but I'll add in another attribute to
[0:03:48] reference their company as well. Clicking add step to sequence
[0:03:53] allows me to add additional emails to the sequence
[0:03:56] and select how many days to wait before sending.
[0:03:59] This second email will be sent to all of the recipients who did not reply
[0:04:03] or book a meeting with me after the initial email so I'll use my follow
[0:04:07] up template. We recommend following our guidelines on
[0:04:10] email content hygiene to ensure that your content supports your email
[0:04:13] deliverability. You can find this in our help center.
[0:04:17] You can add in as many or as few emails as you would like into your sequence
[0:04:21] but for this example I'm going to stop at the two emails
[0:04:25] and now my setup is complete. I'm going to click publish sequence
[0:04:29] which sets this draft live and ready to add recipients.
[0:04:32] So that's covered how to create and configure your sequences.
[0:04:36] Watch our next video to find out how you can enroll recipients.
```


---

## 17_k8rO5aCwv7o  (34 уник. кадров, 93 реплик)


Кадры: `docs/academy/17_k8rO5aCwv7o/frames/`

```
[0:00:00] Hey, it's Marissa from Atio, and welcome to the first video in our workflows course.
[0:00:05] We're starting off with a deep dive into Atio workflow triggers.
[0:00:09] Triggers determine when a workflow should run.
[0:00:11] The first two categories of trigger are record and list triggers, each of which have the
[0:00:15] same three different triggers.
[0:00:18] Record and list entry command triggers let users manually kick off a workflow run associated
[0:00:22] with a specific record or list entry.
[0:00:25] A record created trigger will fire off a workflow anytime a new record or a specific
[0:00:29] type is created, and then the corresponding list entry trigger will fire anytime a
[0:00:34] record is added to a given list.
[0:00:37] There's also record and list entry updated, which can monitor changes to individual
[0:00:41] records of a given object type or entries on a given list.
[0:00:46] We'll give two examples here, one of the record command and one of the record updated.
[0:00:51] There's one input for a record command, which is the object that we want to make
[0:00:54] the workflow available on.
[0:00:56] In this example, we're making a workflow that lets users easily create a new
[0:01:00] deal associated with a company.
[0:01:02] I've selected companies as the object type and then using the create record block
[0:01:06] will create a deal record.
[0:01:08] I've used variables to add the company name as the deal name, setting it to
[0:01:11] the qualification stage, choosing the user who triggered the workflow as the
[0:01:15] deal owner and then associating the deal to that company.
[0:01:19] We'll go into more detail on using action blocks as well as variables in
[0:01:22] later videos.
[0:01:23] In practice, this is how that workflow looks.
[0:01:26] So you first up have the ability to choose one or more companies and then you
[0:01:31] can run that workflow for the company, which will create a deal associated to
[0:01:35] it.
[0:01:36] The run workflow button is also available on an individual record page.
[0:01:40] So I can run the workflow over here for this company.
[0:01:43] And then if we go into our deals object, we'll see that a brand new
[0:01:48] deal has just been created and it's been associated with the company.
[0:01:52] This is a great way to create easy shortcuts for really common tasks
[0:01:55] that your team takes.
[0:01:57] The next example we'll walk through is a record updated trigger.
[0:02:01] The record updated trigger takes two inputs, the object that we want to
[0:02:04] monitor and optionally the specific attribute that we want to monitor
[0:02:07] changes in to trigger the workflow.
[0:02:10] As this workflow is currently built, it will trigger any time a deal
[0:02:14] changes stage.
[0:02:15] More often than not, you'll want the workflow to trigger only when an
[0:02:18] attribute changes to a specific new value.
[0:02:21] So in our example, we're going to congratulate the team when a deal
[0:02:24] is moved to one.
[0:02:25] To do that, we'll add in a filter block.
[0:02:28] I'll talk about filters in more depth in our next video, but here
[0:02:31] we can see that the record updated block returns variables
[0:02:33] containing the values in the attributes we're monitoring before
[0:02:37] and after triggering the change.
[0:02:39] In this case, I'll filter the workflow only to continue when
[0:02:43] the new value of the deal stage is one.
[0:02:45] So here you can see if I move this deal card into the closed
[0:02:49] one stage, a celebration will appear.
[0:02:52] Attribute updated triggers behave similarly to record updated
[0:02:55] triggers, with the exception that they fire not only when the
[0:02:58] attribute value is changed, but also when the record is
[0:03:01] created for the first time.
[0:03:03] Task created triggers trigger any time a task is created.
[0:03:07] And we have three different utility triggers.
[0:03:10] The first utility trigger is a manual run, which will be
[0:03:12] predominantly used for debugging and testing.
[0:03:15] When you use a manual run trigger, a trigger manual
[0:03:18] workflow button will appear at the top of the page in the
[0:03:20] workflow editor so that you can test out all of the steps.
[0:03:23] So trying this out, when I click on that button,
[0:03:27] Attribute takes me to the workflows run page to see
[0:03:29] the history of the run that's kicked off.
[0:03:32] This particular workflow broadcasts a message which has
[0:03:34] appeared at the bottom of the screen so I can tell that
[0:03:37] the workflow has run successfully.
[0:03:39] The recurring schedule trigger lets you define a scheduled
[0:03:42] cadence to run a workflow on a recurring basis.
[0:03:45] You can select the frequency of your schedule as well as
[0:03:47] the particular time of day that it will run.
[0:03:50] And finally, among the utility triggers is one of the most
[0:03:52] flexible triggers in Atio, which is the
[0:03:55] webhook receive trigger.
[0:03:56] This will provide a URL to which an external tool can
[0:03:59] send a webhook or an HTTP post.
[0:04:02] This is a really valuable trigger for having external
[0:04:04] systems, kickoff processes, or workflows within Atio.
[0:04:08] The last category of triggers are triggers associated
[0:04:11] with Atio's native integrations.
[0:04:13] Today we have three of these triggers.
[0:04:16] We have outreach triggers to trigger a workflow anytime
[0:04:19] a contact is added to a sequence or the state of a
[0:04:22] sequence is changed and a type form trigger to trigger
[0:04:25] a workflow anytime a new form response is received.
[0:04:29] This is commonly used by customers who have type
[0:04:32] form forms on their website for inbound enquiries
[0:04:34] and lead management.
[0:04:36] And that's a quick overview of all of the triggers
[0:04:38] available in Atio's workflow tool.
```


---

## 18_R_HHm73QKh4  (21 уник. кадров, 42 реплик)


Кадры: `docs/academy/18_R_HHm73QKh4/frames/`

```
[0:00:00] Hey, it's Mares from Atio and in this video we're going to look at condition and delay blocks.
[0:00:05] Condition blocks determine the path or flow of your workflow and delays control the timing
[0:00:09] of each of the steps. There are three types of condition blocks and we'll go through them one
[0:00:14] by one. We'll use an example of a form that was submitted to our site to request a call.
[0:00:19] Since we book calls via email we can only proceed if an email was provided in the form.
[0:00:24] So we use a filter block to achieve this outcome. A workflow only continues after a filter
[0:00:30] if the filter criteria are met. In this example we will be checking that the email address has
[0:00:36] been filled out by selecting the email address question from the form and then not empty.
[0:00:42] So if an email address was provided in the form then the workflow will continue.
[0:00:47] One of the questions in the form is whether the person filling it out is an existing customer.
[0:00:51] If they say yes then the call request is routed to the customer success team
[0:00:55] but if they say no meaning that they're a new lead the call request gets routed to the sales
[0:01:00] team. I'll achieve that routing using the next hub of condition block if else.
[0:01:05] An if else block takes one filter and forks the path of your workflow.
[0:01:10] For the condition I will select our unexisting customer and select the output as true.
[0:01:16] This statement is true and the person is an existing customer then the workflow will take
[0:01:20] this first path. In this case we will first look up that person in Atio and then once we found
[0:01:26] that record we'll add it to our customer success call request list. On the other hand if the statement
[0:01:31] is false and they're not an existing customer we will create a new deal record and add it to the
[0:01:36] lead stage. Before I create the record I'm going to add in a round robin block. This allows you
[0:01:42] to select the relevant team members in this case our sales reps and we'll rotate through them
[0:01:47] on each workflow run so that the leads are evenly distributed. Now I can create the deal record
[0:01:53] and select the pitch user as the variable for the deal owner attribute. So just to recap an if
[0:01:59] else block will fork the workflow into two branches one where the filter criteria is true and another
[0:02:05] where the filter criteria is false. The third type of workflow block is a switch which allows you
[0:02:10] to create multiple logic branches. In this case we have three branches to our workflow. The first
[0:02:17] is for leads from the United States which get routed to Alexis. The second is for leads
[0:02:22] from the United Kingdom which get routed to Joan and then the third condition is not supplied so we
[0:02:27] get routed to a default option which in this case assigns a deal to our third sales rep Zev.
[0:02:34] With switch blocks you can add as many filter conditions as you like to create as many
[0:02:38] faults as you need in your workflow. Now let's talk about delay blocks. Delay blocks let you
[0:02:42] add time delays to the processing of a workflow which are helpful when you want to set an action
[0:02:47] then wait a set amount of time to see if it has been completed. In this case any time a deal
[0:02:52] is created we want Accio to wait one week before it continues on with the next steps of the workflow.
[0:02:58] A delay block has one input which is the amount of time that we delay in this case we chose one
[0:03:03] and the time frame week. This specific workflow will send a slack message to the team if one
[0:03:09] week after being created the deal is still in the qualification stage so we delay one week
[0:03:14] use a filter to check the stage and if it is still in qualification then we post a message
[0:03:19] to the slack channel to ask why nobody has qualified the lead. The delay that we've supplied here is for
[0:03:24] a fixed amount of time for one week but you can also use a delay and till block where you would
[0:03:29] provide a date that you would like the workflow to pause until and that's everything in our overview
[0:03:34] of condition and delay blocks.
```


---

## 19_s5XAgsoK9m8  (21 уник. кадров, 62 реплик)


Кадры: `docs/academy/19_s5XAgsoK9m8/frames/`

```
[0:00:00] Hey, it's Mara's from Atio and this is an overview of calculation blocks in workflows.
[0:00:05] Calculation blocks can be used to transform existing attributes to be used in later workflow steps.
[0:00:11] I'm going to build a workflow to help our customer success team keep track of
[0:00:15] and prioritize newly created customer accounts. Anytime a customer signs up for a new workspace,
[0:00:21] it will schedule a one-week check-in as well as update revenue information about the account.
[0:00:25] So, it's triggered anytime a new workspace record is created.
[0:00:29] The first thing I want to do in this workflow is create a task for a customer success team
[0:00:33] to schedule the check-in with this customer one week after they created their workspace.
[0:00:38] To allow us to set this due date for one week's time, we need to use our first calculation block,
[0:00:43] which is the adjust time block. The block will take a time stamp to use as its starting point
[0:00:48] and in this case, this will be the date that the workspace was created.
[0:00:52] An offset is the time that you want to add or subtract from the starting time frame.
[0:00:56] You need to add in the number and select the unit. So for this example, I am adding one
[0:01:02] and selecting week. So this will now add one week to the date that the workspace was created.
[0:01:07] Now that we have calculated the date, we can use this adjusted time stamp in subsequent steps.
[0:01:13] Let's create a task to schedule that checking call. For the due date, we'll use the adjusted
[0:01:17] time that we calculated in the previous step. So the due date will be in one week's time from
[0:01:22] when the workflow is triggered and the task is created. The linked record will be the created
[0:01:27] workspace and we'll assign the task to the customer success team member who focuses on onboarding
[0:01:33] new workspaces. The next calculation block is a formula block, which allows you to take numbers
[0:01:40] and apply mathematical transformations to them. In this example, our backend application
[0:01:46] automatically pushes out the annual contract value or the ARR for a workspace any time a
[0:01:51] new workspace record is created. But we also want to track the monthly contract value or the
[0:01:56] MRR, as this is a commonly used data point within our team. So we're going to calculate the MRR
[0:02:01] and store it as an additional attribute within our workspaces object. The formula block can
[0:02:07] use mathematical expressions, numbers and variables in its input. The variables need to be from
[0:02:12] number or currency type attributes. I'm going to insert the ARR, which was automatically
[0:02:17] populated when the workspace was created and divide it by 12 to calculate the MRR.
[0:02:24] We want to add this value to the workspace record, so we'll use the update record block next.
[0:02:30] The workspace we want to update is the workspace that was created and we're updating the MRR
[0:02:35] attribute and the value that we'll provide will be the output of the formula block.
[0:02:40] So to recap this workflow, we use two calculation blocks, adjust time and formula
[0:02:45] to calculate a due date for a task and also to calculate the MRR based on the ARR.
[0:02:50] Let's see how this workflow works once I press publish.
[0:02:54] Workflow is triggered when a new workspace record is created. So let's create a new workspace.
[0:02:59] Let's give it a random workspace ID associated to a company and then set the ARR, let's say 12,000.
[0:03:14] That workspace has been created. So the workflow is now running in the background
[0:03:18] and shortly you will see Atio populate the MRR and create a task due in one week's time.
[0:03:25] Next we'll review a workflow that includes the aggregate values block.
[0:03:28] This workflow sends a go to market team a weekly update on the number of new workspaces
[0:03:33] and the total new ARR from that week. So for the trigger we're using a recurrence schedule
[0:03:39] set towards the end of the working day on Fridays. We then use the find records block,
[0:03:44] which we will go into more detail in a later video, to find all of the workspaces
[0:03:48] with a subscription start date that is before tomorrow and after one week ago,
[0:03:52] which means that the subscription has started in the last week.
[0:03:57] Now it's time for the next calculation block, which is the aggregate block,
[0:04:00] which will take a numeric attribute from a group of records and calculate either the sum,
[0:04:05] average, minimum or maximum value. For this I am taking the ARR of the matching workspaces
[0:04:13] that were found in the previous block and selecting some as the type. In this example
[0:04:18] we've aggregated across records that were returned from the find block,
[0:04:22] but you can also aggregate across relationship attributes,
[0:04:25] such as averaging the ages of all people associated with a specific company.
[0:04:30] Finally I'm sending a slack to the go to market numbers slack channel.
[0:04:34] For the message we have the weekly numbers, which includes the number of new workspaces
[0:04:38] taken from the find records block and the total new ARR taken from the aggregate block.
[0:04:43] And the last calculation block, which we won't actually use today,
[0:04:46] is a random number which simply generates a random number between a minimum and a maximum
[0:04:51] value that you provide. You can then use this random number in subsequent steps.
[0:04:55] So those are Ato's calculation blocks. You've got adjust time to create new dates and timestamps,
[0:05:01] formula blocks to perform mathematical equations, aggregate values to calculate the sum,
[0:05:06] average, minimum and maximum of specified numerical values,
[0:05:09] and random number which will provide a random number within a range of your choosing.
```


---

## 20_j_oiNwgURGI  (37 уник. кадров, 67 реплик)


Кадры: `docs/academy/20_j_oiNwgURGI/frames/`

```
[0:00:00] Hey, it's Marissa from Atio and today we're going to take a look at how you can harness the power of
[0:00:04] AI in your workflows. There are five AI powered blocks within Atio. There's classify record,
[0:00:10] classify text, prompt completion and summarize record. Then over here in the agent section
[0:00:16] you have research record. In this video we're going to take a look at the first four but we
[0:00:20] have another video which runs through the agent blocking detail so make sure to check that out
[0:00:24] as well. We'll start with the classify record and summarize record which we're using together
[0:00:29] in one workflow to ensure a smooth sales handover from sales to customer success and that the
[0:00:34] customer success team have quick and easy access to the key details about each account's history.
[0:00:40] This workflow starts with the trigger and action combination that we've used in a few
[0:00:43] different videos now which is record updated on the status attribute of the deal's object
[0:00:48] and then a filter to check that that new status is one. So this means that the
[0:00:52] remainder of the workflow blocks will run any time a deal is moved into the closed one stage.
[0:00:57] Then we use our first AI block summarize record which will take the attributes of a record and
[0:01:02] generate a summary. For this I want to provide the customer success team with a summary of the deal
[0:01:07] so the record variable we're using is the updated record which is the one deal and in the guidance
[0:01:12] I've added some instructions on what I want the summarize record block to do and which
[0:01:17] variables must be included. Next is classify record. This block similarly to summarize record will
[0:01:24] summarize the attributes of a record but the difference is that it will convert this into tags
[0:01:29] instead of free text. I want the block to take the associated company of the deal record and return
[0:01:35] a tag to highlight what type of business it is. I've added in categories that we use to segment
[0:01:41] our customers so now the classify record block will select which of these the specific company
[0:01:46] belongs to. So far we've used two AI blocks summarize record and classify record to return
[0:01:53] the data about specific records but now we need to store that data somewhere. So the final step in
[0:01:58] this workflow is adding a record to our customer success list. This is a list of companies so
[0:02:03] we're going to add the associated company for the updated deal record. I've used a combination
[0:02:09] of fixed values and variables to populate key attributes but the two that I want to focus
[0:02:13] on here are the deal notes and tag as this is where we'll be pushing the data that was
[0:02:18] generated by the AI blocks. For deal notes we are using the summary variable from two steps prior
[0:02:24] and for tag the tags variable from one step prior. One key thing to note with the tags
[0:02:29] is that you'll need to ensure that these tags provided to the AI block match the select
[0:02:34] options for the attribute where you plan to store that data. So I had technology, agency,
[0:02:40] marketing and finance as my tag options and these match the select options for this industry
[0:02:45] variable. So let's see this workflow in action on this deal record. I'll change the stage of the deal
[0:02:53] to one and then I'll head over to my customer success list and I can see here that the company
[0:02:59] has been added to the list and populated with data from our AI blocks. The third AI block is
[0:03:06] classified text which will take free form text and classify it into tags. This is a useful tool
[0:03:12] anytime you want to categorize human generated text in things like forms or surveys. The classified text
[0:03:18] block is used here as part of a larger workflow which we covered in our workflow's introduction video.
[0:03:24] For this video we're looking at this specific section down here where classified text is the
[0:03:29] first action block for condition three of the switch which is for when a workspace status
[0:03:34] is cancelled. During the cancellation process users will be asked to fill out a short form
[0:03:39] one of the questions is why they want to cancel. We add their answers to the workspace record and
[0:03:45] then use the classified text block to summarize it into tags. By storing these standardized churn
[0:03:50] reasons on each cancelled workspace our customer success and product teams can understand the
[0:03:55] most common causes for churn as they plan out retention programs and product write maps.
[0:04:00] The final AI block in this video is prompt completion which provides an LLM response to
[0:04:05] your custom prompt. Here is a workflow that is triggered when someone fills out an inquiry form
[0:04:10] on our website. It then creates or updates a person record using the email address that the person
[0:04:17] filling out the form provided and finally it adds that person to an inbound leads list.
[0:04:22] One of the questions in the type form is where are you based? We're not limited to a specific
[0:04:27] region and there are too many countries to list in drop downs or multiple choice options
[0:04:32] which leads to spelling or formatting errors and responses complicating data used for filtering
[0:04:37] views tracking lead sources or assigning them to the correct sales reps. To fix this we'll use
[0:04:42] the prompt completion block as a tool for data cleaning. I'm going to add the block here after
[0:04:48] the trigger and before the create or update record block. I need to add in a prompt and choose
[0:04:53] which variables the AI block should be taking into account. For this I will ask it to convert the
[0:04:58] type form answer to where are you based into an ISO country code and then I'll just quickly
[0:05:04] update the add record to list block to use this completion as the value for the country
[0:05:09] instead of the raw text that was provided in the type form. I have my type form here and I'm
[0:05:14] going to just quickly fill it out. I'm based in London so I'll provide that as my answer but
[0:05:20] this is not an ISO country code so the workflow will need to correct this. I'll submit now and
[0:05:25] head over to my inbound leads list. London is of course within the United Kingdom or Great Britain
[0:05:31] and the ISO country code is GB so we'll see the country attribute populating with that value as
[0:05:36] the workflow runs. So that's an overview of four out of five of our AI workflow blocks.
[0:05:42] Classify record, summarize record, classify text and prompt completion and don't forget
[0:05:47] to watch our research agent video to see how you can research anything on the web right
[0:05:51] inside your ATIA workflows.
```


---

## 21_AlLubYvPC0Y  (18 уник. кадров, 35 реплик)


Кадры: `docs/academy/21_AlLubYvPC0Y/frames/`

```
[0:00:00] Hey, it's Marissa from Atio and this video will show you how you can use loop and find blocks
[0:00:04] in Atio workflows. Loops allow you to take action on multiple records in bulk. In this first example,
[0:00:12] we have an upcoming marketing campaign where we'll be reaching out to specific customers selected
[0:00:16] by our go-to-market team about a new product launch. We want to make it as easy as possible
[0:00:21] for our team to add all of these associated members for a given company to a campaign.
[0:00:27] This workflow is triggered manually at the company level. A member of our go-to-market team can select
[0:00:32] a company record, run this workflow and it will add all of the associated team members to the list
[0:00:37] that we've created for the marketing campaign. So we start with record command for the company
[0:00:43] object as the trigger. Our next step is a loop. The first input is the iterable which represents
[0:00:50] the set of records that you want to loop through and take action on. In this case,
[0:00:55] the iterable is going to be the people associated with the company that the workflow has been triggered on
[0:01:00] or the team. So we'll select the record and then navigate to the team associated with that record.
[0:01:08] You can optionally set a limit if you want Atio to stop after a certain number of iterations.
[0:01:14] Now any blocks that occur within the loop or within this square will happen once for
[0:01:19] each record that the loop iterates over. In this case, the loop will take action on every
[0:01:24] person that is associated with that company. We want to add each team member to our marketing list.
[0:01:30] So within the loop, I'm going to click add first step and select the add record to list block.
[0:01:36] I'll select the list and for the record that we want to add, the variable is the current person
[0:01:41] Atio is iterating over in the loop. So the current team member. Now that I've
[0:01:46] published this workflow, it will become available to manually trigger on the company object.
[0:01:52] So I'm going to select a company, run the workflow, and now if I head to my list,
[0:02:02] I can see Atio is adding all of the people that are associated with that company.
[0:02:06] Another way to use a loop is in conjunction with a find block in order to iterate through
[0:02:11] records that meet certain criteria. In this example, we want to find all deals with tasks
[0:02:17] due in the next week and remind the team in Slack to get those tasks done. The first step in
[0:02:22] the workflow is a recurring schedule, which will kick off the workflow on a recurring basis,
[0:02:28] in this case, every Monday at midday. We've then got a find records block with the condition
[0:02:34] that the next due date for a task on that deal record is after today and before one week from
[0:02:39] now. So this will return all deal records that have a task due in the next week. There is a
[0:02:45] limit of 100 on the find block, meaning you will not be able to return more than 100 matching
[0:02:50] records. Once we found all of those deals that match the criteria, we'll iterate through that
[0:02:55] set of records, which is the matching deals and send a Slack message for each of them.
[0:03:00] If you don't use a loop block after a find block, then the action will only be performed on the
[0:03:05] first record that is returned. So those are the two most common ways to use loops and
[0:03:10] intervals to take bulk action on records in Attya.
```


---

## 22_-kFDZ1R3SEk  (11 уник. кадров, 45 реплик)


Кадры: `docs/academy/22_-kFDZ1R3SEk/frames/`

```
[0:00:00] Hey, it's Merge from Atio and in this video we'll look at our utility's workflow actions.
[0:00:05] We covered loops in our last video and now we'll be looking at sending HTTP requests to downstream
[0:00:10] systems and how you can convert JSON data that you've received into variables that can be used
[0:00:15] in Atio. Often you'll need to update other tools in your text stack to reflect changes that have
[0:00:20] happened in Atio or vice versa. HTTP requests, sometimes referred to as webhooks, are a widely
[0:00:27] used and flexible tool for sending data between software products. The HTTP request block lets
[0:00:33] you send requests to external tools, automating manual tasks and keeping your data in sync across
[0:00:39] your go-to-market stack. In this quick example, we want to update Intercom with a workspace's
[0:00:44] priority level which is stored in Atio anytime that data in Atio changes. So the trigger is
[0:00:51] record updated for workspaces and it's specifically on the priority attribute. In the HTTP block,
[0:00:58] you'll need to choose the appropriate method. Since I'm sending data to another server, I'm using
[0:01:03] post. Other options include delete to remove data, get to request data, head to request headers only,
[0:01:11] patch to modify specific parts of a data resource and put to replace existing data
[0:01:17] with the data that you're sending. The URL is the destination that you're sending the request to
[0:01:23] and you'll need to get this as well as the headers from the tool that you're sending the HTTP request
[0:01:27] to. I'm sending this to Intercom to update the tags and I've inserted my authorization
[0:01:33] and bearer and then I've used variables for the body. Again, you'll need to refer to
[0:01:37] your other tool for how to format the body. In this example, I'm using the workspace ID to be
[0:01:43] able to find the correct workspace in Intercom and then sending the priority level. Now let's work
[0:01:48] the other way around and create a workflow to receive data from another tool. In this case,
[0:01:53] a booking software that prospective customers use to book a product demo. This workflow is triggered
[0:01:59] by a webhook being received from an external source to this specific webhook URL. The webhook
[0:02:04] is sending data in JSON format which we need to pass into a set of variables to use in our
[0:02:10] workflow. To accomplish this, we need to use a pass JSON block which will allow you to translate
[0:02:15] JSON into a set of variables. I'll use a variable to add the webhook payload as the raw JSON string.
[0:02:21] Next, I need to populate the fields for the data that I want to extract. On this screen, I have
[0:02:26] an example of how this webhooks payload looks. So you have the paths on the left and then
[0:02:31] their values on the right. So now in Atio, for field one which is the name field, I will
[0:02:37] add name as the path and select string as the output type because it's a string of text.
[0:02:42] Your other options for output types are numbers and boolean which is true or false
[0:02:47] and then you also have the option of array which would be a list of either text or numbers.
[0:02:53] Finally, I'll give it an alias and the alias is to make it easier for you to identify what the
[0:02:58] data is at a later stage. If you don't add this, then you'll just see field one, field two
[0:03:03] and so on. I'll do the same now for field two which is email address, again choosing string
[0:03:10] and then adding the alias. And I'll do this for all of the relevant fields.
[0:03:16] Once the data has been passed, we can use it in later blocks. For this workflow, I want to
[0:03:21] create or update the person record and then associate them to a new deal record. So let's
[0:03:26] use the email address as the matching attribute and then use the name that they provided for
[0:03:31] the name on the record. Next, we will create a record for a deal. So we'll use the associated
[0:03:38] company's name for the name of the deal and we will add them to the contactor stage because
[0:03:42] a meeting has already been booked. Now I'm going to associate the person record that we created
[0:03:48] or updated one step prior and finally add in the notes from the booking software into the deal
[0:03:54] notes. Now that data that we saw on the payload body earlier can be stored in Atio.
[0:04:00] So that's an overview of how you can use Atio's utility blocks to send,
[0:04:04] receive and use data from other tools and platforms.
```


---

## 23_AHl29jbufUc  (14 уник. кадров, 110 реплик)


Кадры: `docs/academy/23_AHl29jbufUc/frames/`

```
[0:00:00] Hey, it's Maris from Atio.
[0:00:01] I'm going to show you the different integration action
[0:00:04] blocks that are available to use in our workflows.
[0:00:07] Atio has native integrations with Typeform, Slack, Outreach,
[0:00:11] Mixmax, and Mailchimp, and we've already
[0:00:13] covered how to send and receive data from other tools
[0:00:16] in our last video using a generic HTTP request.
[0:00:19] This first example uses two integration blocks
[0:00:22] as part of the onboarding process for new customers.
[0:00:25] Our customer success team works off
[0:00:26] of a list which is populated by a separate workflow
[0:00:30] with new workspaces that qualify for an onboarding session.
[0:00:33] The customer success team members will check this list
[0:00:36] and decide which new workspaces they
[0:00:37] will be responsible for training and helping
[0:00:40] implement their workspace setup.
[0:00:42] Once they've assigned themselves as the owner,
[0:00:44] they will then need to reach out to the team members
[0:00:46] or the users to book in an onboarding call.
[0:00:49] So the trigger is list entry command,
[0:00:51] meaning the customer success team member
[0:00:53] will manually trigger the workflow
[0:00:55] on specified list entries.
[0:00:57] For that list entry, we will loop through the associated users
[0:01:00] of the parent record, which is the workspace,
[0:01:03] and subsequently add them all one at a time
[0:01:05] to a Mixmax emailing sequence.
[0:01:08] We covered loops in detail in a previous video,
[0:01:10] so check that out for more information on how to use it.
[0:01:13] Before you can use the Mixmax block,
[0:01:15] an admin will need to set up the connection
[0:01:17] through your workspace settings.
[0:01:19] You then need to select the relevant connection and sequence
[0:01:22] and use variables to provide the user's email address and name.
[0:01:26] Mixmax is one of three emailing tools that we integrate with,
[0:01:29] and you can replicate similar workflows
[0:01:31] with the other two, Outreach and Mailchimp.
[0:01:35] The next block is the update list entry,
[0:01:38] and this is outside of the loop
[0:01:39] as we no longer need to loop through all of the users.
[0:01:43] We'll update the stage to show
[0:01:45] that we have reached out to offer a call
[0:01:47] and we'll also add the date
[0:01:48] that we added them to the Mixmax sequence.
[0:01:51] To ensure we're successfully connecting
[0:01:53] with every customer,
[0:01:54] the workflow then waits 10 days
[0:01:56] before confirming that the team booked a meeting
[0:01:58] with the customer.
[0:01:59] So if the status is still booking offered,
[0:02:02] we'll use another integration block,
[0:02:04] this time sending a message to a Slack channel
[0:02:06] to alert the relevant team member to follow up.
[0:02:09] Again, an admin will need to set up
[0:02:10] your Slack integration beforehand,
[0:02:12] and then you just need to choose
[0:02:14] the relevant workspace and channel
[0:02:16] before adding in your message and any variables.
[0:02:19] You can also format the message
[0:02:20] using Slack formatting guides.
[0:02:22] So for example, you can add asterisks for bold text
[0:02:25] and underscores for italic text.
[0:02:27] The next workflow uses a different Slack integration block
[0:02:30] which allows you to send actions to a Slack channel.
[0:02:33] Slack actions are essentially buttons
[0:02:35] that when clicked will kick off
[0:02:36] further actions within your workflow.
[0:02:39] Here is a workflow that is triggered
[0:02:40] when a new deal is created in the lead stage.
[0:02:44] In order to firstly bring this lead
[0:02:46] to the sales team's attention
[0:02:48] and secondly to ensure it's triage correctly,
[0:02:50] we're using variables to send key information
[0:02:53] about the deal and the company it's associated to.
[0:02:56] We're then inputting the action options.
[0:02:58] Here I have four, I have one to triage leads to Zev,
[0:03:03] one to triage leads to myself,
[0:03:05] one to mark leads as disqualified,
[0:03:07] and a final one to mark leads
[0:03:09] as already being in the pipeline.
[0:03:11] So this message will be sent to Slack
[0:03:13] and it will look something like this.
[0:03:19] And here you can see it has the body of the message
[0:03:21] and then a button for each of the action.
[0:03:24] Your Atio workflow will remain paused
[0:03:26] after the message has sent
[0:03:27] until someone selects one of the action options in Slack.
[0:03:31] If Zev or I click on our respective buttons,
[0:03:34] then the deal owner will be updated
[0:03:35] and the deal stage will be changed to contacted
[0:03:38] as the next action is adding that person
[0:03:40] into an email sequence to find out more information
[0:03:42] about their requirements and to book in a call.
[0:03:45] Leads that are marked as unqualified
[0:03:47] or in pipeline in Slack will have their deal stage updated
[0:03:50] to unqualified or duplicate in Atio
[0:03:53] and no further action will be taken from the sales team.
[0:03:56] Additionally, we have three integration triggers.
[0:03:59] Outreach triggers to trigger a workflow
[0:04:01] anytime a contact is added to a sequence
[0:04:04] or the state of a sequence is changed.
[0:04:07] And then a type form trigger to trigger a workflow
[0:04:09] anytime a new form response is received.
[0:04:12] We've run through examples of the type form trigger
[0:04:14] in our triggers video
[0:04:16] as well as the record and list and AI videos.
[0:04:19] And that's an overview of Atio's integration blocks
[0:04:22] which allow you to send messages or actions to Slack
[0:04:25] and add people to email sequences
[0:04:27] in outreach, Mixmax and Mailchimp.
```


---

## 24_CIvyaV6ByP8  (37 уник. кадров, 68 реплик)


Кадры: `docs/academy/24_CIvyaV6ByP8/frames/`

```
[0:00:00] Hey, it's Marisa from Atio. Today we're going to walk through the various records and list
[0:00:04] workflow blocks. These are some of the most common blocks that are used to modify and
[0:00:08] create data in your records or lists within Atio. We've run through the different record
[0:00:13] and list trigger blocks in a previous video so for this one we'll jump straight into the action
[0:00:17] blocks. For both records and lists there are workflow blocks for creating data, creating
[0:00:23] records including first checking to see if a record already exists and updating the existing
[0:00:28] one if it does, creating list entries, finding records or list entries, updating records or list
[0:00:35] entries and then also to delete list entries. We're going to start with a commonly used workflow as
[0:00:40] an example here that lets team members easily create a deal record related to a company.
[0:00:45] Let's say a sales rep has just finished a qualification call with a new potential customer
[0:00:50] and they want to go ahead and create a deal to begin tracking the sales process for that
[0:00:54] company. This workflow is going to be triggered on a company record so it's very easy when you're
[0:00:59] finishing up a call to go onto that company record and create a new deal as a follow-up from that
[0:01:04] call. The first thing that we'll do in this workflow is create a deal record so we'll choose
[0:01:09] a create record block. When creating a new record the first thing you'll want to choose
[0:01:15] is a type of object that you want to create in this case we're creating a deal. The variables
[0:01:20] for any create or update blocks will be all of the attributes associated with the object type
[0:01:25] or the list that you're creating or editing in. For this example we'll populate the relevant
[0:01:29] attributes for setting up a new deal. We'll give it a name for this I'll use a variable from the
[0:01:35] company that we triggered the workflow of and insert its name. I'll also add new business here
[0:01:40] so that we know what type of deal it is and this is a new deal so we'll add it to the
[0:01:45] qualification stage. Because this workflow is triggered by a record command block
[0:01:50] it must be manually triggered by a user. This means that one of the variables provided in these
[0:01:55] manually triggered workflows is triggered by and that will be the user who actually kicked off the
[0:02:00] workflow so we want to assign the owner of the steel to be that user and finally the associated
[0:02:06] company will be the company that we triggered the workflow on so I'm selecting record. For the
[0:02:11] next step in this workflow we'll show how to use the update record block in this case to update
[0:02:17] the company to reflect the fact that they are now in our pipeline. The object that we want to update
[0:02:22] is companies. Now that we are updating an existing record as opposed to creating a new one like we
[0:02:29] did earlier for the deal we need to select the record that we want to update. For this it is the
[0:02:34] company that the workflow was triggered on so record and then record again. In the update
[0:02:40] record block you can choose the specific attributes that you want to provide new values for. In this
[0:02:46] case the only thing that we're going to update is the company status attribute and now that we've
[0:02:50] created a deal for this company the value for this attribute is in pipeline. Let's publish this
[0:02:56] workflow and see it run. So I'm going to select a company to trigger the workflow on and clicking
[0:03:02] run the create deal from company workflow. Now if we head over to that company record page
[0:03:09] we can see a new business deal has been created and associated to the company
[0:03:13] and the company's new status is in pipeline. Another example we'll run through in this video
[0:03:19] is how to manage inbound leads from a form submission. This workflow is triggered when a
[0:03:24] type form is submitted. Type form is one of Atio's native integrations and to use the
[0:03:28] trigger block you'll need to set up your connection in the integrations tab of your workspace settings.
[0:03:34] The first step that we'll want to create for managing these inbound leads in Atio is to
[0:03:38] ensure that we have a record for the person who filled out the form. Since we don't know
[0:03:42] whether or not any person who fills out our form already exists in Atio we'll need to either create
[0:03:47] a new record or update an existing record. We'll select this block and use people as the object type.
[0:03:54] The create or update block requires a matching attribute which is a unique value that you'll
[0:03:58] use to look up whether a record already exists. In this case the form requires that the person
[0:04:04] provides an email address and so we will attempt to match it to the email address of an existing
[0:04:08] person in Atio. Now the email address that we're using will be the one that was provided in the form.
[0:04:14] Once we've either identified an existing person to update our record for or identified that there
[0:04:19] isn't a record and chosen to then create a new person record we can supply other attributes to
[0:04:25] populate with data. In addition to email address this form also asks for a person's name and phone
[0:04:32] number so we'll use variables to add these values to the relevant attributes. Now that
[0:04:37] we have a record for the person who filled out the form whether that's a new one we just created
[0:04:41] or an existing one that we updated we can go ahead and add that person to a list where we
[0:04:46] store all of our inbound leads. So we'll select the add record to list block and choose the list
[0:04:52] which is our inbound leads list. You'll first choose which record you want to add which in
[0:04:59] this case is the one from one step prior and now I'm going to populate the two attributes from
[0:05:05] my list which is the stage and the lead source. I'm using a fixed value for my stage and then for
[0:05:11] lead source I'm pulling in the answer from the how did you hear about us question on the form.
[0:05:17] Now let's test this workflow out. I'll grab a person that I know already exists in Atio
[0:05:23] and I'll show you what this update looks like. You'll notice that there is no phone number
[0:05:27] for this person currently. I'm taking this user's email address and we'll submit it to my form.
[0:05:35] Now I'll submit and head back to Atio. We can see that their phone number has now been populated
[0:05:41] and if we go over to our list we can see that they've been added to our inbound leads list with
[0:05:46] the lead source that was submitted on the type form. So that concludes our two examples in this
[0:05:51] video showing you how you can create new records or list entries and update existing ones in your
[0:05:56] work clothes.
```


---

## 25_YsW-VE4oOHA  (18 уник. кадров, 53 реплик)


Кадры: `docs/academy/25_YsW-VE4oOHA/frames/`

```
[0:00:00] Hi, this is Mress from Atio and in this video I'm going to show you how you can use our
[0:00:04] new Research Agent AI block in your workflows.
[0:00:07] The Research Agent block is our latest AI block.
[0:00:10] It allows you to select any record in your workspace and input a set of questions that
[0:00:14] the AI agent will then research for you.
[0:00:17] You can then go on to use that data in a variety of ways, whether that is to
[0:00:20] triage your inbound leads, add additional information to record attributes, set up
[0:00:25] follow-up tasks and actions, or send information to a downstream system.
[0:00:29] For this example, I've created a workflow that uses the Research Agent to gather
[0:00:33] more data about a newly created workspace and then to determine whether or
[0:00:37] not they fit into our ICP.
[0:00:39] I'm going to manually create a workspace here, although in a real-life scenario,
[0:00:42] this would be automatically done by a segment integration.
[0:00:54] Now that's been added in, the workflow has been triggered, and
[0:00:57] the Research Agent is working behind the scenes to fill out the two attributes
[0:01:01] about recent funding and the business model, and then off the back of this,
[0:01:04] it will determine whether or not that business is an ICP.
[0:01:08] Because this workspace has been classed as ICP, we've also created a deal for
[0:01:12] this new workspace and sent a message in Slack to alert our sales team.
[0:01:16] Let's navigate to the Automations tool to run through how you can create this
[0:01:20] workflow.
[0:01:22] To trigger this workflow, we're using record created on the workspace object.
[0:01:27] Next up is the Research Agent block.
[0:01:29] We've taken the associated company from the created workspace as the record,
[0:01:34] and then we've input two questions that relate to our ICP criteria.
[0:01:38] This is how much money, if any, have they raised from venture capitalists in the
[0:01:42] past five years, and what is their business model?
[0:01:45] The Research Agent will scrape the record, as well as the wider internet to
[0:01:48] answer these questions and return an answer.
[0:01:51] Now we're using classified text, another RAI blocks, to assess whether this
[0:01:55] company is ICP, agency or consultancy, investor, or other.
[0:02:02] I've added in the questions that were given in the previous block,
[0:02:05] and I've used variables to provide the agent's answers.
[0:02:08] I've also listed how our ICP is defined.
[0:02:11] Now off the back of this, this block will tag the workspace accordingly.
[0:02:17] The Update Record block will update the company type attribute that is on the
[0:02:21] workspace record to say whether it is ICP, agency and consultancy, investor, or
[0:02:26] other.
[0:02:28] We're now going to filter by ICP workspaces only.
[0:02:31] The reason for this is that we don't want any of the new ICP workspaces to
[0:02:35] be missed by our sales team.
[0:02:37] This filter means that for any non-ICP workspaces, the workflow will stop here.
[0:02:41] For ICP workspaces, on the other hand, they will continue through the
[0:02:44] workflow to the next blocks.
[0:02:46] We're using a round robin to go through our sales team, and then using
[0:02:49] Create Record to create a new deal record, pulling in data through variables
[0:02:54] and assigning the deal owner as the sales member that was selected in
[0:02:57] the round robin.
[0:02:58] And finally, we're using an integration block to send a message on Slack
[0:03:02] highlighting the new deal to the sales team member.
[0:03:05] That's an overview of the Research Agent block, which takes the power of AI
[0:03:09] and the context of the entire internet to help you make faster and
[0:03:12] better informed decisions at every stage of your sales process.
```


---

## 26_34VHoJRrQsw  (24 уник. кадров, 108 реплик)


Кадры: `docs/academy/26_34VHoJRrQsw/frames/`

```
[0:00:00] Hey, this is Maresh from Atio and this video is an introduction to workflows.
[0:00:05] Workflows let you automate your go-to-market tasks and processes in Atio as well as other tools in your go-to-market stack.
[0:00:11] This can be anything from simple Slack messages to researching and routing your leads.
[0:00:15] You can build fully automated workflows to help your team get their day-to-day tasks done more quickly and reliably.
[0:00:21] We'll start with a simple example that highlights some of the core concepts of the workflow builder
[0:00:25] and then we'll move on to a more advanced example at the end.
[0:00:28] The workflow tool has two key components. On the left you have the canvas where you will define the blocks and the path between the blocks
[0:00:35] and on the right-hand side you have the editor where you can manage each of these blocks.
[0:00:39] In this overview, we're going to cover four of the most popular types of blocks in Atio.
[0:00:44] You've got trigger blocks, logic blocks, action blocks and integration blocks.
[0:00:49] Every workflow in Atio starts with the trigger which determines the conditions in which the workflow is kicked off.
[0:00:55] In this particular example, we're creating a workflow to help new customers transition from sales to onboarding
[0:01:00] and this is done whenever a deal is moved to closed one.
[0:01:03] So we're using the record updated block as a trigger and we've selected the deals object and the deal stage attribute
[0:01:10] so that this workflow will be triggered any time a deal record has its stage updated.
[0:01:14] Other types of triggers include record commands which allow you to manually kick off the workflow,
[0:01:18] created and updated triggers for both lists and records
[0:01:22] and then the task trigger as well which is any time a task is created.
[0:01:25] There are also utility and integration triggers which help with some more advanced workflows.
[0:01:30] The second type of block in Atio are logic blocks and these are used to control the flow and the path of the workflow.
[0:01:37] In this case we're using a filter which is the simplest logic block and it determines whether or not
[0:01:41] a workflow will continue based on some set criteria.
[0:01:44] I said earlier that I want this workflow to run when a deal is moved into one
[0:01:48] but it's actually being triggered when a deal is moved into any stage.
[0:01:51] So we want to use a filter block to check that the new stage is one.
[0:01:56] You can see in the inputs that we have filter criteria for this block which uses variables.
[0:02:00] This is an important concept in workflows.
[0:02:02] We've selected the variable that we want to base this filter on which is the new value of the stage.
[0:02:08] In this case we only want the workflow to continue when that stage is one so I'm going to do new value is one.
[0:02:16] So now this workflow will only continue from this point onwards when a deal is moved into the one stage.
[0:02:21] For any other deal stage the workflow will stop here.
[0:02:23] There are other examples of logic blocks that you can choose from in Atio.
[0:02:27] First up you have the if else block which will give you two paths that your workflow can follow
[0:02:31] and you also have a switch block which has a flexible number of paths to determine
[0:02:35] which set of blocks to continue on with depending on multiple different groups of filter criteria.
[0:02:40] The next type of block is an action block which takes action or performs some set of
[0:02:44] step within Atio. In this example any time a deal is one we want to add the associated
[0:02:49] company into a list that our customer success team manages for onboarding new customers.
[0:02:55] So we're using the add record to list action block. For this particular block's inputs we're
[0:03:01] selecting the list that we want to add the record to which is the customer success list.
[0:03:07] Then selecting the record variable from the previous step that we want to add to the list.
[0:03:11] So in this case we want to use the company that's associated with the deal.
[0:03:16] We're also populating a handful of attributes that exist in a customer success list
[0:03:20] such as customer lifecycle stage and onboarding stage and for this we're just using fixed values.
[0:03:25] Other action blocks are available in Atio include creating a new record, updating existing records,
[0:03:31] finding records and then doing the same for lists. We also have action blocks for tasks.
[0:03:36] The last block that we're going to review in this quick overview are integration blocks.
[0:03:40] In addition to taking action in Atio workflows can also take action in downstream systems
[0:03:45] like other SaaS applications that your company uses. We're going to post a message on Slack to
[0:03:50] congratulate the team on the deal that was just won. We've already set up the integration between
[0:03:55] Atio and Slack which you can do in your account settings. For the inputs on this block we're
[0:04:00] simply selecting the workspace that we want to use and then the channel that we want to
[0:04:04] send the message to. And then we're defining the message that we want to send on the Slack
[0:04:08] channel. We can use variables to insert attributes from prior steps into these inputs.
[0:04:14] Variables will be displayed in the reverse order of which they came from. So the latest block will be
[0:04:18] listed first and the first block will be listed last. You can also see here how many blocks prior
[0:04:24] this specific variable came from. I'm going to click here to insert a variable into the text input
[0:04:29] box and then navigate to the particular variable that I want to use. So we are going to the
[0:04:34] record that was updated in the first block which was the deal that was moved to close one
[0:04:39] and I'm going to select the associated company's name. We're also going to add in the contract value
[0:04:45] of the deal. So let's see that workflow in action. I'm going to move this deal to one.
[0:04:58] If I go back to the workflow itself I can have a look at the runs which will show the workflow
[0:05:03] moving through the different blocks in live time and you can also use this retrospectively.
[0:05:08] Now let's head over to Slack and you can see I have had the announcement message come through
[0:05:13] and then finally I'll go back to Atio to check our customer success list
[0:05:17] where that new customer has been added. So these are the four steps of our workflow here,
[0:05:23] a trigger to define when to kick it off, a logic block to define whether the path continues,
[0:05:28] an action block to take action within Atio and an integration block to take action
[0:05:33] in downstream systems. Now that we've covered the basics of the Automations tool
[0:05:37] let's take a look at a more complex workflow using some more advanced blocks.
[0:05:41] Here we have a workflow for a PLG company whose customers can manage their subscriptions directly
[0:05:46] in the product. This workflow was built to alert internal teams and trigger customer success processes
[0:05:52] to help support and retain customers who've upgraded, downgraded or cancelled their plan.
[0:05:57] Atio's integration with segment is used to track app configuration and usage data in Atio
[0:06:03] users and workspace objects. This workflow is triggered when the MRR attribute in a workspace
[0:06:08] record is updated. To calculate the size and the direction of the MRR change we're using a
[0:06:13] formula block. This block allows you to perform mathematical operations on variables from prior
[0:06:18] blocks. In this example we are subtracting the previous value from the new value.
[0:06:24] We're then filtering to check that the result of the formula is not zero so there has either
[0:06:29] been an increase or a decrease in the MRR. A switch block operates similarly to the filter block
[0:06:35] that we saw earlier but it allows the workflow to follow different paths depending on which
[0:06:39] conditions are met. So here we have three conditions which means there are three possible paths.
[0:06:46] The first condition is that the result is greater than zero meaning that the customer
[0:06:49] increased the subscription. The second uses an advanced filter.
[0:06:53] Advanced filters in Atio let you build complex combinations or filter values using
[0:06:58] ANDs, ORs and by grouping filters together. Here we're using a simple AND. If the subscription
[0:07:04] change calculated in the formula block is less than zero and the workspace is still active
[0:07:09] the customer has downgraded their account. The third and the final condition is that
[0:07:14] the workspace status is cancelled. Once we've established these three paths in our workflow
[0:07:20] representing subscription increases decreases and cancellations we can add workflow blocks
[0:07:26] into each path to take the appropriate actions for each situation. Anytime a user
[0:07:30] increases their subscription Atio will post a message of the new MRR to a specified slack channel
[0:07:36] and it will also send an HTTP post request to a downstream system. In this case it's intercom
[0:07:43] and we'll be updating the MRR so that the support team have the correct information when speaking
[0:07:47] to that customer. For subscription decreases Atio will create a task and assign it to the
[0:07:52] relevant account manager prompting them to reach out and find out the cause of the
[0:07:56] downgrade and offer help to make sure the customer is getting the most out of their subscription.
[0:08:01] We've used an adjust time block here and this is taking the time that the workflow was triggered
[0:08:06] so when the attribute was first updated and offsetting this by two days. The reason for this
[0:08:11] is that we can now use this offset time as the due date for the task. When customers
[0:08:16] cancel their subscription we ask them for product feedback during the cancellation process.
[0:08:21] In the workflow path for cancellations we take that free text response and we categorize it
[0:08:25] using Atio's classify AI block. Updating the workspace cancellation reason attribute with these
[0:08:31] tags helps the product team to understand the most common reasons for churn. So that's an overview
[0:08:37] of Atio's automation tool. Workflows allow you to automate manual tasks and processes
[0:08:41] to increase efficiency and consistency across all stages of your customer life cycle.
[0:08:46] We also have a library of templates available for some of the most common
[0:08:49] use cases across different industries so be sure to check those out.
```


---

## 27_SXybVmcSfPA  (28 уник. кадров, 51 реплик)


Кадры: `docs/academy/27_SXybVmcSfPA/frames/`

```
[0:00:00] Hey, it's Mares from Atio. In this video, we're going to look at how you can collaborate with your colleagues and communicate with customers right from within Atio.
[0:00:07] We'll be looking at how you can leave comments, create tasks, write notes and send emails.
[0:00:13] The first tool we'll review for collaborating across your team is Comments.
[0:00:17] You can add comments in Atio to any record or list entry.
[0:00:20] In a comment, you can leave a quick note and optionally tag a colleague to notify them of your comment.
[0:00:25] They'll receive this notification in Atio and depending on their notification settings, they may also get an email.
[0:00:31] You will also receive notifications for any replies that you get to the comments you've left.
[0:00:36] Next, we'll talk about tasks.
[0:00:39] Tasks to let you assign to do's to yourself or to any of your colleagues.
[0:00:43] Instead of leaving a comment, I could instead create a task for my teammate to reach out to this company.
[0:00:48] I will add the task, put in a brief description, assign it to my colleague and then set the due date.
[0:00:55] You can associate tasks to any object type in Atio and you'll be able to see tasks for specific records in their task tab.
[0:01:02] You can view all tasks in the task page where you can filter for tasks assigned to you or to any of your colleagues.
[0:01:08] Here's a task for me to offer an onboarding call to a new customer, which is due in the next few days.
[0:01:13] So I will mark it as complete and head over to their record page to send them an email.
[0:01:18] This brings us to Atio's email tool.
[0:01:21] If you've connected your email inbox, you'll be able to quickly send emails from Atio
[0:01:25] and use the relationship stored in Atio to quickly get correspondence out to the key contacts on any record.
[0:01:31] Here, if I send an email on the company record, Atio lets me select the people that I would like to send the email to.
[0:01:37] I could send this email specifically to the person that's listed as the main point of contact.
[0:01:42] Or I can send an email to all of the people associated, which Atio calls the team.
[0:01:47] You can write emails from scratch or search your workspace's library of email templates.
[0:01:52] Here we've created an onboarding call template, which is complete with my booking link.
[0:01:56] I'll turn off mass send to put the whole team into one email thread
[0:02:00] and I'll hit send without ever having to switch browser tabs, copy email addresses,
[0:02:04] or remember which customer I need to email.
[0:02:07] In addition to sending single emails, you can also mass send emails from Atio
[0:02:11] to send customised emails to groups of people in one go.
[0:02:15] We're using this hiring list to manage the recruitment pipeline for an open role.
[0:02:19] Let's say I want to email all of the candidates that are currently in the screening stage
[0:02:23] to offer them an interview.
[0:02:25] I will select each of those candidate records and then send email.
[0:02:30] For emails or templates that are designed for individual emails,
[0:02:34] you can use attributes to customise the text that is sent to each recipient.
[0:02:38] So here Atio will find the first name of each person that we're emailing.
[0:02:42] You can create email templates by heading over to the email tab and selecting templates.
[0:02:48] You can insert into a template a variable for any attribute associated with a person
[0:02:53] or its associated objects, for example, their company name.
[0:02:58] The last productivity tool we'll cover today on notes.
[0:03:01] Atio notes are a central place for you to share and store prep, context,
[0:03:05] and notes across your team.
[0:03:07] You can create notes on any Atio record, although they're most commonly stored on the company level.
[0:03:12] You can optionally link notes to a meeting on your calendar,
[0:03:15] start a blank note from scratch, or use a workspace-wide template.
[0:03:19] Here we have a template that serves as a guide for running an effective onboarding meeting.
[0:03:23] Like emails, you can create new templates from the template section in the notes tab.
[0:03:28] And that's a high-level overview on some of Atio's productivity features,
[0:03:31] which allow you to quickly take action on the next steps in your processes.
[0:03:35] Whether that's reaching out to a colleague in a comment or a task,
[0:03:38] emailing a prospect to set up a next meeting,
[0:03:41] or just simply taking notes to follow up on later.
```


---

## 28_0WqSZGs3PUc  (25 уник. кадров, 50 реплик)


Кадры: `docs/academy/28_0WqSZGs3PUc/frames/`

```
[0:00:00] Hey, it's Merse from Atio. In this video, I'm going to show you how you can connect your
[0:00:03] inbox to get a complete overview of your interactions with your customers.
[0:00:07] When you first sign up to Atio, you'll be asked to sync your mailbox, which I highly
[0:00:11] recommend doing. If you haven't already done this, you can navigate to your account
[0:00:14] settings and set this up at any time. Once your email is connected and synced,
[0:00:19] you'll notice that Atio has pulled the status to populate the people and the
[0:00:22] company objects. The people object represents every person that you've ever emailed
[0:00:27] or had a meeting with in the past, and then you have the same for companies as well.
[0:00:30] When you click on to a record, you'll see your company's entire relationship history
[0:00:34] with that person, including events in the activity tab and emails in the email tab.
[0:00:38] Depending on the inbox sharing settings that you or your colleagues have set up,
[0:00:42] you'll either be able to see the full contents of the email, the subject line,
[0:00:46] and the recipients, or just the recipients. You can also grant full access to specific
[0:00:51] people or on a record level, and you can read more about our email sharing settings
[0:00:55] in the Help Center. On the right-hand side of the record page, you can view all of the attributes,
[0:01:01] so information like the name and email address has been pulled from the email sync,
[0:01:05] and there's also attributes like job title, social media handles, and location,
[0:01:10] which we have auto-enriched for you. These are the default attributes,
[0:01:14] but you can create and add your own custom attributes to track specific data points
[0:01:19] that are relevant to your business. We'll cover more of that in another video.
[0:01:23] Company records have also been created from the email domains,
[0:01:26] and through this, every person has been associated to the relevant company.
[0:01:30] This is called a relationship attribute, and we'll go into more detail about this in another
[0:01:34] video. If I click through to this associated company, you'll see it has a similar record
[0:01:39] overview experience. The activity and emails tab displays meetings and emails with anyone
[0:01:44] associated with this company, and you can also create notes, assign tasks,
[0:01:49] or upload files that are associated with that company.
[0:01:52] Ato enriches company records for thermographic data about company size,
[0:01:57] financials, industry, and location. Ato will summarize your communication history
[0:02:03] and communication intelligence attributes, so this will show you the strength and
[0:02:06] the recency of your communication with any company or person in your workspace.
[0:02:11] This is the default view for the company object, which shows you all of the companies
[0:02:15] within your workspace. You can create custom views to narrow this down to specific groups
[0:02:19] of companies. So let's say I'm launching a marketing campaign that is targeted at
[0:02:24] technology firms in the US. I'll create a new view for this using filters.
[0:02:29] So first up I will do category, contains, technology, and then a second filter for
[0:02:37] country is United States of America. I can also choose which attributes or which
[0:02:44] columns I want to display. So I'm going to remove some of the existing ones,
[0:02:49] and now I'm going to add in the primary location state.
[0:02:54] Because we have that relationship attribute set up between the companies and the associated people,
[0:02:59] we can actually drill into and display attributes from the people that are associated with this
[0:03:03] company. So I'm going to add in the team's email addresses. You can also choose how to sort
[0:03:11] your table by clicking here, choosing the attribute that you'd like to sort by,
[0:03:15] and whether you want it to be ascending or descending. Now I can save the changes to this
[0:03:21] view, or I can create a brand new view that my colleagues and I can access and collaborate on.
[0:03:26] So having only connected your inbox into Atio, you now have a central system of record
[0:03:31] for all of your historical communications. This information is shared across your team,
[0:03:36] along with simple tools for managing notes and tasks amongst the team.
[0:03:40] So that's an overview of the people and company objects and how you can create a
[0:03:43] central system of record for all of your historical communications just by syncing your mailbox.
```
