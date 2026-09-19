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
- Provider cURL import for WhatsApp and Email templates
- WhatsApp accepts approved-template send cURL only; creation/submission cURL is rejected
- Imported provider cURL is retained with the template for developer reference
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
- Existing WhatsApp templates expose provider metadata and a Copy cURL action.
- Email template creation now captures Sender ID / From Address, ZeptoMail Mail Agent, Template Key, Template Alias, Transactional category and Reply-To.
- Existing Email templates expose provider metadata and a ZeptoMail API mapping preview.
- API keys and recipient numbers remain masked in the prototype; no live credentials are stored.

### Navigation / Mock Data UX Update
- Active navigation item is now visually larger with a stronger blue selected state.
- Master Data (Mock) is positioned last in the top navigation so it is clearly a demonstration data source, not a core communication module.
- Dashboard shortcuts and audience references use the Master Data (Mock) terminology.


### Latest Template Addition Flow
- New Template supports **Manual Addition** or **Import using cURL**.
- WhatsApp cURL import reads Rampwin Channel ID, API Key, Template Key, Language and Category automatically.
- WhatsApp registration is restricted to provider/Meta-approved templates; manual mode requires an approval confirmation.
- Provider cURL is used only during addition/import and is not displayed in Template Master after saving.
- Template Master displays provider metadata (with API key masked) and the message preview, not the raw cURL.
