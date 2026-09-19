(function(){
"use strict";
const DB = window.DB;
DB.view = DB.view || "dashboard";
DB.modal = null;
DB.toast = "";
DB.msg = DB.msg || [];
DB.customTriggers = DB.customTriggers || {};
DB.TODAY = DB.TODAY || "2026-09-17";
DB.subs.forEach((s,i)=>{ s.organisationType = s.organisationType || (i%3===0?"DIY":i%3===1?"DIFM":"Both"); });
DB.campaigns.forEach((c,i)=>{
  c.startDate = c.startDate || DB.TODAY;
  c.endDate = c.endDate || add(DB.TODAY, 45);
  c.organisationType = c.organisationType || "Both";
  c.status = c.status || "Scheduled";
});
DB.templateType = DB.templateType || "WhatsApp";

function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
function D(s){return new Date(s+"T00:00:00Z");}
function days(a,b){return Math.round((D(b)-D(a))/86400000);}
function add(s,n){let d=D(s);d.setUTCDate(d.getUTCDate()+Number(n));return d.toISOString().slice(0,10);}
function fmt(s){return D(s).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});}
function nav(v){DB.view=v;DB.modal=null;render();}
function toast(x){DB.toast=x;render();setTimeout(()=>{DB.toast="";render()},2100);}
function eligible(s,t,c){
  return s.status==="Active" && !s.renewed &&
    c.products.includes(s.product) &&
    (c.organisationType==="Both" || c.organisationType===s.organisationType) &&
    days(DB.TODAY,s.end)===Number(t);
}
function activeEligible(c){
  return DB.subs.filter(s=>s.status==="Active"&&!s.renewed&&
    c.products.includes(s.product)&&
    (c.organisationType==="Both"||c.organisationType===s.organisationType));
}
function triggerLabel(t){return Number(t)===0?"On Plan End Date":Number(t)+" Days Before Expiry";}
function campaignTriggers(c){return [...new Set((c.triggers||[]).map(Number))].sort((a,b)=>b-a);}
function templateFor(c,ch,trigger,product){
  const key=Number(trigger)+"|"+ch;
  const mapped=c.templateMap&&c.templateMap[key];
  if(mapped){const m=DB.templates.find(t=>Number(t.id)===Number(mapped)&&t.type===ch);if(m)return m;}
  return DB.templates.find(t=>t.type===ch&&t.product===product) || DB.templates.find(t=>t.type===ch&&c.products.includes(t.product)) || DB.templates.find(t=>t.type===ch);
}
function templateName(c,ch,trigger,product){const t=templateFor(c,ch,trigger,product);return t?t.name:"Not configured";}
function ensureTemplateMap(c){
  c.templateMap=c.templateMap||{};
  campaignTriggers(c).forEach(t=>c.channels.forEach(ch=>{
    const key=Number(t)+"|"+ch;
    if(!c.templateMap[key]){const product=c.products.length===1?c.products[0]:c.products[0];const m=templateFor(c,ch,t,product);if(m)c.templateMap[key]=m.id;}
  }));
}
function scheduleRows(){
  const out=[];
  DB.campaigns.forEach(c=>{
    const start=c.startDate||DB.TODAY, end=c.endDate||add(start,45);
    const expired=end<DB.TODAY || c.status==="Expired";
    c.isExpired=expired;
    if(expired||c.status==="Paused") return;
    ensureTemplateMap(c);
    campaignTriggers(c).forEach(t=>DB.subs.forEach(s=>{
      if(!c.products.includes(s.product)||s.status!=="Active"||s.renewed)return;
      if(c.organisationType!=="Both"&&s.organisationType!==c.organisationType)return;
      const execution=add(s.end,-Number(t));
      if(execution>=start&&execution<=end&&execution>=DB.TODAY)out.push({d:execution,t,c,s});
    }));
  });
  const grouped={};
  out.forEach(r=>{const key=r.d+"|"+r.t+"|"+r.c.id;if(!grouped[key])grouped[key]={d:r.d,t:r.t,c:r.c,s:[]};grouped[key].s.push(r.s);});
  return Object.values(grouped).sort((a,b)=>a.d.localeCompare(b.d)||b.t-a.t);
}
function schedule(){
  let r=scheduleRows();
  return `<table class="table"><tr><th>Date</th><th>Trigger</th><th>Eligible</th><th>Channels</th></tr>`+
  (r.slice(0,8).map(x=>`<tr><td>${fmt(x.d)}</td><td><span class="badge b">${triggerLabel(x.t)}</span></td><td><b>${x.s.length}</b></td><td>${x.c.channels.join(" + ")}</td></tr>`).join("")||`<tr><td colspan="4" class="muted" style="padding:25px;text-align:center">No upcoming executions in the next 45 days.</td></tr>`)+
  `</table>`;
}
function Header(){
  const items=[['dashboard','⌂','Dashboard'],['templates','✦','Templates'],['campaigns','◈','Campaigns'],['scheduler','◷','Scheduler'],['history','↗','History'],['subscriptions','▤','Master Data (Mock)']];
  return `<header class="hdr"><div class="brand"><div class="logo">K</div><div class="brand-copy"><b>KDK</b><span>Communication Manager</span></div></div><nav class="nav">${items.map(x=>`<button class="${DB.view===x[0]?"on":""}" onclick="nav('${x[0]}')"><i>${x[1]}</i><span>${x[2]}</span></button>`).join("")}</nav><div class="hdr-tools"><div class="global-search"><span>⌕</span><input placeholder="Search campaigns, clients..." aria-label="Search"></div><button class="icon-btn" title="Notifications">♧<em></em></button><button class="avatar" title="User profile">DK</button></div></header>`;
}
function Dash(){
  const active=DB.subs.filter(s=>s.status==="Active"&&!s.renewed).length;
  const exp=DB.subs.filter(s=>s.status==="Active"&&!s.renewed&&days(DB.TODAY,s.end)>=0&&days(DB.TODAY,s.end)<=7).length;
  const triggered=284+DB.msg.length;
  const renewals=38+DB.subs.filter(s=>s.renewed).length;
  const wa=DB.subs.filter(s=>s.waOpt).length, em=DB.subs.filter(s=>s.emailOpt).length;
  const todayRows=scheduleRows().filter(x=>x.d===DB.TODAY);
  const todayEligible=todayRows.reduce((n,x)=>n+x.s.length,0);
  const recent=historyRecords().slice(0,5);
  const monthVals=[52,61,48,72,67,84,78,91], labels=['Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const max=Math.max(...monthVals), min=Math.min(...monthVals);
  const pts=monthVals.map((v,i)=>`${30+i*54},${122-((v-min)/(max-min))*78}`).join(' ');
  const area=`30,122 ${pts} 408,122`;
  return `<div class="crumb">KDK Licensing Application <span>/</span> Communication Manager</div>
  <div class="dash-hero"><div><div class="eyebrow">COMMUNICATION CONTROL CENTRE</div><h1>Good morning, Team <span>👋</span></h1><p>Monitor renewals, message performance and upcoming customer touchpoints from one place.</p></div><div class="dash-actions"><button class="btn soft" onclick="nav('subscriptions')">▤ Master Data (Mock)</button><button class="btn primary" onclick="openCamp()">＋ Create Campaign</button></div></div>

  <div class="dashboard-kpis">
    <div class="dash-kpi accent-violet"><div class="kpi-top"><span>Active subscriptions</span><b>↗</b></div><strong>${active}</strong><small><span class="trend up">+8.4%</span> vs last cycle</small><div class="kpi-spark">${[35,45,31,55,48,68,60,78].map(v=>`<i style="height:${v}%"></i>`).join('')}</div></div>
    <div class="dash-kpi accent-orange"><div class="kpi-top"><span>Expiring in 7 days</span><b>!</b></div><strong>${exp}</strong><small><span class="trend warn">Needs attention</span> current audience</small><div class="mini-pills"><i>${Math.max(0,Math.round(exp*.58))} WhatsApp</i><i>${Math.max(0,Math.round(exp*.42))} Email</i></div></div>
    <div class="dash-kpi accent-pink"><div class="kpi-top"><span>Messages triggered</span><b>↗</b></div><strong>${triggered.toLocaleString()}</strong><small><span class="trend up">96.4%</span> provider delivery</small><div class="kpi-progress"><i style="width:96.4%"></i></div></div>
    <div class="dash-kpi accent-blue"><div class="kpi-top"><span>Renewals attributed</span><b>✓</b></div><strong>${renewals}</strong><small><span class="trend up">+12</span> this cycle</small><div class="renew-ring"><span>${Math.round((renewals/Math.max(1,active+renewals))*100)}%</span></div></div>
  </div>

  <div class="dash-grid-main">
    <section class="card analytics-card"><div class="dash-section-head"><div><h3>Message activity</h3><p>Triggered messages across WhatsApp and Email</p></div><div class="period"><button class="active">7D</button><button>30D</button><button>90D</button></div></div>
      <div class="legend"><span><i class="dot violet"></i>WhatsApp</span><span><i class="dot pink"></i>Email</span><span class="legend-note">Live demo data</span></div>
      <div class="line-chart"><div class="y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><svg viewBox="0 0 438 150" preserveAspectRatio="none" aria-label="Message activity chart"><defs><linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c63ff" stop-opacity=".22"/><stop offset="1" stop-color="#6c63ff" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#msgFill)"/><polyline points="${pts}" fill="none" stroke="#665cf4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polyline points="30,112 84,102 138,108 192,94 246,98 300,88 354,96 408,82" fill="none" stroke="#ef6b9b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 4"/>${monthVals.map((v,i)=>`<circle cx="${30+i*54}" cy="${122-((v-min)/(max-min))*78}" r="3.5" fill="#fff" stroke="#665cf4" stroke-width="2"/>`).join('')}</svg></div><div class="x-labels">${labels.map(x=>`<span>${x}</span>`).join('')}</div>
    </section>
    <section class="card channel-card"><div class="dash-section-head"><div><h3>Channel health</h3><p>Current communication readiness</p></div><button class="more">•••</button></div><div class="channel-visual"><div class="donut"><div><strong>${Math.round((wa+em)/Math.max(1,DB.subs.length)*100)}%</strong><span>Opt-in</span></div></div><div class="channel-legend"><div><span><i class="channel-dot wa"></i>WhatsApp</span><b>${wa}</b></div><div><span><i class="channel-dot mail"></i>Email</span><b>${em}</b></div><div><span><i class="channel-dot muted-dot"></i>No opt-in</span><b>${Math.max(0,DB.subs.length-Math.max(wa,em))}</b></div></div></div><div class="health-footer"><span><i class="status-dot"></i> Providers connected</span><button onclick="nav('templates')">Manage templates →</button></div></section>
  </div>

  <div class="dash-grid-lower">
    <section class="card panel upcoming-card"><div class="dash-section-head"><div><h3>Upcoming renewal triggers</h3><p>Calculated against each subscription's Plan End Date</p></div><button class="btn soft small" onclick="nav('scheduler')">Open Scheduler →</button></div>${scheduleRows().slice(0,5).map(x=>`<div class="trigger-row"><div class="date-box"><b>${D(x.d).toLocaleDateString('en-IN',{day:'2-digit',timeZone:'UTC'})}</b><span>${D(x.d).toLocaleDateString('en-IN',{month:'short',timeZone:'UTC'})}</span></div><div class="trigger-copy"><b>${esc(x.c.name)}</b><span>${triggerLabel(x.t)} · ${x.c.channels.join(' + ')}</span></div><div class="trigger-count"><strong>${x.s.length}</strong><span>eligible</span></div><span class="badge ${x.d===DB.TODAY?'a':'b'}">${x.d===DB.TODAY?'Due today':'Scheduled'}</span></div>`).join('')||`<div class="empty-state">No upcoming trigger executions.</div>`}</section>
    <section class="card panel focus-card"><div class="dash-section-head"><div><h3>Today's focus</h3><p>What needs attention now</p></div><span class="focus-icon">✦</span></div><div class="focus-big"><strong>${todayEligible}</strong><span>subscriptions eligible today</span></div><div class="focus-item"><span class="focus-check">✓</span><div><b>${todayRows.length} trigger group${todayRows.length===1?'':'s'}</b><small>ready in Scheduler</small></div></div><div class="focus-item"><span class="focus-check">↗</span><div><b>${DB.templates.length} active templates</b><small>WhatsApp + Email mapping available</small></div></div><button class="focus-cta" onclick="nav('scheduler')">Review today's execution →</button></section>
  </div>

  <div class="dash-grid-bottom"><section class="card panel activity-card"><div class="dash-section-head"><div><h3>Recent campaign activity</h3><p>Latest execution records</p></div><button class="btn soft small" onclick="nav('history')">View history →</button></div><div class="activity-list">${recent.map(x=>`<div class="activity-row"><div class="activity-icon ${x.ch==='WhatsApp'?'wa-bg':'mail-bg'}">${x.ch==='WhatsApp'?'◉':'✉'}</div><div class="activity-main"><b>${esc(x.c)}</b><span>${x.ch} · ${x.n} recipients · ${esc(x.d)}</span></div><div class="activity-status"><b>${x.delivered}/${x.n}</b><span>delivered</span></div><span class="badge ${x.execStatus==='Stopped'?'gray':'g'}">${x.execStatus}</span></div>`).join('')}</div></section><section class="card panel audience-card"><div class="dash-section-head"><div><h3>Audience snapshot</h3><p>Source: Master Data (Mock)</p></div><button class="more">•••</button></div><div class="audience-stat"><strong>${DB.subs.length}</strong><span>Total subscriptions</span></div>${[['Spectrum','Spectrum'],['ExpressGST','ExpressGST'],['ZenTDS','ZenTDS'],['PDF Signer','PDF Signer']].map(([n,p])=>{let c=DB.subs.filter(s=>s.product===p).length;return `<div class="audience-line"><span>${n}</span><div><i style="width:${Math.round(c/Math.max(1,DB.subs.length)*100)}%"></i></div><b>${c}</b></div>`}).join('')}<button class="audience-cta" onclick="nav('subscriptions')">Open Master Data (Mock)</button></section></div>`;
}
function waCurl(t){
 if(t.providerCurl && /rampwin\.com\/api\/messages\/send/i.test(t.providerCurl)) return t.providerCurl;
 const channel=t.channelId||"694332facf4bde9d4ba8616e5";
 const name=t.templateKey||t.name||"renewal_7_days";
 const lang=t.languageCode||"en";
 const cat=t.category||"UTILITY";
 return `curl --location 'https://api.rampwin.com/api/messages/send?dontShowInChatList=false' \\\n  --header 'X-API-Key: xxxxxxxxxx' \\\n  --header 'Content-Type: application/json' \\\n  --data '{"channel_id":"${channel}","phone_number":"91xxxxxxxxxx","hide_from_chat":false,"template":{"name":"${name}","language":{"policy":"deterministic","code":"${lang}"},"category":"${cat}"}}'`;
}
function copyTemplateCurl(){
 const t=DB.templates.find(x=>Number(x.id)===Number(DB.template)); if(!t)return;
 const value=waCurl(t);
 if(navigator.clipboard){navigator.clipboard.writeText(value).then(()=>toast("WhatsApp cURL copied to clipboard."));}else{toast("cURL is ready in the developer section below.");}
}
function templateMeta(t){
 return t.type==="WhatsApp"
 ? `<div class="meta-grid"><div><span>Approval Status</span><b><span class="badge g">Approved</span></b></div><div><span>Sender ID</span><b>${esc(t.senderId||"KDK WhatsApp")}</b></div><div><span>Channel ID</span><b class="mono">${esc(t.channelId||"694332facf4bde9d4ba8616e5")}</b></div><div><span>Template Key</span><b class="mono">${esc(t.templateKey||t.name)}</b></div><div><span>Category</span><b><span class="badge a">${esc(t.category||"UTILITY")}</span></b></div><div><span>Language</span><b>${esc(t.languageCode||"en")}</b></div><div><span>Provider</span><b>Rampwin → Meta</b></div></div>`
 : `<div class="meta-grid"><div><span>Sender ID</span><b>${esc(t.senderId||"KDK Support")}</b></div><div><span>Mail Agent</span><b>${esc(t.mailAgent||"KDK Transactional")}</b></div><div><span>Template Key</span><b class="mono">${esc(t.templateKey||"Generated on provider")}</b></div><div><span>Template Alias</span><b class="mono">${esc(t.templateAlias||t.name)}</b></div><div><span>Category</span><b><span class="badge b">Transactional</span></b></div><div><span>Provider</span><b>ZeptoMail</b></div></div>`;
}
function Templates(){
  const type=DB.templateType||"WhatsApp",list=DB.templates.filter(x=>x.type===type);
  let t=DB.templates.find(x=>x.id===DB.template&&x.type===type)||list[0]; if(t)DB.template=t.id;
  if(!t)return `<div class="crumb">KDK Licensing Application / Communication / Templates</div><div class="head"><div><h1>Template Master</h1><p>No provider templates found.</p></div><button class="btn primary" onclick="openTemplate()">＋ New Template</button></div>`;
  const preview=type==="WhatsApp"?`<div class="phone"><div class="phonehead">${esc(t.senderId||"KDK WhatsApp")}</div><div class="bubble">${esc(t.text||"").replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,t.product).replace(/{{3}}/g,"23 Sep 2026").replace(/{{4}}/g,"7")}</div></div>`:`<div class="email-preview"><div class="mail-head"><b>${esc(t.subject||"Renewal reminder")}</b><span>From: ${esc(t.senderId||"KDK Support")}</span><span>To: customer@example.com</span></div><div class="mail-body">${esc(t.text||"").replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,t.product).replace(/{{3}}/g,"25 Sep 2026").replace(/{{4}}/g,"7")}</div></div>`;
  return `<div class="crumb">KDK Licensing Application / Communication / Templates</div><div class="head"><div><h1>Template Master</h1><p>Provider-ready communication templates with developer/API metadata.</p></div><button class="btn primary" onclick="openTemplate()">＋ New Template</button></div>
  <div class="tabs"><button class="${type==="WhatsApp"?"on":""}" onclick="setTemplateType('WhatsApp')">WhatsApp Templates</button><button class="${type==="Email"?"on":""}" onclick="setTemplateType('Email')">Email Templates</button></div>
  <div class="layout"><section class="card list"><input class="search" placeholder="Search templates..." oninput="filter(this.value)"><div id="items">${list.map(x=>`<div class="item ${x.id===t.id?"sel":""}" onclick="selectTemplate(${x.id})"><b>${esc(x.name)}</b><small>${esc(x.product)} · <span class="badge g">Approved</span></small></div>`).join("")}</div></section>
  <section class="card editor"><div class="title"><div><h3>${esc(t.name)}</h3><span class="muted">${esc(t.product)} · <span class="status-dot"></span> Approved</span></div>${type==="WhatsApp"?`<button class="btn small" onclick="copyTemplateCurl()">Copy cURL</button>`:""}</div>
  ${templateMeta(t)}
  <div class="field"><label>Template Name</label><input value="${esc(t.name)}"></div>${type==="Email"?`<div class="field"><label>Email Subject</label><input value="${esc(t.subject||"")}"></div>`:""}<div class="field"><label>Content</label><textarea style="width:100%;min-height:125px">${esc(t.text||"")}</textarea></div>
  ${type==="WhatsApp"?`<div class="developer-card"><div class="dev-head"><div><b>Developer Send cURL</b><span>${t.providerCurl?"Original provider cURL":"Generated from Channel ID + Template Key"}</span></div><button class="btn small" onclick="copyTemplateCurl()">Copy</button></div><pre>${esc(waCurl(t))}</pre><div class="help">API key and recipient number are masked in this prototype. Rampwin's documented send-template flow uses the channel ID and approved template details in the request. <a href="https://rampwin-api.readme.io/reference/sending-template" target="_blank" rel="noreferrer">View Rampwin API reference</a></div></div>`:`<div class="developer-card"><div class="dev-head"><div><b>ZeptoMail Provider cURL</b><span>${t.providerCurl?"Original provider cURL stored with this template":"API mapping preview"}</span></div><button class="btn small" onclick="copyStoredCurl()">Copy</button></div><pre>${esc(t.providerCurl||`POST https://api.zeptomail.com/v1.1/email/template\nAuthorization: Zoho-enczapikey xxxxxxxxxx\nContent-Type: application/json\n\n{"from":{"address":"${t.senderId||"support@kdksoftware.com"}"},"template_key":"${t.templateKey||"TEMPLATE_KEY"}","to":[{"email_address":{"address":"customer@example.com"}}]}`)}</pre><div class="help">ZeptoMail supports sending a pre-created template using either template_key or template_alias. <a href="https://www.zoho.com/zeptomail/help/api/email-templates.html" target="_blank" rel="noreferrer">View ZeptoMail API reference</a></div></div>`}
  <div class="developer-note"><span>⌘</span><div><b>Original Provider cURL</b><small>The cURL stored with this template is the source used to add/map this provider template.</small></div></div>${t.providerCurl?`<div class="developer-card stored-curl"><div class="dev-head"><div><b>${type==="WhatsApp"?"Rampwin":"ZeptoMail"} Provider cURL</b><span>Stored from provider configuration</span></div><button class="btn small" onclick="copyStoredCurl()">Copy</button></div><pre id="storedProviderCurl">${esc(t.providerCurl)}</pre></div>`:""}
  <div class="callout"><b>Provider:</b> ${type==="WhatsApp"?"Rampwin API → Meta approved WhatsApp template":"ZeptoMail → Transactional email template"}<br><span class="muted">Provider callbacks and delivery are simulated in this prototype.</span></div></section>
  <aside class="card preview"><div class="title"><h3>Live Preview</h3><span class="provider-pill">${type}</span></div>${preview}</aside></div>`;
}
function copyStoredCurl(){const t=DB.templates.find(x=>Number(x.id)===Number(DB.template));if(!t?.providerCurl){toast("No provider cURL stored.");return;}if(navigator.clipboard){navigator.clipboard.writeText(t.providerCurl).then(()=>toast("Provider cURL copied to clipboard."));}else{toast("Copy is unavailable in this browser.");}}
function normaliseSubs(){DB.subs.forEach((x,i)=>{if(!x.orgType)x.orgType=["DIY","DIFM","Both"][i%3];if(!x.mobile)x.mobile="+91 98"+String(10000000+i).slice(-8);});}
function SubscriptionMaster(){normaliseSubs();const q=(DB.subQ||"").toLowerCase();const rows=DB.subs.filter(s=>[s.name,s.product,s.plan,s.email,s.orgType,s.status].join(" ").toLowerCase().includes(q));return `<div class="crumb">KDK Licensing Application / Master Data (Mock)</div><div class="head"><div><div class="eyebrow">DEMO ONLY · NOT CUSTOMER MASTER</div><h1>Master Data (Mock)</h1><p>Dummy subscription data used only to demonstrate campaign eligibility and renewal flows.</p></div><div class="inline-actions"><button class="btn" onclick="openAddSub()">＋ Add Dummy Record</button><button class="btn primary" onclick="nav('campaigns')">Create Campaign</button></div></div><section class="card panel"><div class="input-row"><div class="field"><label>Search</label><input class="search" value="${esc(DB.subQ||"")}" placeholder="Search client, product, plan, email..." oninput="DB.subQ=this.value;render()"></div><div class="field"><label>Demo data</label><div class="help" style="padding-top:10px">Add fake subscriptions, mark renewals, and demonstrate eligibility changes without using real customer data.</div></div></div><div style="overflow:auto"><table class="table"><tr><th>Customer</th><th>Product / Plan</th><th>Organisation</th><th>Plan End Date</th><th>WhatsApp</th><th>Email</th><th>Status</th><th>Action</th></tr>${rows.map(s=>`<tr><td><b>${esc(s.name)}</b><div class="muted">${esc(s.email)}</div></td><td>${esc(s.product)}<div class="muted">${esc(s.plan)}</div></td><td><span class="badge b">${esc(s.orgType)}</span></td><td>${fmt(s.end)}</td><td>${s.waOpt?"<span class='badge g'>Opted-in</span>":"<span class='badge gray'>No</span>"}</td><td>${s.emailOpt?"<span class='badge g'>Opted-in</span>":"<span class='badge gray'>No</span>"}</td><td><span class="badge ${s.status==="Active"?"g":s.status==="Renewed"?"b":"gray"}">${esc(s.status)}</span></td><td>${s.status==="Active"&&!s.renewed?`<button class="btn small" onclick="renew(${s.id})">Mark Renewed</button>`:`<span class="muted">No action</span>`}</td></tr>`).join("")}</table></div><div class="help">Demo-only placeholder data. This is demo-only audience source data, not a separate Customer/Contacts Master.</div></section>`;}
function openAddSub(){DB.modal={addSub:1};render();}
function addSubModal(){return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Add Demo Subscription</h2><p>Create a fake record to demonstrate campaign eligibility.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div><div class="input-row"><div class="field"><label>Customer Name *</label><input id="dn" required placeholder="e.g. Demo Client"></div><div class="field"><label>Mobile *</label><input id="dm" required placeholder="+91 9876543210"></div></div><div class="input-row"><div class="field"><label>Email *</label><input id="de" type="email" required placeholder="demo@example.com"></div><div class="field"><label>Organisation Type *</label><select id="do"><option>DIY</option><option>DIFM</option><option>Both</option></select></div></div><div class="input-row"><div class="field"><label>Product *</label><select id="dp">${products().map(x=>`<option>${x}</option>`).join("")}</select></div><div class="field"><label>Plan</label><input id="dplan" value="Demo Professional"></div></div><div class="input-row"><div class="field"><label>Plan Start Date *</label><input id="ds" type="date" required value="${DB.TODAY}"></div><div class="field"><label>Plan End Date *</label><input id="dend" type="date" required value="${add(DB.TODAY,7)}"></div></div><div class="field"><label>Communication Consent</label><div class="channels"><label class="channel on"><input id="dwa" type="checkbox" checked> WhatsApp Opt-in</label><label class="channel on"><input id="dem" type="checkbox" checked> Email Opt-in</label></div></div><div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveDemoSub()">Add Subscription</button></div></div></div>`;}
function saveDemoSub(){const n=document.getElementById("dn"),m=document.getElementById("dm"),e=document.getElementById("de"),s=document.getElementById("ds"),en=document.getElementById("dend");if(!n.value.trim()){n.setCustomValidity("Customer Name is required.");n.reportValidity();return;}if(!m.value.trim()){m.setCustomValidity("Mobile is required.");m.reportValidity();return;}if(!e.value.trim()){e.setCustomValidity("Email is required.");e.reportValidity();return;}if(!s.value){s.setCustomValidity("Plan Start Date is required.");s.reportValidity();return;}if(!en.value){en.setCustomValidity("Plan End Date is required.");en.reportValidity();return;}if(en.value<s.value){en.setCustomValidity("Plan End Date cannot be before Plan Start Date.");en.reportValidity();return;}DB.subs.push({id:Date.now(),name:n.value.trim(),mobile:m.value.trim(),email:e.value.trim(),orgType:document.getElementById("do").value,product:document.getElementById("dp").value,plan:document.getElementById("dplan").value||"Demo Professional",start:s.value,end:en.value,status:"Active",renewed:false,waOpt:document.getElementById("dwa").checked,emailOpt:document.getElementById("dem").checked});DB.modal=null;DB.view="subscriptions";toast("Demo dummy record added to Master Data (Mock).");}
function Campaigns(){
  return `<div class="crumb">KDK Licensing Application / Communication / Campaigns</div><div class="head"><div><h1>Campaign Manager</h1><p>One renewal campaign with multiple Plan End Date trigger points and message mapping.</p></div><button class="btn primary" onclick="openCamp()">＋ Create Campaign</button></div>
  <section class="card panel"><table class="table"><tr><th>Campaign</th><th>Start Date</th><th>Audience</th><th>Triggers</th><th>WhatsApp Template</th><th>Email Template</th><th>Status</th><th></th></tr>${DB.campaigns.map(c=>{ensureTemplateMap(c);return `<tr><td><b>${esc(c.name)}</b><div class="muted">${c.products.length===4?"All Products":c.products.join(", ")} · ${esc(c.organisationType||"Both")}</div></td><td>${fmt(c.startDate)}</td><td>Subscription Master</td><td>${campaignTriggers(c).map(t=>`<span class="badge b">${triggerLabel(t)}</span>`).join(" ")}</td><td>${c.channels.includes("WhatsApp")?esc(templateName(c,"WhatsApp",campaignTriggers(c)[0],c.products[0])):"—"}</td><td>${c.channels.includes("Email")?esc(templateName(c,"Email",campaignTriggers(c)[0],c.products[0])):"—"}</td><td><span class="badge ${c.status==="Paused"?"gray":"g"}">${esc(c.status)}</span></td><td><button class="btn small" onclick="clone(${c.id})">Clone</button></td></tr>`}).join("")}</table></section>`;
}
function Scheduler(){
  const rows=scheduleRows(), all=DB.campaigns.map(c=>{c.isExpired=(c.endDate||add(DB.TODAY,45))<DB.TODAY||c.status==="Expired";return c;});
  return `<div class="crumb">KDK Licensing Application / Communication / Scheduler</div><div class="head"><div><h1>Scheduler</h1><p>Projected counts are recalculated from each subscription's Plan End Date.</p></div><button class="btn primary" onclick="run()">▶ Run Scheduler Now</button></div><section class="card panel"><div class="summary-grid"><div class="summary-box">Simulation Date<b>${fmt(DB.TODAY)}</b></div><div class="summary-box">Active Schedules<b>${all.filter(c=>c.status==="Scheduled"||c.status==="Running").length}</b></div><div class="summary-box">Upcoming Executions<b>${rows.length}</b></div></div>${scheduleFull()}</section>`;
}
function scheduleFull(){
  const r=scheduleRows(), campaignRows=DB.campaigns.map(c=>({c,expired:(c.endDate||add(c.startDate||DB.TODAY,45))<DB.TODAY||c.status==="Expired"}));
  return `<div style="overflow:auto;margin-top:14px"><table class="table"><tr><th>Execution Date</th><th>Trigger</th><th>Campaign</th><th>Eligible</th><th>WhatsApp</th><th>Email</th><th>Templates</th><th>State</th><th>Next Action</th></tr>`+
  (r.map(x=>{const e=x.s.filter(s=>s.status==="Active"&&!s.renewed),w=e.filter(s=>s.waOpt&&x.c.channels.includes("WhatsApp")).length,m=e.filter(s=>s.emailOpt&&x.c.channels.includes("Email")).length;return `<tr><td><b>${fmt(x.d)}</b></td><td><span class="badge b">${triggerLabel(x.t)}</span></td><td>${esc(x.c.name)}</td><td><b>${e.length}</b></td><td><span class="badge g">${w}</span></td><td><span class="badge b">${m}</span></td><td><span class="small-note">${x.c.channels.map(ch=>esc(ch)+": "+esc(templateName(x.c,ch,x.t,x.s[0]?.product||x.c.products[0]))).join("<br>")}</span></td><td><span class="badge ${x.d===DB.TODAY?"a":"gray"}">${x.d===DB.TODAY?"Due Today":"Scheduled"}</span></td><td>${(x.c.status==="Scheduled"||x.c.status==="Running")?`<button class="btn small" onclick="stopSchedule(${x.c.id})">Stop Schedule</button>`:`<button class="btn small" onclick="scheduleDetails(${x.c.id})">View Details</button>`}</td></tr>`}).join("")||`<tr><td colspan="9" class="muted" style="padding:35px;text-align:center">No upcoming execution rows for the selected date range. Check campaign dates, triggers and Plan End Dates.</td></tr>`)+`</table></div>
  <div class="card" style="margin-top:14px;padding:12px"><b>Campaign schedule status</b><div style="overflow:auto"><table class="table"><tr><th>Campaign</th><th>Start</th><th>End</th><th>Status</th><th>Next Action</th></tr>${campaignRows.map(x=>`<tr><td>${esc(x.c.name)}</td><td>${fmt(x.c.startDate||DB.TODAY)}</td><td>${fmt(x.c.endDate||add(x.c.startDate||DB.TODAY,45))}</td><td><span class="badge ${x.expired?"gray":x.c.status==="Paused"?"gray":"g"}">${x.expired?"Expired":esc(x.c.status)}</span></td><td>${x.expired?`<button class="btn small" onclick="scheduleDetails(${x.c.id})">View Scheduled Details</button>`:x.c.status==="Paused"?`<button class="btn small" onclick="scheduleDetails(${x.c.id})">View Details</button>`:`<button class="btn small" onclick="stopSchedule(${x.c.id})">Stop Schedule</button>`}</td></tr>`).join("")}</table></div></div>`;
}
function History(){
  const a=historyRecords();
  return `<div class="crumb">KDK Licensing Application / Communication / History</div><div class="head"><div><h1>Audit Logs & History</h1><p>Campaign execution status and delivery summary. Counts represent total recipients processed.</p></div><button class="btn" onclick="exportCSV()">⇩ Export CSV</button></div><section class="card panel"><table class="table"><tr><th>Date</th><th>Campaign</th><th>Channel</th><th>Total Recipients</th><th>Delivery Summary</th><th>Execution Status</th><th>Action</th></tr>${a.map((x,i)=>`<tr><td>${esc(x.d)}</td><td><b>${esc(x.c)}</b></td><td><span class="badge ${x.ch==="WhatsApp"?"g":"b"}">${esc(x.ch)}</span></td><td><b>${x.n}</b></td><td><span class="small-note">Delivered: ${x.delivered} · Failed: ${x.failed} · Pending: ${x.pending}${x.opened?` · Opened: ${x.opened}`:""}</span></td><td><span class="badge ${x.execStatus==="Stopped"?"gray":"g"}">${x.execStatus}</span></td><td><button class="btn small" onclick="historyDetails(${i})">Details</button></td></tr>`).join("")}</table></section>`;
}
function historyRecords(){
  const base=[
    {d:"16 Sep 2026",c:"September Renewal Journey",ch:"WhatsApp",n:84,delivered:80,opened:0,failed:3,pending:1,execStatus:"Completed",template:"renewal_7_days"},
    {d:"16 Sep 2026",c:"September Renewal Journey",ch:"Email",n:72,delivered:68,opened:51,failed:3,pending:1,execStatus:"Completed",template:"spectrum_renewal"},
    {d:"09 Sep 2026",c:"August Renewal Campaign",ch:"WhatsApp",n:126,delivered:121,opened:0,failed:5,pending:0,execStatus:"Completed",template:"renewal_7_days"}
  ];
  return [...base,...DB.msg.map(x=>({d:x.d,c:x.c,ch:x.ch,n:x.n||1,delivered:x.delivered||x.n||1,opened:x.opened||0,failed:x.failed||0,pending:x.pending||0,execStatus:x.execStatus||"Completed",id:x.id}))];
}

function openCamp(c){
  let base=c?{...c,products:[...c.products],triggers:[...c.triggers],channels:[...c.channels]}:
    {id:0,name:"New Renewal Campaign",products:["Spectrum"],triggers:[7,3],channels:["WhatsApp","Email"],time:"10:00",startDate:DB.TODAY,endDate:add(DB.TODAY,45),organisationType:"Both",status:"Draft"};
  DB.modal={camp:base,custom:[]};render();
}
function products(){return ["Spectrum","ExpressGST","ZenTDS","PDF Signer"];}
function campaignModal(){
  const c=DB.modal.camp; ensureTemplateMap(c);
  const allTriggers=[...new Set([...campaignTriggers(c),...(DB.modal.custom||[])])].sort((a,b)=>b-a), current=activeEligible(c).length;
  const product=c.products.length===4?"All Products":c.products[0];
  const templateOptions=(ch,trigger)=>DB.templates.filter(t=>t.type===ch&&(c.products.includes(t.product)||c.products.length===4));
  return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Create Renewal Campaign</h2><p>Configure audience, renewal schedule and the exact message used at every trigger.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
  <div class="wizard"><div class="step on">1 Audience</div><div class="step on">2 Renewal Schedule</div><div class="step on">3 Message & Channels</div><div class="step on">4 Review</div></div>
  <div class="field"><label>Campaign Name</label><input id="cn" value="${esc(c.name)}"></div>
  <div class="input-row"><div class="field"><label>Product</label><select id="cp" onchange="setCampaignProduct(this.value)"><option value="ALL" ${c.products.length===4?"selected":""}>All Products</option>${products().map(p=>`<option value="${p}" ${c.products.length===1&&c.products[0]===p?"selected":""}>${p}</option>`).join("")}</select><div class="help">Audience is represented here by the Master Data (Mock) screen.</div></div>
  <div class="field"><label>Organisation Type</label><select id="co" onchange="setCampaignOrg(this.value)"><option ${c.organisationType==="Both"?"selected":""}>Both</option><option ${c.organisationType==="DIY"?"selected":""}>DIY</option><option ${c.organisationType==="DIFM"?"selected":""}>DIFM</option></select></div></div>
  <div class="input-row"><div class="field"><label>Campaign Start Date</label><input id="csd" type="date" value="${esc(c.startDate||DB.TODAY)}"><div class="help">No execution occurs before this date.</div></div><div class="field"><label>Send Time</label><input id="ct" type="time" value="${esc(c.time||"10:00")}"><div class="help">Execution time for each trigger.</div></div></div>
  <div class="field"><label>Campaign End Date</label><input id="ced" type="date" value="${esc(c.endDate||add(DB.TODAY,45))}"><div class="help">After this date the campaign is expired and has no next action.</div></div>
  <div class="field"><label>When should we send renewal reminders?</label><div class="triggers">${[15,7,3,1,0].map(t=>`<label class="check ${c.triggers.includes(t)?"on":""}"><input type="checkbox" ${c.triggers.includes(t)?"checked":""} onchange="toggleTrigger(${t},this.checked)"> <b>${triggerLabel(t)}</b><small>${count(c,t)} currently eligible</small></label>`).join("")}</div>
  <div class="trigger-add"><input id="customTrigger" type="number" min="0" max="365" placeholder="e.g. 5"><button class="btn small" onclick="addCustomTrigger()">＋ Add custom trigger</button><span class="small-note">Add another value when predefined options are not sufficient.</span></div><div>${allTriggers.filter(t=>![15,7,3,1,0].includes(Number(t))).map(t=>`<span class="trigger-chip">${triggerLabel(t)} <button onclick="removeCustomTrigger(${t})">×</button></span>`).join("")}</div></div>
  <div class="field"><label>Send Through</label><div class="channels">${["WhatsApp","Email"].map(ch=>`<label class="channel ${c.channels.includes(ch)?"on":""}"><input type="checkbox" ${c.channels.includes(ch)?"checked":""} onchange="toggleChannel('${ch}',this.checked)"> <b>${ch}</b><small>${ch==="WhatsApp"?"Rampwin + Meta approved template":"ZeptoMail + email template"}</small></label>`).join("")}</div></div>
  <div class="field"><label>Message Configuration</label><div class="help" style="margin-bottom:8px">Select exactly which approved/template message should be sent for each trigger and channel. This mapping is saved with the campaign.</div><div style="overflow:auto"><table class="table"><tr><th>Trigger</th><th>WhatsApp Message</th><th>Email Message</th></tr>${allTriggers.map(t=>`<tr><td><b>${triggerLabel(t)}</b></td><td>${c.channels.includes("WhatsApp")?`<select onchange="setCampaignTemplate(${t},'WhatsApp',this.value)">${templateOptions("WhatsApp",t).map(x=>`<option value="${x.id}" ${Number(c.templateMap[t+"|WhatsApp"])===Number(x.id)?"selected":""}>${esc(x.name)} · ${esc(x.product)}</option>`).join("")}</select>`:`<span class="muted">Channel not selected</span>`}</td><td>${c.channels.includes("Email")?`<select onchange="setCampaignTemplate(${t},'Email',this.value)">${templateOptions("Email",t).map(x=>`<option value="${x.id}" ${Number(c.templateMap[t+"|Email"])===Number(x.id)?"selected":""}>${esc(x.name)} · ${esc(x.product)}</option>`).join("")}</select>`:`<span class="muted">Channel not selected</span>`}</td></tr>`).join("")}</table></div></div>
  <div class="summary-grid"><div class="summary-box">Current Eligible Audience<b>${current}</b></div><div class="summary-box">Selected Trigger Points<b>${allTriggers.length}</b></div><div class="summary-box">Start From<b>${fmt(c.startDate||DB.TODAY)}</b></div></div>
  <div class="callout" style="margin-top:10px"><b>Renewal rule:</b> eligibility is recalculated at every trigger. If a customer renews after the 7-day reminder, they are excluded from the 3-day reminder. No post-expiry reminders are sent.</div>
  <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveCampaign()">Save & Schedule Campaign</button></div></div></div>`;
}
function setCampaignTemplate(t,ch,id){DB.modal.camp.templateMap[Number(t)+"|"+ch]=Number(id);render();}
function count(c,t){return DB.subs.filter(s=>eligible(s,t,c)).length;}
function setCampaignProduct(v){DB.modal.camp.products=v==="ALL"?products():[v];render();}
function setCampaignOrg(v){DB.modal.camp.organisationType=v;render();}
function toggleProduct(p,on){let c=DB.modal.camp;if(on&&!c.products.includes(p))c.products.push(p);if(!on)c.products=c.products.filter(x=>x!==p);render();}
function toggleTrigger(t,on){let c=DB.modal.camp;if(on&&!c.triggers.includes(t))c.triggers.push(t);if(!on)c.triggers=c.triggers.filter(x=>Number(x)!==Number(t));render();}
function toggleChannel(ch,on){let c=DB.modal.camp;if(on&&!c.channels.includes(ch))c.channels.push(ch);if(!on)c.channels=c.channels.filter(x=>x!==ch);render();}
function addCustomTrigger(){let v=Number(document.getElementById("customTrigger").value);if(!Number.isInteger(v)||v<0||v>365){toast("Enter a whole number from 0 to 365.");return;}let c=DB.modal.camp;if(!c.triggers.includes(v))c.triggers.push(v);DB.modal.custom=[...(DB.modal.custom||[]),v];DB.modal.custom=[...new Set(DB.modal.custom)];render();}
function removeCustomTrigger(t){let c=DB.modal.camp;c.triggers=c.triggers.filter(x=>Number(x)!==Number(t));DB.modal.custom=(DB.modal.custom||[]).filter(x=>Number(x)!==Number(t));render();}
function saveCampaign(){
  const c=DB.modal.camp;
  const nameEl=document.getElementById("cn"), startEl=document.getElementById("csd"), endEl=document.getElementById("ced"), timeEl=document.getElementById("ct");
  c.name=nameEl.value.trim(); c.startDate=startEl.value; c.endDate=endEl.value; c.time=timeEl.value;
  if(!c.name){nameEl.setCustomValidity("Campaign Name is required.");nameEl.reportValidity();return;} nameEl.setCustomValidity("");
  if(!c.startDate){startEl.setCustomValidity("Campaign Start Date is required.");startEl.reportValidity();return;} startEl.setCustomValidity("");
  if(!c.time){timeEl.setCustomValidity("Send Time is required.");timeEl.reportValidity();return;} timeEl.setCustomValidity("");
  if(!c.endDate){endEl.setCustomValidity("Campaign End Date is required.");endEl.reportValidity();return;} endEl.setCustomValidity("");
  if(c.startDate<DB.TODAY){toast("Campaign start date cannot be before the simulated current date.");return;}
  if(c.endDate<c.startDate){toast("Campaign end date must be on or after the start date.");return;}
  if(!c.products.length||!c.triggers.length||!c.channels.length){toast("Select a product, trigger and channel.");return;}
  ensureTemplateMap(c); c.id=Date.now();c.status=c.endDate<DB.TODAY?"Expired":"Scheduled";
  DB.campaigns.push({...c,products:[...c.products],triggers:[...c.triggers],channels:[...c.channels],templateMap:{...c.templateMap}});
  DB.modal=null;DB.view="campaigns";toast("Campaign saved and scheduled.");
}
function clone(id){let c=DB.campaigns.find(x=>x.id===id);openCamp({...c,id:0,name:c.name+" — Clone",startDate:DB.TODAY});}
function openTemplate(){DB.modal={template:1};DB.newTemplateType="WhatsApp";render();setTimeout(()=>templateFormType("WhatsApp"),0);}
function templateModal(){
 return `<div class="modalbg"><div class="modal template-modal"><div class="head"><div><div class="eyebrow">Template Master</div><h2>Create New Template</h2><p>Configure provider metadata first, then define the message content. The form changes with the selected channel.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="template-channel"><button id="tab-wa" class="template-channel-btn on" onclick="templateFormType('WhatsApp')"><span>◉</span><div><b>WhatsApp</b><small>Rampwin + Meta approved template</small></div></button><button id="tab-em" class="template-channel-btn" onclick="templateFormType('Email')"><span>✉</span><div><b>Email</b><small>ZeptoMail transactional template</small></div></button></div>
 <div class="input-row"><div class="field"><label>Product <span class="required-dot">*</span></label><select id="nproduct">${products().map(p=>`<option>${p}</option>`).join("")}</select></div><div class="field"><label>Template Source</label><div class="approval-field"><span>Provider cURL</span><small>Imported from Rampwin / ZeptoMail</small></div></div></div>
 <div id="templateDynamic"></div>
 <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveTemplate()">Save Template</button></div></div></div>`;
}
function templateDynamic(type){
 return type==="WhatsApp"
 ? `<div class="provider-import-card whatsapp-import">
      <div class="import-head"><div><b>Import Approved WhatsApp Template</b><span>Paste the cURL copied from Rampwin → Manage Templates. Only approved templates should be added here.</span></div><span class="approval-pill">✓ APPROVED ONLY</span></div>
      <div class="field"><label>Rampwin Provider cURL <span class="required-dot">*</span></label><textarea id="providerCurl" rows="7" placeholder="Paste the approved WhatsApp template cURL here..." oninput="updateProviderCurlState()"></textarea></div>
      <div class="import-actions"><button class="btn small" onclick="parseProviderCurl()">↳ Read cURL & Fill Details</button><span id="providerParseStatus" class="parse-status">Waiting for provider cURL</span></div>
      <div class="help">Rampwin's Copy Template cURL is generated for a template that already exists in the WhatsApp channel. This screen stores that approved template for campaign use; it does not submit a new template to Meta.</div>
    </div>
    <div class="section-label"><b>WhatsApp Template Details</b><span>Provider values are populated from the cURL where available.</span></div>
    <div class="input-row"><div class="field"><label>Sender ID</label><input id="nsender" value="KDK WhatsApp" placeholder="e.g. KDK WhatsApp"></div><div class="field"><label>Channel ID <span class="required-dot">*</span></label><input id="nchannel" value="" placeholder="Rampwin channel ID" oninput="updateNewWaCurl()"></div></div>
    <div class="input-row"><div class="field"><label>Template Key <span class="required-dot">*</span></label><input id="nname" placeholder="e.g. sync_start_confirmation" oninput="updateNewWaCurl()"><div class="help">Rampwin / Meta template name.</div></div><div class="field"><label>Category <span class="required-dot">*</span></label><select id="ncat" onchange="updateNewWaCurl()"><option>UTILITY</option><option>MARKETING</option><option>AUTHENTICATION</option></select></div></div>
    <div class="input-row"><div class="field"><label>Language Code</label><select id="nlang" onchange="updateNewWaCurl()"><option value="en">English (en)</option><option value="en_US">English (US)</option><option value="hi">Hindi (hi)</option></select></div><div class="field"><label>Approval Status</label><div class="approval-field"><span>✓ Approved</span><small>Only approved templates can be saved.</small></div></div></div>
    <div class="field"><label>Message Body <span class="required-dot">*</span></label><textarea id="ntext" rows="5" placeholder="Paste or enter the approved template body"></textarea><div class="help">Use the same content/variables as the approved provider template.</div></div>
    <div class="developer-card new-curl-card"><div class="dev-head"><div><b>Stored Developer Send cURL</b><span>Uses the provider cURL entered above when available</span></div><button class="btn small" onclick="copyNewWaCurl()">Copy</button></div><pre id="newWaCurl"></pre><div class="help">API key and recipient number are masked in this prototype. The saved template is intended for campaign mapping only.</div></div>`
 : `<div class="provider-import-card email-import">
      <div class="import-head"><div><b>Import ZeptoMail Template cURL</b><span>Paste the provider cURL supplied/generated by the email team. The system reads the template metadata and stores it as a reusable template.</span></div><span class="provider-pill">ZEPTO</span></div>
      <div class="field"><label>ZeptoMail Provider cURL <span class="required-dot">*</span></label><textarea id="providerCurl" rows="7" placeholder="Paste the ZeptoMail template cURL here..." oninput="updateProviderCurlState()"></textarea></div>
      <div class="import-actions"><button class="btn small" onclick="parseProviderCurl()">↳ Read cURL & Fill Details</button><span id="providerParseStatus" class="parse-status">Waiting for provider cURL</span></div>
      <div class="help">You can use a ZeptoMail template send cURL or template-creation cURL. Template key/alias and sender details are retained for later campaign execution.</div>
    </div>
    <div class="section-label"><b>ZeptoMail Template Details</b><span>Provider values are populated from the cURL where available.</span></div>
    <div class="input-row"><div class="field"><label>Sender ID / From Address <span class="required-dot">*</span></label><input id="nsender" value="support@kdksoftware.com" placeholder="e.g. support@kdksoftware.com"></div><div class="field"><label>Mail Agent</label><input id="nagent" value="KDK Transactional" placeholder="ZeptoMail Mail Agent"></div></div>
    <div class="input-row"><div class="field"><label>Template Key</label><input id="nkey" placeholder="Provider-generated template key"><div class="help">Unique provider identifier. Use either key or alias for sending.</div></div><div class="field"><label>Template Alias</label><input id="nalias" placeholder="e.g. spectrum_renewal_email"></div></div>
    <div class="input-row"><div class="field"><label>Category</label><select id="ncat"><option>Transactional</option></select></div><div class="field"><label>Reply-To</label><input id="nreply" value="support@kdksoftware.com"></div></div>
    <div class="field"><label>Email Template Name <span class="required-dot">*</span></label><input id="nname" placeholder="e.g. spectrum_renewal_email"></div>
    <div class="field"><label>Email Subject <span class="required-dot">*</span></label><input id="nsubject" placeholder="Your subscription renewal reminder"></div>
    <div class="field"><label>Email Body / HTML <span class="required-dot">*</span></label><textarea id="ntext" rows="6" placeholder="Paste or enter the template content"></textarea></div>
    <div class="developer-note"><span>⌘</span><div><b>Provider cURL is retained</b><small>The original provider request is stored with the template so developers can refer back to the exact integration payload.</small></div></div>`;
}
function updateProviderCurlState(){
 const el=document.getElementById("providerCurl"), st=document.getElementById("providerParseStatus");
 if(!el||!st)return; st.textContent=el.value.trim()?"Provider cURL pasted — click Read cURL & Fill Details":"Waiting for provider cURL";
 st.className="parse-status "+(el.value.trim()?"ready":"");
 if(DB.newTemplateType==="WhatsApp")updateNewWaCurl();
}
function curlPayloadText(raw){
 const m=raw.match(/(?:--data(?:-raw)?|--data-binary|--data)\s+'([\s\S]*?)'\s*$/m) || raw.match(/(?:--data(?:-raw)?|--data-binary|--data)\s+"([\s\S]*?)"\s*$/m);
 return m?m[1]:"";
}
function parseProviderCurl(){
 const raw=document.getElementById("providerCurl")?.value.trim();
 const status=document.getElementById("providerParseStatus");
 if(!raw){if(status){status.textContent="Paste the provider cURL first.";status.className="parse-status error";}return;}
 try{
   if(DB.newTemplateType==="WhatsApp"){
     if(/\/api\/message-templates\/official-templates/i.test(raw)) throw new Error("This is a template submission cURL, not an approved-template send cURL. Use the Copy Template cURL from Rampwin Manage Templates.");
     if(!/\/api\/messages\/send/i.test(raw)) throw new Error("Use the Rampwin WhatsApp send-template cURL generated from an existing approved template.");
     const ch=(raw.match(/["']channel_id["']\s*:\s*["']([^"']+)["']/i)||[])[1];
     const name=(raw.match(/["']name["']\s*:\s*["']([^"']+)["']/i)||[])[1];
     const lang=(raw.match(/["']code["']\s*:\s*["']([^"']+)["']/i)||[])[1];
     const cat=(raw.match(/["']category["']\s*:\s*["']([^"']+)["']/i)||[])[1];
     const api=(raw.match(/(?:X-API-Key|x-api-key):\s*([^'"\s]+)/i)||[])[1];
     if(!ch||!name){throw new Error("This does not look like a Rampwin WhatsApp template send cURL. channel_id and template.name are required.");}
     document.getElementById("nchannel").value=ch; document.getElementById("nname").value=name;
     if(lang&&["en","en_US","hi"].includes(lang))document.getElementById("nlang").value=lang;
     if(cat&&["UTILITY","MARKETING","AUTHENTICATION"].includes(cat.toUpperCase()))document.getElementById("ncat").value=cat.toUpperCase();
     if(api&&api.length>0){ /* keep provider key masked; never expose it into UI */ }
     if(status){status.textContent="Approved Rampwin template details detected.";status.className="parse-status ready";}
     updateNewWaCurl();
   }else{
     const body=curlPayloadText(raw);
     const j=body?JSON.parse(body):null;
     if(!j)throw new Error("Could not read the JSON body from this cURL.");
     const from=j.from&&j.from.address;
     const key=j.template_key||j.templateKey;
     const alias=j.template_alias||j.templateAlias;
     const name=j.template_name||j.templateName||alias;
     const subject=j.subject;
     const html=j.htmlbody||j.html_body;
     if(from)document.getElementById("nsender").value=from;
     if(key)document.getElementById("nkey").value=key;
     if(alias)document.getElementById("nalias").value=alias;
     if(name)document.getElementById("nname").value=name;
     if(subject)document.getElementById("nsubject").value=subject;
     if(html)document.getElementById("ntext").value=html;
     if(status){status.textContent="ZeptoMail template details detected.";status.className="parse-status ready";}
   }
 }catch(e){if(status){status.textContent=e.message||"Unable to parse this provider cURL.";status.className="parse-status error";}}
}
function newWaCurl(){
 const raw=document.getElementById("providerCurl")?.value.trim();
 if(raw)return raw;
 const channel=document.getElementById("nchannel")?.value.trim()||"CHANNEL_ID";
 const name=document.getElementById("nname")?.value.trim()||"template_key";
 const lang=document.getElementById("nlang")?.value||"en";
 const cat=document.getElementById("ncat")?.value||"UTILITY";
 return `curl --location 'https://api.rampwin.com/api/messages/send?dontShowInChatList=false' \\
  --header 'X-API-Key: xxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '{"channel_id":"${channel}","phone_number":"91xxxxxxxxxx","hide_from_chat":false,"template":{"name":"${name}","language":{"policy":"deterministic","code":"${lang}"},"category":"${cat}"}}'`;
}
function updateNewWaCurl(){const el=document.getElementById("newWaCurl");if(el)el.textContent=newWaCurl();}
function copyNewWaCurl(){const value=newWaCurl();if(navigator.clipboard){navigator.clipboard.writeText(value).then(()=>toast("WhatsApp cURL copied to clipboard."));}else{toast("Copy is unavailable in this browser.");}}
function templateFormType(type){
 DB.newTemplateType=type;
 const holder=document.getElementById("templateDynamic"); if(holder){holder.innerHTML=templateDynamic(type);}
 if(type==="WhatsApp")setTimeout(updateNewWaCurl,0);
 document.getElementById("tab-wa")?.classList.toggle("on",type==="WhatsApp");document.getElementById("tab-em")?.classList.toggle("on",type==="Email");
}

function saveTemplate(){
 const type=DB.newTemplateType||"WhatsApp", nameEl=document.getElementById("nname"),name=nameEl.value.trim(),textEl=document.getElementById("ntext"),text=textEl.value.trim();
 const providerEl=document.getElementById("providerCurl"), providerCurl=providerEl?.value.trim()||"";
 if(!providerCurl){providerEl?.setCustomValidity("Provider cURL is required. Paste the cURL supplied/generated by the provider.");providerEl?.reportValidity();return;} providerEl?.setCustomValidity("");
 if(!name){nameEl.setCustomValidity(type==="WhatsApp"?"Template Key is required.":"Email Template Name is required.");nameEl.reportValidity();return;} nameEl.setCustomValidity("");
 if(!text){textEl.setCustomValidity("Message Body / Email Body is required.");textEl.reportValidity();return;} textEl.setCustomValidity("");
 const senderEl=document.getElementById("nsender"); if(!senderEl.value.trim()){senderEl.setCustomValidity(type==="WhatsApp"?"Sender ID is required.":"Sender ID / From Address is required.");senderEl.reportValidity();return;} senderEl.setCustomValidity("");
 if(type==="WhatsApp"){
   const ch=document.getElementById("nchannel"), cat=document.getElementById("ncat"), key=name;
   if(!ch.value.trim()){ch.setCustomValidity("Channel ID is required.");ch.reportValidity();return;}ch.setCustomValidity("");
   DB.templates.push({id:Date.now(),type,product:document.getElementById("nproduct").value,name,templateKey:key,channelId:ch.value.trim(),senderId:senderEl.value.trim(),category:cat.value,languageCode:document.getElementById("nlang").value,status:"Approved",approvalStatus:"Approved",providerCurl,text});
 }else{
   const subjectEl=document.getElementById("nsubject"),aliasEl=document.getElementById("nalias"),keyEl=document.getElementById("nkey");
   if(!subjectEl.value.trim()){subjectEl.setCustomValidity("Email Subject is required.");subjectEl.reportValidity();return;}subjectEl.setCustomValidity("");
   DB.templates.push({id:Date.now(),type,product:document.getElementById("nproduct").value,name,templateKey:keyEl.value.trim(),templateAlias:aliasEl.value.trim()||name,senderId:senderEl.value.trim(),mailAgent:document.getElementById("nagent").value.trim(),category:"Transactional",replyTo:document.getElementById("nreply").value.trim(),subject:subjectEl.value.trim(),providerCurl,text});
 }
 DB.template=DB.templates[DB.templates.length-1].id;DB.templateType=type;DB.modal=null;DB.view="templates";toast(type==="WhatsApp"?"Approved WhatsApp template added.":"Email template added with provider cURL.");
}
function setTemplateType(t){DB.templateType=t;let x=DB.templates.find(x=>x.type===t);if(x)DB.template=x.id;render();}
function selectTemplate(id){DB.template=id;render();}
function filter(q){document.querySelectorAll(".item").forEach(x=>x.style.display=x.innerText.toLowerCase().includes(q.toLowerCase())?"block":"none");}
function run(){
  let n=0, rows=scheduleRows().filter(x=>x.d===DB.TODAY);
  rows.forEach(x=>x.s.forEach(s=>x.c.channels.forEach(ch=>{
    const ok=ch==="WhatsApp"?s.waOpt:s.emailOpt;
    if(ok){const key=x.t+"|"+ch, t=templateFor(x.c,ch,x.t,s.product);DB.msg.push({id:Date.now()+n,d:fmt(DB.TODAY),c:x.c.name,ch,n:1,delivered:1,failed:0,pending:0,opened:ch==="Email"?1:0,execStatus:"Completed",template:t?t.name:"Not configured",client:s.name});n++;}
  })));
  toast(n?`Scheduler executed: ${n} eligible communications processed.`:"No eligible communications today.");
}
function clientRows(h){
  const count=Number(h.n)||0, names=DB.subs.map(s=>s.name);
  const rows=[]; for(let i=0;i<count;i++){
    const name=names[i%names.length]||(`Demo Client ${String(i+1).padStart(3,"0")}`);
    let status="Delivered";
    if(h.failed&&i>=count-h.failed) status="Failed";
    else if(h.pending&&i>=count-h.failed-h.pending) status="Pending";
    else if(h.ch==="Email"&&h.opened&&i<Math.min(h.opened,count-h.failed-h.pending)) status="Opened";
    rows.push({clientId:`CL-${String(i+1).padStart(4,"0")}`,name,email:`client${(i%50)+1}@example.com`,channel:h.ch,status,campaign:h.c,date:h.d,template:h.template||"Configured campaign template"});
  } return rows;
}
function exportClientCSV(h){
 const rows=clientRows(h),q=v=>`"${String(v).replace(/"/g,'""')}"`;
 const csv=["Client ID,Client Name,Email,Channel,Status,Campaign,Date,Template",...rows.map(r=>[r.clientId,r.name,r.email,r.channel,r.status,r.campaign,r.date,r.template].map(q).join(","))].join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="client-wise-campaign-status.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Client-wise CSV exported.");
}
function exportCSV(){
 const base=historyRecords(),q=v=>`"${String(v).replace(/"/g,'""')}"`;
 const csv=["Date,Campaign,Channel,Total Recipients,Delivered,Opened,Failed,Pending,Execution Status",...base.map(x=>[x.d,x.c,x.ch,x.n,x.delivered,x.opened,x.failed,x.pending,x.execStatus].map(q).join(","))].join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="kdk-communication-history.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("History CSV exported.");
}
function stopSchedule(id){let c=DB.campaigns.find(x=>x.id===id);if(!c)return;c.status="Paused";toast("Schedule stopped. No further trigger executions will be created.");}
function scheduleDetails(id){let c=DB.campaigns.find(x=>x.id===id);if(!c)return;DB.modal={schedule:c};render();}
function scheduleModal(){
 const c=DB.modal.schedule;ensureTemplateMap(c);
 return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Scheduled Details</h2><p>Campaign configuration, trigger dates and message mapping.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="summary-grid"><div class="summary-box">Campaign<b>${esc(c.name)}</b></div><div class="summary-box">Status<b>${esc(c.status)}</b></div><div class="summary-box">Organisation<b>${esc(c.organisationType||"Both")}</b></div></div>
 <div class="input-row"><div class="field"><label>Start Date</label><input value="${fmt(c.startDate)}" readonly></div><div class="field"><label>End Date</label><input value="${fmt(c.endDate)}" readonly></div></div>
 <div class="input-row"><div class="field"><label>Product</label><input value="${c.products.length===4?"All Products":c.products.join(", ")}" readonly></div><div class="field"><label>Send Time</label><input value="${esc(c.time)} IST" readonly></div></div>
 <div class="field"><label>Trigger → Message Mapping</label><div style="overflow:auto"><table class="table"><tr><th>Trigger</th><th>WhatsApp</th><th>Email</th></tr>${campaignTriggers(c).map(t=>`<tr><td>${triggerLabel(t)}</td><td>${c.channels.includes("WhatsApp")?esc(templateName(c,"WhatsApp",t,c.products[0])):"—"}</td><td>${c.channels.includes("Email")?esc(templateName(c,"Email",t,c.products[0])):"—"}</td></tr>`).join("")}</table></div></div>
 <div class="callout">Eligibility is recalculated from Master Data (Mock) at execution time. Renewed customers are excluded from later triggers. Campaign start/end dates control whether the trigger is active.</div>
 <div class="actions"><button class="btn primary" onclick="DB.modal=null;render()">Close</button></div></div></div>`;
}
function historyDetails(i){const h=historyRecords()[i];if(!h)return;DB.modal={history:h};render();}
function historyModal(){
 const h=DB.modal.history,rows=clientRows(h), counts={opened:rows.filter(r=>r.status==="Opened").length,failed:rows.filter(r=>r.status==="Failed").length,pending:rows.filter(r=>r.status==="Pending").length,deliveredOnly:rows.filter(r=>r.status==="Delivered").length}; const deliveredTotal=counts.deliveredOnly+counts.opened;
 return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Campaign Communication Details</h2><p>Client-wise delivery status for this campaign execution.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="summary-grid"><div class="summary-box">Total Recipients<b>${h.n}</b></div><div class="summary-box">Execution Status<b>${esc(h.execStatus)}</b></div><div class="summary-box">Channel<b>${esc(h.ch)}</b></div></div>
 <div class="summary-grid"><div class="summary-box">Successfully Delivered<b>${deliveredTotal}</b></div><div class="summary-box">Opened<b>${counts.opened}</b></div><div class="summary-box">Failed / Pending<b>${counts.failed} / ${counts.pending}</b></div></div>
 <div class="field"><label>Campaign</label><input value="${esc(h.c)}" readonly></div>
 <div class="field"><label>Message Template</label><input value="${esc(h.template||"Campaign-mapped template")}" readonly></div>
 <div class="field"><label>Client-wise Status</label><div class="audience"><table class="table"><tr><th>Client</th><th>Email</th><th>Channel</th><th>Status</th></tr>${rows.slice(0,25).map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.channel)}</td><td><span class="badge ${r.status==="Failed"?"gray":r.status==="Pending"?"b":"g"}">${r.status}</span></td></tr>`).join("")}</table></div><div class="help">Showing first 25 clients in the demo. The CSV export contains all ${h.n} recipients.</div></div>
 <div class="actions"><button class="btn" onclick="exportClientCSV(DB.modal.history)">⇩ Export Client-wise CSV</button><button class="btn primary" onclick="DB.modal=null;render()">Close</button></div></div></div>`;
}
function openSettings(){DB.modal={settings:1};render();}
function settingsModal(){
 return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Prototype Controls & Branding</h2><p>Simulation settings for product demonstration.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="input-row"><div class="field"><label>Simulated Current Date</label><input id="sd" type="date" value="${DB.TODAY}"><div class="help">Use this to demonstrate different renewal dates.</div></div><div class="field"><label>Organisation / Sender Name</label><input value="KDK Softwares India Pvt. Ltd."></div></div>
 <div class="field"><label>Mark a customer as renewed</label><div class="channels">${DB.subs.filter(s=>s.status==="Active"&&!s.renewed).slice(0,20).map(s=>`<button class="btn small" onclick="renew(${s.id})">${esc(s.name)} · ${esc(s.product)}</button>`).join("")}</div></div>
 <div class="protocol-list"><div class="protocol-box"><b>Audience Source</b><p class="muted">Master Data (Mock), representing the existing Licensing / Subscription data source. No separate Customer Master is used.</p></div><div class="protocol-box"><b>Providers</b><p class="muted">WhatsApp → Rampwin + Meta approved templates<br>Email → ZeptoMail</p></div></div>
 <div class="callout" style="margin-top:10px"><b>Demo scenario:</b> set a date, run Scheduler, then renew a customer. Their later trigger eligibility disappears.</div>
 <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Close</button><button class="btn primary" onclick="applySettings()">Apply Date</button></div></div></div>`;
}
function applySettings(){DB.TODAY=document.getElementById("sd").value||DB.TODAY;DB.modal=null;render();toast("Simulation date updated.");}
function renew(id){let s=DB.subs.find(x=>x.id===id);if(!s)return;s.renewed=true;s.status="Renewed";toast(`${s.name} renewed — future reminders skipped`);}
function render(){
 let body=DB.view==="dashboard"?Dash():DB.view==="subscriptions"?SubscriptionMaster():DB.view==="templates"?Templates():DB.view==="campaigns"?Campaigns():DB.view==="scheduler"?Scheduler():History();
 document.getElementById("app").innerHTML=Header()+`<main class="main">${body}</main>`+
 (DB.modal?.camp?campaignModal():DB.modal?.template?templateModal():DB.modal?.settings?settingsModal():DB.modal?.schedule?scheduleModal():DB.modal?.history?historyModal():DB.modal?.addSub?addSubModal():"")+
 (DB.toast?`<div class="toast">${esc(DB.toast)}</div>`:"");
}
document.addEventListener("click",function(e){if(e.target.classList&&e.target.classList.contains("modalbg")){DB.modal=null;render();}});
window.render=render;window.nav=nav;window.openAddSub=openAddSub;window.saveDemoSub=saveDemoSub;window.openCamp=openCamp;window.setTemplateType=setTemplateType;window.selectTemplate=selectTemplate;window.filter=filter;window.run=run;window.exportCSV=exportCSV;window.openTemplate=openTemplate;window.saveTemplate=saveTemplate;window.saveCampaign=saveCampaign;window.clone=clone;window.openSettings=openSettings;window.applySettings=applySettings;window.renew=renew;window.toggleProduct=toggleProduct;window.toggleTrigger=toggleTrigger;window.toggleChannel=toggleChannel;window.addCustomTrigger=addCustomTrigger;window.removeCustomTrigger=removeCustomTrigger;window.setCampaignProduct=setCampaignProduct;window.setCampaignOrg=setCampaignOrg;window.stopSchedule=stopSchedule;window.scheduleDetails=scheduleDetails;window.historyDetails=historyDetails;window.exportClientCSV=exportClientCSV;window.setCampaignTemplate=setCampaignTemplate;window.templateFormType=templateFormType;window.parseProviderCurl=parseProviderCurl;window.updateProviderCurlState=updateProviderCurlState;window.copyNewWaCurl=copyNewWaCurl;window.copyStoredCurl=copyStoredCurl;window.copyTemplateCurl=copyTemplateCurl;
render();
})();