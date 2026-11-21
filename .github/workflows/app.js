import {totals,purchaseCost,spotChartPoints} from '/lib.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let device=localStorage.getItem('goldfolio-device');if(!device){device=crypto.randomUUID();localStorage.setItem('goldfolio-device',device);}
let state={lots:[],alerts:[]},market={history:[]},range=30;
let editingPurchaseId=null;
const money=n=>n==null?'—':new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const date=s=>new Date(s).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text){$('#message').textContent=text;$('#message').hidden=!text;}
async function api(path,method='GET',body){const r=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json','X-Device-Id':device},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;}
async function load(){try{[market,state]=await Promise.all([api('market'),api('portfolio')]);render();message(market.error?'Price refresh unavailable. '+(market.quote?'Showing the last saved quote. ':'')+market.error:'');}catch(e){message('Cannot reach the server. '+e.message);}}
function render(){
 const q=market.quote,p=q?.buyPrice,t=totals(state.lots,p);
 $('#spot').textContent=money(q?.sellPrice);$('#buyback-price').textContent='Buyback reference: '+money(q?.buyPrice)+' / gram';
 if(q){const stale=q.isStale||Date.now()-Date.parse(q.updatedAt)>(q.delayed?45:15)*60000;$('#quote-time').textContent=`${stale?'Last available quote':'HargaEmas.my quote'} · ${date(q.updatedAt)} MYT${stale?' · May be delayed':''}`;$('#source-info').textContent=q.source+'. Already quoted in MYR: no USD conversion. Portfolio values use the buyback reference; charts and alerts use the sell reference. Your online platform may quote different rates.';}
 else $('#quote-time').textContent='Waiting for the first available quote. No estimated price is substituted.';
 $('#value').textContent=money(t.value);$('#cost').textContent=money(t.cost);$('#grams').innerHTML=`${t.grams.toLocaleString('en-MY',{maximumFractionDigits:4})} <em>g</em>`;
 $('#gain').textContent=t.gain==null?'—':`${t.gain>=0?'+':''}${money(t.gain)}`;$('#gain').className=t.gain==null?'':t.gain>=0?'positive':'negative';
 $('#percent').textContent=t.percent==null?'Add a purchase to get started':`${t.percent>=0?'+':''}${t.percent.toFixed(2)}% on your investment`;$('#average').textContent=`Average cost ${money(t.average)} /g`;$('#lot-count').textContent=state.lots.length;
 $('#lots').innerHTML=state.lots.length?state.lots.slice().reverse().map(x=>{const cost=purchaseCost(x);const g=p==null?null:p*x.grams-cost;return `<article class="lot"><div><h3>${x.grams} g</h3><p>Total paid: ${money(cost)}</p>${x.note?`<p>${esc(x.note)}</p>`:''}</div><div class="right"><strong>${money(cost)}</strong><p class="${g==null?'':g>=0?'positive':'negative'}">${g==null?'Awaiting quote':`${g>=0?'+':''}${money(g)}`}</p><button class="quiet" data-edit="${x.id}">Edit</button><button class="remove" data-remove="lots/${x.id}">Delete purchase</button></div></article>`;}).join(''):`<div class="empty"><div class="symbol">◇</div><h3>Your gold journey starts here</h3><p>Log your first purchase to see its value and how it’s doing.</p><button class="primary" data-open-buy>+ Add your first purchase</button></div>`;
 $('#alert-list').innerHTML=state.alerts.length?state.alerts.slice().reverse().map(a=>`<article class="alert-row"><div><h3>Sell reference ${a.direction==='above'?'at or above':'at or below'} ${money(a.target)} /g</h3><p>${a.triggeredAt?`Reached ${date(a.triggeredAt)} MYT · ${money(a.actual)}/g`: 'Waiting for your target'}</p>${a.triggeredAt?`<p>${a.deliveredAt?'Push service accepted notification':state.subscribed?'Push delivery pending or expired':'Notifications not enabled'}</p>`:''}<button class="remove" data-remove="alerts/${a.id}">Delete alert</button></div><span class="badge">${a.triggeredAt?'Triggered':'Watching'}</span></article>`).join(''):`<div class="empty"><div class="symbol">♧</div><h3>A price in mind?</h3><p>Set a target and let Goldfolio watch the market for you.</p></div>`;
 $$('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this '+(b.dataset.remove.startsWith('lots')?'purchase':'alert')+'?'))return;try{await api(b.dataset.remove,'DELETE');await load();}catch(e){message(e.message);}});
 $$('[data-edit]').forEach(b=>b.onclick=()=>openBuy(state.lots.find(x=>x.id===b.dataset.edit)));
 $('[data-open-buy]')?.addEventListener('click',openBuy);chart();pushStatus();
}
function chart(){
 const historical=range!==1;
 const points=spotChartPoints(market,range);
 $('#chart-status').textContent=range===1?(points.length?points.length+' recorded HargaEmas quote'+(points.length===1?'':'s')+' since '+date(points[0].time)+' MYT. Earlier intraday prices are unavailable from this feed.':'No intraday quotes recorded yet.'):'Historical points are daily reference prices, not intraday movements.';
 $('#chart-value').textContent=money(market.quote?.price);
 $('#chart-label').textContent='Latest HargaEmas sell reference - RM per gram';
 $('#history-info').textContent='All prices come from HargaEmas.my. 1D records its sell reference about every two minutes while this server runs. Longer periods show daily reference prices from its chart feed, followed by recorded quotes. Daily points are identified by date; they are not intraday ticks or buyback prices. Portfolio valuation uses the separately displayed buyback reference.';
 $('#history-source').textContent=(market.historyError||'')+(market.historical?' '+market.historical.source+' - refreshed '+date(market.historical.updatedAt)+' MYT.':'');
 if(points.length===0){$('#chart').innerHTML=`<div class="empty"><h3>${historical?'Historical prices unavailable':points.length?'Your first price is recorded':'Waiting for market data'}</h3><p>${historical?(market.historyError||'Loading historical prices. Refresh in a moment.'):(points.length?'The chart appears after a second quote arrives. Your server records a price every minute.':'Keep the server running to collect real gold prices.')}</p></div>`;return;}
 const w=Math.max(280,$('#chart').clientWidth),h=300,left=55,right=12,top=20,bottom=40;let lo=Math.min(...points.map(x=>x.price)),hi=Math.max(...points.map(x=>x.price));const padding=Math.max((hi-lo)*.15,.25);lo-=padding;hi+=padding;
 const end=range===1?Date.now():Date.parse(points.at(-1).time),start=range===1||points.length===1?end-range*86400000:Date.parse(points[0].time);const x=i=>left+(Date.parse(points[i].time)-start)/(end-start)*(w-left-right);const y=p=>top+(hi-p)/(hi-lo)*(h-top-bottom);
 const d=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.price).toFixed(2)}`).join(' ');
 let grid='';for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);grid+=`<line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}" stroke="#e4ebe2" stroke-dasharray="4 5"/><text x="${left-10}" y="${yy+4}" text-anchor="end">${v.toFixed(2)}</text>`;}
 $('#chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" aria-label="Gold price, ${money(points[0].price)} to ${money(points.at(-1).price)}" role="img"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9cbe9c" stop-opacity=".4"/><stop offset="1" stop-color="#9cbe9c" stop-opacity="0"/></linearGradient></defs>${grid}${points.length>1?`<path d="${d} L ${x(points.length-1)},${h-bottom} L ${x(0)},${h-bottom} Z" fill="url(#fill)"/><path d="${d}" fill="none" stroke="#2c6748" stroke-width="2.5"/>`:""}<circle id="chart-dot" cx="${x(points.length-1)}" cy="${y(points.at(-1).price)}" r="4" fill="#b58b38"/><text x="${left}" y="${h-10}">${esc(new Date(start).toLocaleString('en-MY',range===1?{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',year:'2-digit'}))}</text><text x="${w-right}" y="${h-10}" text-anchor="end">${esc(new Date(end).toLocaleString('en-MY',range===1?{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',year:'2-digit'}))}</text></svg>`;
 $('#chart-hover').textContent=`${points.length} ${historical?'spot observations':'recorded spot quotes'} · Low ${money(lo+padding)} · High ${money(hi-padding)}`;
 if(points.length===1)$('#chart-hover').textContent='Only one recorded spot quote is available. The new HargaEmas feed is collecting data; a line appears when quotes with new timestamps arrive.';
 $('#chart svg').onpointermove=e=>{if(points.length===1)return;const rect=e.currentTarget.getBoundingClientRect(),xx=(e.clientX-rect.left)/rect.width*w;let nearest=0;for(let i=1;i<points.length;i++)if(Math.abs(x(i)-xx)<Math.abs(x(nearest)-xx))nearest=i;$('#chart-hover').textContent=`${points[nearest].precision==='day'?new Date(points[nearest].time).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'})+' (daily reference)':date(points[nearest].time)+' MYT'} · ${money(points[nearest].price)}/g`;$('#chart-dot').setAttribute('cx',x(nearest));$('#chart-dot').setAttribute('cy',y(points[nearest].price));};
}
function openBuy(purchase){
 const lot=purchase?.id?purchase:null,f=$('#buy-form');
 editingPurchaseId=lot?.id||null;f.reset();
 f.querySelector('h2').textContent=lot?'Edit gold purchase':'Add gold purchase';
 f.querySelector('.wide').textContent=lot?'Save changes':'Save purchase';
 if(lot){f.elements.grams.value=lot.grams;f.elements.totalCost.value=purchaseCost(lot);f.elements.note.value=lot.note||'';}
 f.dispatchEvent(new Event('input'));$('#buy-dialog').showModal();
}
$('#add-buy').onclick=openBuy;$('#add-alert').onclick=()=>$('#alert-dialog').showModal();$$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('.tab').forEach(t=>t.hidden=t.id!==b.dataset.tab);$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.tab==='market')chart();});
$$('[data-range]').forEach(b=>b.onclick=()=>{range=Number(b.dataset.range);$$('[data-range]').forEach(x=>x.classList.toggle('active',x===b));chart();});
$('#buy-form').oninput=()=>{const f=$('#buy-form');const grams=Number(f.elements.grams.value),cost=Number(f.elements.totalCost.value);$('#buy-total').textContent=grams>0&&cost>0?'Calculated average: '+money(cost/grams)+' /g':'Enter grams and the total amount you paid.';};
for(const [form,route] of [['buy-form','lots'],['alert-form','alerts']])$('#'+form).onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button.wide');b.disabled=true;const data=Object.fromEntries(new FormData(f));for(const key of ['grams','totalCost','target'])if(key in data)data[key]=Number(data[key]);try{const editId=form==='buy-form'?editingPurchaseId:null;await api(editId?'lots/'+editId:route,editId?'PATCH':'POST',data);f.closest('dialog').close();if(form==='buy-form')editingPurchaseId=null;f.reset();await load();}catch(e){alert(e.message);}finally{b.disabled=false;}};
$('#refresh').onclick=async()=>{$('#refresh').disabled=true;await load();$('#refresh').disabled=false;};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),lots:state.lots,alerts:state.alerts},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='goldfolio-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function pushStatus(){const supported=window.isSecureContext&&'serviceWorker'in navigator&&'PushManager'in window;$('#enable-push').disabled=!supported;$('#enable-push').textContent=state.subscribed?'Reconnect notifications':'Enable notifications';$('#test-push').hidden=!state.subscribed;$('#push-status').textContent=!supported?'Phone notifications need HTTPS and a supported browser. On iPhone, add this app to your Home Screen first.':state.subscribed?'This device is subscribed. Send a test to confirm delivery on your phone.':'Enable notifications on this phone. On iPhone, install to Home Screen first (iOS 16.4+).';}
$('#enable-push').onclick=async()=>{try{
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Notifications were not allowed. You can change this in browser or phone settings.');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub){const b64=market.publicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});}
 await api('subscription','POST',sub.toJSON());await load();message('Notifications enabled. Send a test to check your phone.');
 }catch(e){message(e.message);}};
$('#test-push').onclick=async()=>{try{await api('test-push','POST',{});message('Test sent to the push service. Check your phone.');}catch(e){message(e.message);}};
if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(e=>message('Offline support unavailable: '+e.message));
await load();setInterval(load,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});

window.addEventListener('resize',chart);
