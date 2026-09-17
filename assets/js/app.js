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
  return `<header class="hdr"><div class="brand"><div class="logo">K</div><div><b>KDK Licensing</b><small>Communication & Renewal</small></div></div><nav class="nav">`+
  [["dashboard","Dashboard"],["templates","Templates"],["campaigns","Campaign Manager"],["scheduler","Schedule"],["history","History"]].map(x=>`<button class="${DB.view===x[0]?"on":""}" onclick="nav('${x[0]}')">${x[1]}</button>`).join("")+
  `</nav><button class="btn" onclick="openSettings()">⚙</button><div class="avatar">DK</div></header>`;
}
function Dash(){
  let active=DB.subs.filter(s=>s.status==="Active"&&!s.renewed).length;
  let exp=DB.subs.filter(s=>s.status==="Active"&&!s.renewed&&days(DB.TODAY,s.end)>=0&&days(DB.TODAY,s.end)<=7).length;
  let triggered=284+DB.msg.length;
  let renewals=38+DB.subs.filter(s=>s.renewed).length;
  return `<div class="crumb">KDK Licensing Application / Communication</div><div class="head"><div><h1>Communication Dashboard</h1><p>Renewal operations, campaign performance and execution readiness.</p></div><button class="btn primary" onclick="openCamp()">＋ Create Campaign</button></div>
  <div class="grid kpis">
  <div class="card kpi"><span class="ico">▣</span><span class="label muted">Active Plans</span><div class="value">${active}</div><span class="muted">Live Subscription Master data</span></div>
  <div class="card kpi"><span class="ico">◷</span><span class="label muted">Expiring in 7 Days</span><div class="value">${exp}</div><span class="muted">Current eligible subscriptions</span></div>
  <div class="card kpi"><span class="ico">↗</span><span class="label muted">Messages Triggered</span><div class="value">${triggered}</div><span class="muted"><b class="ok">96.4%</b> provider delivery rate</span></div>
  <div class="card kpi"><span class="ico">✓</span><span class="label muted">Renewals Attributed</span><div class="value">${renewals}</div><span class="muted"><b class="ok">+12</b> this cycle</span></div></div>
  <div class="grid two" style="margin-top:15px"><section class="card panel"><div class="title"><h3>Communication Performance</h3><span class="muted">WhatsApp + Email</span></div><div class="chart">${[64,71,58,82,76,93,88].map((v,i)=>`<div class="barcol"><div class="bars"><i class="bar" style="height:${v}%"></i><i class="bar email" style="height:${Math.max(8,v-18)}%"></i></div>${["Apr","May","Jun","Jul","Aug","Sep","Oct"][i]}</div>`).join("")}</div></section>
  <section class="card panel"><div class="title"><h3>Renewal Funnel</h3><span class="muted">Current cycle</span></div>${[["Expiring audience",1284,100],["Delivered",1120,87],["Engaged",714,56],["Renewed",386,30]].map(x=>`<div class="funnel"><div class="frow"><b>${x[0]}</b><span>${x[1]}</span></div><div class="progress"><i style="width:${x[2]}%"></i></div></div>`).join("")}</section></div>
  <div class="grid two" style="margin-top:15px"><section class="card panel"><div class="title"><h3>Upcoming Renewal Triggers</h3><button class="btn small" onclick="nav('scheduler')">View Scheduler</button></div>${schedule()}</section>
  <section class="card panel"><div class="title"><h3>Campaign Activity</h3><button class="btn small" onclick="nav('campaigns')">Manage</button></div><table class="table"><tr><th>Campaign</th><th>Status</th><th>Triggers</th></tr>${DB.campaigns.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td><span class="badge g">${c.status}</span></td><td>${campaignTriggers(c).map(triggerLabel).join(" · ")}</td></tr>`).join("")}</table></section></div>`;
}
function Templates(){
  const type=DB.templateType||"WhatsApp",list=DB.templates.filter(x=>x.type===type);
  let t=DB.templates.find(x=>x.id===DB.template&&x.type===type)||list[0]; if(t)DB.template=t.id;
  if(!t)return `<div class="crumb">KDK Licensing Application / Communication / Templates</div><div class="head"><div><h1>Template Master</h1><p>No templates found.</p></div><button class="btn primary" onclick="openTemplate()">＋ New Template</button></div>`;
  const preview=type==="WhatsApp"?`<div class="phone"><div class="phonehead">KDK Support · WhatsApp</div><div class="bubble">${esc(t.text||"").replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,t.product).replace(/{{3}}/g,"23 Sep 2026").replace(/{{4}}/g,"7")}</div></div>`:`<div class="email-preview"><div class="mail-head"><b>${esc(t.subject||"Renewal reminder")}</b><span>To: customer@example.com</span></div><div class="mail-body">${esc(t.text||"").replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,t.product).replace(/{{3}}/g,"25 Sep 2026").replace(/{{4}}/g,"7")}</div></div>`;
  return `<div class="crumb">KDK Licensing Application / Communication / Templates</div><div class="head"><div><h1>Template Master</h1><p>Approved Meta templates and ZeptoMail email templates.</p></div><button class="btn primary" onclick="openTemplate()">＋ New Template</button></div>
  <div class="tabs"><button class="${type==="WhatsApp"?"on":""}" onclick="setTemplateType('WhatsApp')">WhatsApp Templates</button><button class="${type==="Email"?"on":""}" onclick="setTemplateType('Email')">Email Templates</button></div>
  <div class="layout"><section class="card list"><input class="search" placeholder="Search templates..." oninput="filter(this.value)"><div id="items">${list.map(x=>`<div class="item ${x.id===t.id?"sel":""}" onclick="selectTemplate(${x.id})"><b>${esc(x.name)}</b><small>${esc(x.product)} · <span class="badge g">Approved</span></small></div>`).join("")}</div></section>
  <section class="card editor"><div class="title"><h3>${esc(t.name)}</h3><span class="muted">${esc(t.product)} · <span class="status-dot"></span> Approved</span></div><div class="field"><label>Template Name</label><input value="${esc(t.name)}"></div>${type==="Email"?`<div class="field"><label>Email Subject</label><input value="${esc(t.subject||"")}"></div>`:""}<div class="field"><label>Content</label><textarea style="width:100%;min-height:125px">${esc(t.text||"")}</textarea></div><div class="callout"><b>Provider:</b> ${type==="WhatsApp"?"Rampwin API → Meta approved template":"ZeptoMail → Email template"}<br><span class="muted">Provider callbacks are simulated.</span></div></section>
  <aside class="card preview"><div class="title"><h3>Live Preview</h3><span class="provider-pill">${type}</span></div>${preview}</aside></div>`;
}
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
  <div class="input-row"><div class="field"><label>Product</label><select id="cp" onchange="setCampaignProduct(this.value)"><option value="ALL" ${c.products.length===4?"selected":""}>All Products</option>${products().map(p=>`<option value="${p}" ${c.products.length===1&&c.products[0]===p?"selected":""}>${p}</option>`).join("")}</select><div class="help">Audience is taken from the existing Subscription Master.</div></div>
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
  c.name=document.getElementById("cn").value.trim()||"Renewal Campaign";
  c.startDate=document.getElementById("csd").value||DB.TODAY;
  c.endDate=document.getElementById("ced").value||add(c.startDate,45);
  c.time=document.getElementById("ct").value||"10:00";
  if(c.startDate<DB.TODAY){toast("Campaign start date cannot be before the simulated current date.");return;}
  if(c.endDate<c.startDate){toast("Campaign end date must be on or after the start date.");return;}
  if(!c.products.length||!c.triggers.length||!c.channels.length){toast("Select a product, trigger and channel.");return;}
  ensureTemplateMap(c); c.id=Date.now();c.status=c.endDate<DB.TODAY?"Expired":"Scheduled";
  DB.campaigns.push({...c,products:[...c.products],triggers:[...c.triggers],channels:[...c.channels],templateMap:{...c.templateMap}});
  DB.modal=null;DB.view="campaigns";toast("Campaign saved and scheduled.");
}
function clone(id){let c=DB.campaigns.find(x=>x.id===id);openCamp({...c,id:0,name:c.name+" — Clone",startDate:DB.TODAY});}
function openTemplate(){DB.modal={template:1};render();setTimeout(()=>templateFormType("WhatsApp"),0);}
function templateModal(){
 return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Create New Template</h2><p>Fields change based on whether you choose WhatsApp or Email.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="input-row"><div class="field"><label>Template Type</label><select id="ntype" onchange="templateFormType(this.value)"><option>WhatsApp</option><option>Email</option></select></div><div class="field"><label>Product</label><select id="nproduct">${products().map(p=>`<option>${p}</option>`).join("")}</select></div></div>
 <div id="templateDynamic"></div>
 <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveTemplate()">Save Template</button></div></div></div>`;
}
function templateDynamic(type){
 return type==="WhatsApp"
 ? `<div class="field"><label>Meta Template Name</label><input id="nname" placeholder="e.g. spectrum_renewal_5_days"></div>
 <div class="input-row"><div class="field"><label>Language</label><select id="nlang"><option>English</option><option>Hindi</option></select></div><div class="field"><label>Category</label><select id="ncat"><option>UTILITY</option><option>MARKETING</option></select></div></div>
 <div class="field"><label>Message Body</label><textarea id="ntext" rows="6">Hello {{1}}, your {{2}} subscription will expire on {{3}}. Renew before the expiry date to continue uninterrupted access.</textarea><div class="help">Meta-approved template variables: {{1}} Customer Name · {{2}} Product/Plan · {{3}} Plan End Date · {{4}} Days Remaining.</div></div>
 <div class="callout"><b>Provider:</b> Rampwin API → Meta approved WhatsApp template</div>`
 : `<div class="field"><label>Email Template Name</label><input id="nname" placeholder="e.g. spectrum_renewal_email"></div>
 <div class="field"><label>Email Subject</label><input id="nsubject" placeholder="Your subscription renewal reminder"></div>
 <div class="input-row"><div class="field"><label>From Name</label><input id="nfrom" value="KDK Support"></div><div class="field"><label>Reply-To</label><input id="nreply" value="support@kdksoftware.com"></div></div>
 <div class="field"><label>Email Body</label><textarea id="ntext" rows="7">Dear {{1}}, your {{2}} subscription is approaching its plan end date of {{3}}. Please renew to continue uninterrupted access.</textarea><div class="help">Email variables: {{1}} Customer Name · {{2}} Product/Plan · {{3}} Plan End Date · {{4}} Days Remaining.</div></div>
 <div class="callout"><b>Provider:</b> ZeptoMail → Email template</div>`;
}
function templateFormType(type){
 const holder=document.getElementById("templateDynamic"); if(holder){holder.innerHTML=templateDynamic(type);}
}

