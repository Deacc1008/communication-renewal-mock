# KDK Communication & Renewal Manager — Final GitHub Build

This build retains the richer Response 1 dashboard and Template Master design and adds the requested functional workflows.

## Repository structure
```text
.nojekyll
README.md
index.html
assets/css/style.css
assets/js/app.js
data/dummy-data.js
```

## Included
- Communication Dashboard + analytics
- Create Campaign from Dashboard and Campaign Manager
- Product dropdown (All Products or a single product)
- Organisation Type dropdown: DIY / DIFM / Both
- Campaign Start Date and Send Time side-by-side
- Optional Campaign End Date for schedule expiry
- Predefined renewal triggers: 15, 7, 3, 1 days and Plan End Date
- Custom trigger values
- Dynamic Subscription Master eligibility
- Renewed customers excluded from later reminders
- Template Master with WhatsApp and Email tabs
- Email template list + email live preview
- Dynamic New Template form based on WhatsApp/Email selection
- Scheduler with execution dates, counts and Stop Schedule / View Details actions
- Expired schedules show View Scheduled Details and no next-action stop button
- History Details modal
- CSV export
- Prototype controls for simulation date and renewal demonstration

No live Rampwin/Meta/ZeptoMail API calls are made. Do not place real customer PII or API credentials in this public repository.
