(function(){
"use strict";
const DB = window.DB;
let view = "dashboard";
let templateChannel = "WhatsApp";
let modal = null;
const app = document.getElementById("app");
const nav = document.getElementById("nav");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toast-root");

function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function daysBetween(a,b){return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000);}
function toast(msg){toastRoot.innerHTML='<div class="toast">'+esc(msg)+'</div>';setTimeout(()=>toastRoot.innerHTML="",2400);}
function setView(v){view=v;modal=null;render();}
function eligible(sub,campaign,trigger){
  const end=sub[2], renewed=Number(sub[5])===1;
  return !renewed && campaign.products.includes(sub[1]) && daysBetween(DB.today,end)===Number(trigger);
}
function scheduleRows(){
  const rows=[];
  DB.campaigns.forEach(c=>c.triggers.forEach(t=>{
    const eligibleSubs=DB.subs.filter(s=>eligible(s,c,t));
    rows.push({campaign:c,trigger:Number(t),subs:eligibleSubs});
  }));
  return rows;
}
function navHtml(){
  const items=[["dashboard","Dashboard"],["templates","Templates"],["campaigns","Campaign Manager"],["scheduler","Schedule"],["history","History"]];
  nav.innerHTML=items.map(([id,label])=>`<button class="${view===id?"activeNav":""}" data-go="${id}">${label}</button>`).join("");
}
function top(title,subtitle,action){
  return `<div class="top"><div><h1>${title}</h1><p class="muted">${subtitle}</p></div>${action||""}</div>`;
}
function dashboard(){
  const active=DB.subs.filter(s=>Number(s[5])===0 && new Date(s[2])>=new Date(DB.today)).length;
  const renewed=DB.subs.filter(s=>Number(s[5])===1).length;
  return top("Communication Dashboard","Renewal communication overview using Subscription Master data.",'<button class="primary" data-action="create-campaign">＋ Create Campaign</button>')+
  `<div class="grid">
    <div class="card metric">Active subscriptions<b>${active}</b></div>
    <div class="card metric">Renewed<b>${renewed}</b></div>
    <div class="card metric">Scheduled campaigns<b>${DB.campaigns.length}</b></div>
    <div class="card metric">Communication events<b>${DB.history.length}</b></div>
  </div>
  <div class="card" style="margin-top:18px"><h3>Upcoming Renewal Eligibility</h3>${scheduleTable()}</div>`;
}
function scheduleTable(){
  const rows=scheduleRows();
  if(!rows.length)return '<p class="muted">No scheduled triggers.</p>';
  return `<div class="tableWrap"><table class="table"><tr><th>Campaign</th><th>Trigger</th><th>Eligible</th><th>WhatsApp</th><th>Email</th></tr>`+
  rows.map(r=>`<tr><td>${esc(r.campaign.name)}</td><td>${r.trigger===0?"On Plan End Date":r.trigger+" Days Before"}</td><td><b>${r.subs.length}</b></td><td>${r.subs.filter(s=>s[3]&&r.campaign.channels.includes("WhatsApp")).length}</td><td>${r.subs.filter(s=>s[4]&&r.campaign.channels.includes("Email")).length}</td></tr>`).join("")+
  '</table></div>';
}
function templates(){
  const list=DB.templates.filter(x=>x[1]===templateChannel);
  return top("Templates","WhatsApp templates use Rampwin/Meta; email templates use ZeptoMail.",'<button class="primary" data-action="new-template">＋ New Template</button>')+
  `<div class="tabs"><button class="${templateChannel==="WhatsApp"?"activeNav":""}" data-template="WhatsApp">WhatsApp Templates</button><button class="${templateChannel==="Email"?"activeNav":""}" data-template="Email">Email Templates</button></div>
  <div class="tableWrap"><table class="table"><tr><th>Name</th><th>Channel</th><th>Product</th><th>Action</th></tr>${list.map((t,i)=>`<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td><button data-preview="${DB.templates.indexOf(t)}">View</button></td></tr>`).join("")}</table></div>`;
}
function campaigns(){
  return top("Campaign Manager","One campaign can contain multiple reminder points relative to each Plan End Date.",'<button class="primary" data-action="create-campaign">＋ Create Campaign</button>')+
  `<div class="tableWrap"><table class="table"><tr><th>Campaign</th><th>Products</th><th>Triggers</th><th>Channels</th><th>Time</th></tr>${DB.campaigns.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${c.products.map(esc).join(", ")}</td><td>${c.triggers.map(t=>`<span class="badge">${t===0?"Expiry":t+"d"}</span>`).join("")}</td><td>${c.channels.join(" + ")}</td><td>${esc(c.time)}</td></tr>`).join("")}</table></div>`;
}
function scheduler(){
  return top("Schedule","Eligibility is recalculated against the current Subscription Master before every execution.",'<button class="primary" data-action="run-scheduler">▶ Run Scheduler</button>')+
  `<div class="card" style="margin-top:18px"><div class="field"><label>Simulation Date</label><input id="simDate" type="date" value="${esc(DB.today)}"></div>${scheduleTable()}</div>`;
}
function history(){
  return top("History","Simulated communication execution and provider delivery records.",'<button data-action="export-csv">⇩ Export to CSV</button>')+
  `<div class="tableWrap"><table class="table"><tr><th>Date</th><th>Customer</th><th>Campaign</th><th>Channel</th><th>Status</th></tr>${DB.history.map(h=>`<tr>${h.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</table></div>`;
}
function campaignModal(){
  return `<div class="modalbg"><div class="modal"><h2>Create Renewal Campaign</h2>
  <div class="field"><label>Campaign Name</label><input id="campName" value="New Renewal Campaign"></div>
  <div class="field"><label>Products</label><div class="checks">${["Spectrum","ExpressGST","ZenTDS","PDF Signer"].map(p=>`<label class="check"><input name="product" type="checkbox" value="${p}" checked> ${p}</label>`).join("")}</div></div>
  <div class="field"><label>When should we send renewal reminders?</label><div class="checks">${[15,7,3,1,0].map(t=>`<label class="check"><input name="trigger" type="checkbox" value="${t}" ${[7,3].includes(t)?"checked":""}> ${t===0?"On Plan End Date":t+" Days Before Expiry"}</label>`).join("")}</div></div>
  <div class="field"><label>Send Through</label><div class="checks"><label class="check"><input name="channel" type="checkbox" value="WhatsApp" checked> WhatsApp</label><label class="check"><input name="channel" type="checkbox" value="Email" checked> Email</label></div></div>
  <div class="field"><label>Send Time</label><input id="campTime" type="time" value="10:00"></div>
  <p class="muted">Renewed customers are excluded automatically from later triggers. No post-expiry reminders are sent.</p>
  <div class="actions"><button data-action="close-modal">Cancel</button><button class="primary" data-action="save-campaign">Save & Schedule</button></div></div></div>`;
}
function templateModal(){
  return `<div class="modalbg"><div class="modal"><h2>New Template</h2>
  <div class="field"><label>Template Type</label><select id="tplType"><option>WhatsApp</option><option>Email</option></select></div>
  <div class="field"><label>Template Name</label><input id="tplName" placeholder="e.g. renewal_1_day"></div>
  <div class="field"><label>Product</label><select id="tplProduct"><option>Spectrum</option><option>ExpressGST</option><option>ZenTDS</option><option>PDF Signer</option></select></div>
  <div class="field"><label>Email Subject</label><input id="tplSubject" placeholder="Renewal reminder"></div>
  <div class="field"><label>Content</label><textarea id="tplContent" rows="6">Hello {{customer_name}}, your {{product}} subscription expires on {{plan_end_date}}.</textarea></div>
  <div class="actions"><button data-action="close-modal">Cancel</button><button class="primary" data-action="save-template">Save Template</button></div></div></div>`;
}
function previewModal(t){
  return `<div class="modalbg"><div class="modal"><h2>${esc(t[0])}</h2><p><b>Channel:</b> ${esc(t[1])}</p><p><b>Product:</b> ${esc(t[2])}</p><div class="card">Template preview for ${esc(t[0])}</div><div class="actions"><button class="primary" data-action="close-modal">Close</button></div></div></div>`;
}
function render(){
  navHtml();
  let body=view==="dashboard"?dashboard():view==="templates"?templates():view==="campaigns"?campaigns():view==="scheduler"?scheduler():history();
  app.innerHTML=body;
  modalRoot.innerHTML=modal?(modal.type==="campaign"?campaignModal():modal.type==="template"?templateModal():previewModal(modal.template)):"";
}
function saveCampaign(){
  const products=[...document.querySelectorAll('[name="product"]:checked')].map(x=>x.value);
  const triggers=[...document.querySelectorAll('[name="trigger"]:checked')].map(x=>Number(x.value));
  const channels=[...document.querySelectorAll('[name="channel"]:checked')].map(x=>x.value);
  if(!products.length||!triggers.length||!channels.length){toast("Select at least one product, trigger and channel.");return;}
  DB.campaigns.push({name:document.getElementById("campName").value.trim()||"Renewal Campaign",products,triggers,channels,time:document.getElementById("campTime").value||"10:00"});
  setView("campaigns");toast("Campaign saved and scheduled.");
}
function saveTemplate(){
  const name=document.getElementById("tplName").value.trim();
  if(!name){toast("Enter a template name.");return;}
  const type=document.getElementById("tplType").value;
  DB.templates.push([name,type,document.getElementById("tplProduct").value]);
  templateChannel=type;setView("templates");toast("Template created.");
}
function runScheduler(){
  let events=0;
  scheduleRows().forEach(r=>r.subs.forEach(s=>{
    r.campaign.channels.forEach(ch=>{
      const opt=ch==="WhatsApp"?Number(s[3])===1:Number(s[4])===1;
      if(opt){DB.history.unshift([DB.today+" "+r.campaign.time,s[0],r.campaign.name,ch,"Simulated Sent"]);events++;}
    });
  }));
  render();toast(events?events+" simulated communication(s) created.":"Scheduler completed: no customers eligible today.");
}
function exportCSV(){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  const csv=["Date,Customer,Campaign,Channel,Status",...DB.history.map(r=>r.map(q).join(","))].join("\\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="kdk-communication-history.csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast("CSV exported.");
}
document.addEventListener("click",function(e){
  const go=e.target.closest("[data-go]"); if(go){setView(go.dataset.go);return;}
  const tt=e.target.closest("[data-template]"); if(tt){templateChannel=tt.dataset.template;render();return;}
  const pv=e.target.closest("[data-preview]"); if(pv){modal={type:"preview",template:DB.templates[Number(pv.dataset.preview)]};render();return;}
  const action=e.target.closest("[data-action]"); if(!action)return;
  const a=action.dataset.action;
  if(a==="create-campaign"||a==="new-template"){modal={type:a==="create-campaign"?"campaign":"template"};render();}
  else if(a==="close-modal"){modal=null;render();}
  else if(a==="save-campaign")saveCampaign();
  else if(a==="save-template")saveTemplate();
  else if(a==="run-scheduler")runScheduler();
  else if(a==="export-csv")exportCSV();
});
document.addEventListener("change",function(e){
  if(e.target.id==="simDate"){DB.today=e.target.value;render();toast("Simulation date updated.");}
});
render();
})();