function saveTemplate(){
 const type=document.getElementById("ntype").value,name=document.getElementById("nname").value.trim();
 if(!name){toast("Enter a template name.");return;}
 DB.templates.push({id:Date.now(),type,product:document.getElementById("nproduct").value,name,subject:document.getElementById("nsubject")?.value||"",text:document.getElementById("ntext").value});
 DB.template=DB.templates[DB.templates.length-1].id;DB.templateType=type;DB.modal=null;DB.view="templates";toast("Template created.");
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
 <div class="callout">Eligibility is recalculated from Subscription Master at execution time. Renewed customers are excluded from later triggers. Campaign start/end dates control whether the trigger is active.</div>
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
 <div class="protocol-list"><div class="protocol-box"><b>Audience Source</b><p class="muted">Existing Licensing / Subscription Master. No separate Customer Master is used.</p></div><div class="protocol-box"><b>Providers</b><p class="muted">WhatsApp → Rampwin + Meta approved templates<br>Email → ZeptoMail</p></div></div>
 <div class="callout" style="margin-top:10px"><b>Demo scenario:</b> set a date, run Scheduler, then renew a customer. Their later trigger eligibility disappears.</div>
 <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Close</button><button class="btn primary" onclick="applySettings()">Apply Date</button></div></div></div>`;
}
function applySettings(){DB.TODAY=document.getElementById("sd").value||DB.TODAY;DB.modal=null;render();toast("Simulation date updated.");}
function renew(id){let s=DB.subs.find(x=>x.id===id);if(!s)return;s.renewed=true;s.status="Renewed";toast(`${s.name} renewed — future reminders skipped`);}
function render(){
 let body=DB.view==="dashboard"?Dash():DB.view==="templates"?Templates():DB.view==="campaigns"?Campaigns():DB.view==="scheduler"?Scheduler():History();
 document.getElementById("app").innerHTML=Header()+`<main class="main">${body}</main>`+
 (DB.modal?.camp?campaignModal():DB.modal?.template?templateModal():DB.modal?.settings?settingsModal():DB.modal?.schedule?scheduleModal():DB.modal?.history?historyModal():"")+
 (DB.toast?`<div class="toast">${esc(DB.toast)}</div>`:"");
}
window.nav=nav;window.openCamp=openCamp;window.setTemplateType=setTemplateType;window.selectTemplate=selectTemplate;window.filter=filter;window.run=run;window.exportCSV=exportCSV;window.openTemplate=openTemplate;window.saveTemplate=saveTemplate;window.saveCampaign=saveCampaign;window.clone=clone;window.openSettings=openSettings;window.applySettings=applySettings;window.renew=renew;window.toggleProduct=toggleProduct;window.toggleTrigger=toggleTrigger;window.toggleChannel=toggleChannel;window.addCustomTrigger=addCustomTrigger;window.removeCustomTrigger=removeCustomTrigger;window.setCampaignProduct=setCampaignProduct;window.setCampaignOrg=setCampaignOrg;window.stopSchedule=stopSchedule;window.scheduleDetails=scheduleDetails;window.historyDetails=historyDetails;window.exportClientCSV=exportClientCSV;window.setCampaignTemplate=setCampaignTemplate;window.templateFormType=templateFormType;
render();
})();