(function(){
"use strict";
const DB = window.DB;
DB.view = DB.view || "dashboard";
DB.modal = null;
DB.toast = "";
DB.msg = DB.msg || [];
DB.customTriggers = DB.customTriggers || {};

function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
function D(s){return new Date(s+"T00:00:00Z");}
function days(a,b){return Math.round((D(b)-D(a))/86400000);}
function add(s,n){let d=D(s);d.setUTCDate(d.getUTCDate()+Number(n));return d.toISOString().slice(0,10);}
function fmt(s){return D(s).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});}
function nav(v){DB.view=v;DB.modal=null;render();}
function toast(x){DB.toast=x;render();setTimeout(()=>{DB.toast="";render()},2100);}
function eligible(s,t){return s.status==="Active"&&!s.renewed&&days(DB.TODAY,s.end)===Number(t);}
function activeEligible(c){return DB.subs.filter(s=>c.products.includes(s.product)&&s.status==="Active"&&!s.renewed);}
function triggerLabel(t){return Number(t)===0?"On Plan End Date":Number(t)+" Days Before Expiry";}
function campaignTriggers(c){return [...new Set((c.triggers||[]).map(Number))].sort((a,b)=>b-a);}
function templateFor(c,ch){
  return DB.templates.find(t=>t.type===ch&&c.products.includes(t.product)) || DB.templates.find(t=>t.type===ch);
}
function scheduleRows(){
  let out=[];
  DB.campaigns.forEach(c=>{
    if(c.status==="Paused") return;
    campaignTriggers(c).forEach(t=>{
      const eligibleSubs=DB.subs.filter(s=>c.products.includes(s.product)&&s.status==="Active"&&!s.renewed);
      eligibleSubs.forEach(s=>{
        const execution=add(s.end,-t);
        if(execution>=c.startDate && execution>=DB.TODAY && execution<=add(DB.TODAY,45)){
          out.push({d:execution,t,c,s});
        }
      });
    });
  });
  const grouped={};
  out.forEach(r=>{
    const key=r.d+"|"+r.t+"|"+r.c.id;
    if(!grouped[key]) grouped[key]={d:r.d,t:r.t,c:r.c,s:[]};
    grouped[key].s.push(r.s);
  });
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
  let t=DB.templates.find(x=>x.id==DB.template)||DB.templates[0];
  let list=DB.templates.filter(x=>x.type===t.type);
  let preview=t.type==="WhatsApp"?`<div class="phone"><div class="phonehead">KDK Support · WhatsApp</div><div class="bubble">${esc(t.text).replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,"Spectrum Cloud Professional").replace(/{{3}}/g,"23 Sep 2026").replace(/{{4}}/g,"7")}</div></div>`:`<div class="callout"><b>${esc(t.subject||"Email subject")}</b><hr>${esc(t.text).replace(/{{1}}/g,"Aarav").replace(/{{2}}/g,"PDF Signer Business").replace(/{{3}}/g,"25 Sep 2026")}</div>`;
  return `<div class="crumb">KDK Licensing Application / Communication / Templates</div><div class="head"><div><h1>Template Master</h1><p>Approved Meta templates and ZeptoMail email templates.</p></div><button class="btn primary" onclick="openTemplate()">＋ New Template</button></div>
  <div class="tabs"><button class="${t.type==="WhatsApp"?"on":""}" onclick="type('WhatsApp')">WhatsApp Templates</button><button class="${t.type==="Email"?"on":""}" onclick="type('Email')">Email Templates</button></div>
  <div class="layout"><section class="card list"><input class="search" placeholder="Search templates..." oninput="filter(this.value)"><div id="items">${list.map(x=>`<div class="item ${x.id===t.id?"sel":""}" onclick="DB.template=${x.id};render()"><b>${esc(x.name)}</b><small>${esc(x.product)} · <span class="badge g">Approved</span></small></div>`).join("")}</div></section>
  <section class="card editor"><div class="title"><h3>${esc(t.name)}</h3><span class="muted">${esc(t.product)} · Approved</span></div><div class="field"><label>Template Name</label><input value="${esc(t.name)}"></div>${t.type==="Email"?`<div class="field"><label>Subject</label><input value="${esc(t.subject||"")}"></div>`:""}<div class="field"><label>Content</label><textarea style="width:100%;min-height:110px">${esc(t.text)}</textarea></div>
  <div class="callout"><b>Provider:</b> ${t.type==="WhatsApp"?"Rampwin API → Meta approved template":"ZeptoMail → Email template"}<br><span class="muted">Provider callbacks are simulated.</span></div></section><aside class="card preview"><div class="title"><h3>Live Preview</h3></div>${preview}</aside></div>`;
}
function Campaigns(){
  return `<div class="crumb">KDK Licensing Application / Communication / Campaigns</div><div class="head"><div><h1>Campaign Manager</h1><p>One renewal campaign with multiple Plan End Date trigger points.</p></div><button class="btn primary" onclick="openCamp()">＋ Create Campaign</button></div>
  <section class="card panel"><table class="table"><tr><th>Campaign</th><th>Start Date</th><th>Audience</th><th>Triggers</th><th>Channels</th><th>Eligible</th><th>Status</th><th></th></tr>${DB.campaigns.map(c=>`<tr><td><b>${esc(c.name)}</b><div class="muted">${c.products.join(", ")}</div></td><td>${fmt(c.startDate)}</td><td>Subscription Master</td><td>${campaignTriggers(c).map(t=>`<span class="badge b">${triggerLabel(t)}</span>`).join(" ")}</td><td>${c.channels.join(" + ")}</td><td><b>${activeEligible(c).length}</b></td><td><span class="badge g">${c.status}</span></td><td><button class="btn small" onclick="clone(${c.id})">Clone</button></td></tr>`).join("")}</table></section>`;
}
function Scheduler(){
  return `<div class="crumb">KDK Licensing Application / Communication / Scheduler</div><div class="head"><div><h1>Scheduler</h1><p>Projected counts are recalculated from each subscription's Plan End Date.</p></div><button class="btn primary" onclick="run()">▶ Run Scheduler Now</button></div>
  <section class="card panel"><div class="summary-grid"><div class="summary-box">Simulation Date<b>${fmt(DB.TODAY)}</b></div><div class="summary-box">Scheduled Campaigns<b>${DB.campaigns.filter(c=>c.status!=="Paused").length}</b></div><div class="summary-box">Upcoming Executions<b>${scheduleRows().length}</b></div></div>${scheduleFull()}</section>
  <div class="grid two" style="margin-top:15px"><section class="card panel"><h3>Renewal Protocol</h3><p class="muted" style="font-size:11px;line-height:1.7">This is not a daily/every-alternate-day broadcast. A single campaign can contain 15/7/3/1-day and On Plan End Date triggers. Each subscription gets its own trigger dates.</p></section><section class="card panel"><h3>Stop Conditions</h3><p style="font-size:11px">✓ Stop when subscription is renewed<br>✓ Stop at Plan End Date<br>✓ No post-expiry messages unless explicitly configured</p></section></div>`;
}
function scheduleFull(){
  let r=scheduleRows();
  return `<div style="overflow:auto;margin-top:14px"><table class="table"><tr><th>Execution Date</th><th>Trigger</th><th>Campaign</th><th>Eligible</th><th>WhatsApp</th><th>Email</th><th>State</th></tr>`+
  (r.map(x=>{let e=x.s.filter(s=>s.status==="Active"&&!s.renewed),w=e.filter(s=>s.waOpt&&x.c.channels.includes("WhatsApp")).length,m=e.filter(s=>s.emailOpt&&x.c.channels.includes("Email")).length;return `<tr><td><b>${fmt(x.d)}</b></td><td><span class="badge b">${triggerLabel(x.t)}</span></td><td>${esc(x.c.name)}</td><td><b>${e.length}</b></td><td><span class="badge g">${w}</span></td><td><span class="badge b">${m}</span></td><td><span class="badge ${x.d===DB.TODAY?"a":"gray"}">${x.d===DB.TODAY?"Due Today":"Scheduled"}</span></td></tr>`}).join("")||`<tr><td colspan="7" class="muted" style="padding:35px;text-align:center">No upcoming executions.</td></tr>`)+`</table></div>`;
}
function History(){
  let a=[{d:"16 Sep 2026",c:"September Renewal Journey",ch:"WhatsApp",n:84,s:"Delivered"},{d:"16 Sep 2026",c:"September Renewal Journey",ch:"Email",n:72,s:"Opened"},{d:"09 Sep 2026",c:"August Renewal Campaign",ch:"WhatsApp",n:126,s:"Delivered"},...DB.msg];
  return `<div class="crumb">KDK Licensing Application / Communication / History</div><div class="head"><div><h1>Audit Logs & History</h1><p>Campaign execution history and simulated provider responses.</p></div><button class="btn" onclick="exportCSV()">⇩ Export CSV</button></div><section class="card panel"><table class="table"><tr><th>Date</th><th>Campaign</th><th>Channel</th><th>Count</th><th>Status</th><th>Action</th></tr>${a.map(x=>`<tr><td>${esc(x.d)}</td><td><b>${esc(x.c)}</b></td><td><span class="badge ${x.ch==="WhatsApp"?"g":"b"}">${esc(x.ch)}</span></td><td>${x.n}</td><td><span class="badge g">${esc(x.s)}</span></td><td><button class="btn small" onclick="toast('Audit details opened')">Details</button></td></tr>`).join("")}</table></section>`;
}
function openCamp(c){
  let base=c?{...c,products:[...c.products],triggers:[...c.triggers],channels:[...c.channels]}:{id:0,name:"New Renewal Campaign",products:["Spectrum","ExpressGST","ZenTDS","PDF Signer"],triggers:[7,3],channels:["WhatsApp","Email"],time:"10:00",startDate:DB.TODAY,status:"Draft"};
  DB.modal={camp:base,custom:[]};render();
}
function products(){return ["Spectrum","ExpressGST","ZenTDS","PDF Signer"];}
function campaignModal(){
  const c=DB.modal.camp;
  const allTriggers=[...new Set([...campaignTriggers(c),...(DB.modal.custom||[])])].sort((a,b)=>b-a);
  const current=activeEligible(c).length;
  return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Create Renewal Campaign</h2><p>Configure one campaign with multiple renewal trigger points.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
  <div class="wizard"><div class="step on">1 Audience</div><div class="step on">2 Renewal Schedule</div><div class="step on">3 Message & Channels</div><div class="step">4 Review</div></div>
  <div class="field"><label>Campaign Name</label><input id="cn" value="${esc(c.name)}"></div>
  <div class="field"><label>Campaign Start Date</label><input id="csd" type="date" value="${esc(c.startDate||DB.TODAY)}"><div class="help">The campaign will not execute before this date. Example: choose Monday, 21 Sep 2026 to start next week.</div></div>
  <div class="field"><label>Products from Subscription Master</label><div class="channels">${products().map(p=>`<label class="channel ${c.products.includes(p)?"on":""}"><input type="checkbox" ${c.products.includes(p)?"checked":""} onchange="toggleProduct('${p}',this.checked)"> <b>${p}</b></label>`).join("")}</div></div>
  <div class="field"><label>When should we send renewal reminders?</label>
  <div class="triggers">${[15,7,3,1,0].map(t=>`<label class="check ${c.triggers.includes(t)?"on":""}"><input type="checkbox" ${c.triggers.includes(t)?"checked":""} onchange="toggleTrigger(${t},this.checked)"> <b>${triggerLabel(t)}</b><small>${count(c,t)} currently eligible</small></label>`).join("")}</div>
  <div class="trigger-add"><input id="customTrigger" type="number" min="0" max="365" placeholder="e.g. 5"><button class="btn small" onclick="addCustomTrigger()">＋ Add custom trigger</button><span class="small-note">Add another value when the predefined options are not sufficient.</span></div>
  <div>${allTriggers.filter(t=>![15,7,3,1,0].includes(Number(t))).map(t=>`<span class="trigger-chip">${triggerLabel(t)} <button onclick="removeCustomTrigger(${t})">×</button></span>`).join("")}</div></div>
  <div class="field"><label>Send Through</label><div class="channels">${["WhatsApp","Email"].map(ch=>`<label class="channel ${c.channels.includes(ch)?"on":""}"><input type="checkbox" ${c.channels.includes(ch)?"checked":""} onchange="toggleChannel('${ch}',this.checked)"> <b>${ch}</b><small>${ch==="WhatsApp"?"Rampwin + Meta approved template":"ZeptoMail + email template"}</small></label>`).join("")}</div></div>
  <div class="input-row"><div class="field"><label>Send Time</label><input id="ct" type="time" value="${esc(c.time||"10:00")}"><div class="help">Time of day at which each trigger is executed.</div></div><div class="field"><label>Time Zone</label><select id="tz"><option>Asia/Kolkata (IST)</option></select><div class="help">Displayed for the demo; production uses account scheduling settings.</div></div></div>
  <div class="summary-grid"><div class="summary-box">Current Eligible Audience<b>${current}</b></div><div class="summary-box">Selected Trigger Points<b>${allTriggers.length}</b></div><div class="summary-box">Start From<b>${fmt(c.startDate||DB.TODAY)}</b></div></div>
  <div class="callout" style="margin-top:10px"><b>Renewal rule:</b> eligibility is recalculated at every trigger. If a customer renews after the 7-day reminder, they are automatically excluded from the 3-day reminder. No post-expiry reminders are sent.</div>
  <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveCampaign()">Save & Schedule Campaign</button></div></div></div>`;
}
function count(c,t){return DB.subs.filter(s=>c.products.includes(s.product)&&eligible(s,t)).length;}
function toggleProduct(p,on){let c=DB.modal.camp;if(on&&!c.products.includes(p))c.products.push(p);if(!on)c.products=c.products.filter(x=>x!==p);render();}
function toggleTrigger(t,on){let c=DB.modal.camp;if(on&&!c.triggers.includes(t))c.triggers.push(t);if(!on)c.triggers=c.triggers.filter(x=>Number(x)!==Number(t));render();}
function toggleChannel(ch,on){let c=DB.modal.camp;if(on&&!c.channels.includes(ch))c.channels.push(ch);if(!on)c.channels=c.channels.filter(x=>x!==ch);render();}
function addCustomTrigger(){let v=Number(document.getElementById("customTrigger").value);if(!Number.isInteger(v)||v<0||v>365){toast("Enter a whole number from 0 to 365.");return;}let c=DB.modal.camp;if(!c.triggers.includes(v))c.triggers.push(v);DB.modal.custom=[...(DB.modal.custom||[]),v];DB.modal.custom=[...new Set(DB.modal.custom)];render();}
function removeCustomTrigger(t){let c=DB.modal.camp;c.triggers=c.triggers.filter(x=>Number(x)!==Number(t));DB.modal.custom=(DB.modal.custom||[]).filter(x=>Number(x)!==Number(t));render();}
function saveCampaign(){
  const c=DB.modal.camp;
  c.name=document.getElementById("cn").value.trim()||"Renewal Campaign";
  c.startDate=document.getElementById("csd").value||DB.TODAY;
  c.time=document.getElementById("ct").value||"10:00";
  if(c.startDate<DB.TODAY){toast("Campaign start date cannot be before the simulated current date.");return;}
  if(!c.products.length||!c.triggers.length||!c.channels.length){toast("Select at least one product, trigger and channel.");return;}
  c.id=Date.now();c.status="Scheduled";
  DB.campaigns.push({...c,products:[...c.products],triggers:[...c.triggers],channels:[...c.channels]});
  DB.modal=null;DB.view="campaigns";toast("Campaign saved and scheduled.");
}
function clone(id){let c=DB.campaigns.find(x=>x.id===id);openCamp({...c,id:0,name:c.name+" — Clone",startDate:DB.TODAY});}
function openTemplate(){DB.modal={template:1};render();}
function templateModal(){
 return `<div class="modalbg"><div class="modal"><div class="head"><div><h2>Create New Template</h2><p>Configure a demo template for WhatsApp or Email.</p></div><button class="btn" onclick="DB.modal=null;render()">×</button></div>
 <div class="input-row"><div class="field"><label>Template Type</label><select id="ntype"><option>WhatsApp</option><option>Email</option></select></div><div class="field"><label>Product</label><select id="nproduct">${products().map(p=>`<option>${p}</option>`).join("")}</select></div></div>
 <div class="field"><label>Template Name</label><input id="nname" placeholder="e.g. spectrum_renewal_5_days"></div>
 <div class="field"><label>Email Subject <span class="small-note">(used for Email)</span></label><input id="nsubject" placeholder="Your subscription renewal reminder"></div>
 <div class="field"><label>Content</label><textarea id="ntext" rows="6">Hello {{1}}, your {{2}} subscription will expire on {{3}}. Renew before the expiry date to continue uninterrupted access.</textarea><div class="help">Supported demo variables: {{1}} Customer Name · {{2}} Product/Plan · {{3}} Plan End Date · {{4}} Days Remaining</div></div>
 <div class="callout">WhatsApp templates represent approved Meta templates sent via Rampwin. Email templates represent ZeptoMail templates. Provider sending is simulated in this prototype.</div>
 <div class="actions"><button class="btn" onclick="DB.modal=null;render()">Cancel</button><button class="btn primary" onclick="saveTemplate()">Save Template</button></div></div></div>`;
}
function saveTemplate(){
 const type=document.getElementById("ntype").value,name=document.getElementById("nname").value.trim();
 if(!name){toast("Enter a template name.");return;}
 DB.templates.push({id:Date.now(),type,product:document.getElementById("nproduct").value,name,subject:document.getElementById("nsubject").value,text:document.getElementById("ntext").value});
 DB.template=DB.templates[DB.templates.length-1].id;DB.modal=null;DB.view="templates";toast("Template created.");
}
function type(t){let x=DB.templates.find(x=>x.type===t);if(x){DB.template=x.id;render();}}
function filter(q){document.querySelectorAll(".item").forEach(x=>x.style.display=x.innerText.toLowerCase().includes(q.toLowerCase())?"block":"none");}
function run(){
 let n=0, rows=scheduleRows().filter(x=>x.d===DB.TODAY);
 rows.forEach(x=>x.s.forEach(s=>{
   x.c.channels.forEach(ch=>{
     const ok=ch==="WhatsApp"?s.waOpt:s.emailOpt;
     if(ok){DB.msg.push({d:fmt(DB.TODAY),c:x.c.name,ch,n:1,s:"Delivered"});n++;}
   });
 }));
 toast(n?`Scheduler executed: ${n} eligible communications processed.`:"No eligible communications today.");
}
function exportCSV(){
 const base=[{d:"16 Sep 2026",c:"September Renewal Journey",ch:"WhatsApp",n:84,s:"Delivered"},{d:"16 Sep 2026",c:"September Renewal Journey",ch:"Email",n:72,s:"Opened"},{d:"09 Sep 2026",c:"August Renewal Campaign",ch:"WhatsApp",n:126,s:"Delivered"},...DB.msg];
 const q=v=>`"${String(v).replace(/"/g,'""')}"`;
 const csv=["Date,Campaign,Channel,Count,Status",...base.map(x=>[x.d,x.c,x.ch,x.n,x.s].map(q).join(","))].join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="kdk-communication-history.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast("CSV exported.");
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
 (DB.modal?.camp?campaignModal():DB.modal?.template?templateModal():DB.modal?.settings?settingsModal():"")+
 (DB.toast?`<div class="toast">${esc(DB.toast)}</div>`:"");
}
window.nav=nav;window.openCamp=openCamp;window.type=type;window.filter=filter;window.run=run;window.exportCSV=exportCSV;window.openTemplate=openTemplate;window.saveTemplate=saveTemplate;window.saveCampaign=saveCampaign;window.clone=clone;window.openSettings=openSettings;window.applySettings=applySettings;window.renew=renew;window.toggleProduct=toggleProduct;window.toggleTrigger=toggleTrigger;window.toggleChannel=toggleChannel;window.addCustomTrigger=addCustomTrigger;window.removeCustomTrigger=removeCustomTrigger;
render();
})();