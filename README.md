# KDK Communication & Renewal Manager — Polished Response 1

A static GitHub Pages prototype for the KDK Licensing Communication & Renewal Manager.

## Included
- Rich communication dashboard and analytics
- Master Data (Mock) screen at the end of the navigation (demo-only audience source)
- Add Dummy Record workflow for mock subscriptions
- Campaign Manager with product, organisation type, start/end dates and send time
- Multiple renewal triggers plus custom trigger values
- WhatsApp + Email template mapping per trigger
- Template Master with separate WhatsApp and Email previews
- Dynamic New Template form for WhatsApp vs Email
- New Template flow starts with WhatsApp or Email, then offers Manual Entry or Import via cURL
- Manual Entry exposes the provider fields required for the selected channel
- Import via cURL auto-fills provider fields such as channel ID, API key, template name/key, category, language and sender information where available
- WhatsApp accepts approved-template send cURL only; creation/submission cURL is rejected
- Raw provider cURL is used only during template addition and is not displayed in Template Master
- Template creation includes message content and detected/addable variables
- Scheduler with execution dates, eligibility, stop schedule and scheduled-details actions
- Audit Logs / History with client-wise Details and CSV export
- Required-field validation and working modal close controls
- Safe dummy data only; no real APIs or credentials

GitHub Pages can publish static HTML/CSS/JavaScript directly from a repository. Keep `index.html` at the root of the publishing source.


### UI Refresh – Analytics/Product Dashboard
- Product-grade analytics dashboard inspired by modern SaaS analytics layouts.
- Added richer KPI cards, message activity chart, channel health, renewal trigger timeline, today's focus, recent campaign activity and audience snapshot.
- Refreshed header navigation, search treatment, cards, spacing, typography, hover states and responsive behavior.
- Existing campaign, template, scheduler, history and Subscription Master workflows remain connected to the same dummy data.

## Template Provider Configuration Update
- WhatsApp template creation now captures Sender ID, Rampwin Channel ID, Template Key, Category and Language.
- WhatsApp creation includes an auto-generated developer Send cURL matching the Rampwin send-template request structure.
- Existing WhatsApp templates expose provider metadata without displaying the raw cURL.
- Email template creation captures Sender ID / From Address, API Key, ZeptoMail Mail Agent, Template Key, Template Alias, Transactional category and Reply-To.
- Existing Email templates expose provider metadata without displaying the raw cURL.
- API keys and recipient numbers remain masked in the prototype; no live credentials are stored.

### Navigation / Mock Data UX Update
- Active navigation item is now visually larger with a stronger blue selected state.
- Master Data (Mock) is positioned last in the top navigation so it is clearly a demonstration data source, not a core communication module.
- Dashboard shortcuts and audience references use the Master Data (Mock) terminology.
