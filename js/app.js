// ── MASTER LISTS (cWorx exact) ───────────────────────────────────
var CWORX_TRADES = [
  'Foreman','Laborers','Operating Engineer','Flagger',
  'Welders','Fuser','Chauffeur','Maintenance Engineer',
  'Crane Operator','Drill Runner','Electrician','Engineer',
  'Coaters','Police Support','Pump Engineer','Sawcutter',
  'Timberman','Administration','Other'
];
var CWORX_EQUIPMENT = [
  'Pick Up Truck','Backhoe','Compressor Truck','Box Truck',
  'Weld Truck','Dump Truck','Boom Truck','Flatbed Truck',
  'Attenuator Truck','Crane','Excavator','Vacuum Truck',
  'Van','Zim Mixer','Light Tower','Plate Tamper',
  'Port Compressor','Pumps','Rocksplitter','Sawcut Equipment','Other'
];
// Default crew pre-fill: [{name, count}]
var DEFAULT_TRADES = [{n:'Foreman',c:1},{n:'Operating Engineer',c:1},{n:'Laborers',c:4},{n:'Flagger',c:2},{n:'Chauffeur',c:1}];
var DEFAULT_EQUIP  = [{n:'Pick Up Truck',c:1},{n:'Backhoe',c:1},{n:'Compressor Truck',c:1},{n:'Dump Truck',c:1}];
// Nudge rules
var NUDGE = {
  'Welders':             'Welders added — add Weld Truck?',
  'Chauffeur':           'Chauffeur added — add a CDL truck (Dump, Boom, Flatbed, or Zim Mixer)?',
  'Maintenance Engineer':'Maintenance Engineer added — add Compressor Truck?',
  'Operating Engineer':  'Operating Engineer added — add Backhoe?',
  'Foreman':             'Foreman added — add Pick Up Truck?',
  'Laborers':            'Laborers added — add Compressor Truck or Box Truck?'
};

function getData(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function setData(k,v){localStorage.setItem(k,JSON.stringify(v));}
var trades    = getData('dlr_trades', CWORX_TRADES);
var equipment = getData('dlr_equipment', CWORX_EQUIPMENT);
var logs      = getData('dlr_logs', []);
var currentCrews = [];
var editingList  = null;
var allData = {};
// Picker state
var pickerCrewId = null;
var pickerType   = null;

// ── PERSISTENCE (survive iOS dropping the app from memory) ───────
// The parsed route (allData) and the in-progress DLR (currentCrews) used to
// live only in memory, so iOS reclaiming RAM wiped them on the next reload.
// We now mirror both into localStorage and restore on launch, so the Route
// tab stays populated and the DLR stays intact until a new file is loaded.
// Each job row is an Array carrying a custom `_co` (contractor) property,
// which JSON.stringify silently drops. Capture/reattach it around save/restore.
function coArr(rows){return (rows||[]).map(function(r){return r._co||'';});}
function saveRoute(){
  try{
    if(!allData||!allData.headers)return;
    var snap={};for(var k in allData){if(allData.hasOwnProperty(k))snap[k]=allData[k];}
    snap._coFlavin=coArr(allData.flavin);
    snap._coOwned=coArr(allData.owned);
    setData('dlr_route',snap);
  }catch(e){}
}
function clearRoute(){try{localStorage.removeItem('dlr_route');}catch(e){}}
function restoreRoute(){
  var r=getData('dlr_route',null);
  if(!r||!r.headers)return;
  if(r.flavin&&r._coFlavin)r.flavin.forEach(function(row,i){row._co=r._coFlavin[i]||'';});
  if(r.owned&&r._coOwned)r.owned.forEach(function(row,i){row._co=r._coOwned[i]||'';});
  if(r.sheets)Object.keys(r.sheets).forEach(function(sn){var sd=r.sheets[sn];if(sd&&sd.jobs)sd.jobs.forEach(function(row){row._co=sd.company||sn;});});
  allData=r;
  renderRouteResults();
}
function saveWorkingDLR(){try{var d=document.getElementById('log-date');setData('dlr_working',{date:d?d.value:today(),crews:currentCrews});}catch(e){}}
function clearWorkingDLR(){try{localStorage.removeItem('dlr_working');}catch(e){}}
function restoreWorkingDLR(){
  var w=getData('dlr_working',null);
  if(w&&w.crews&&w.crews.length){
    currentCrews=w.crews;
    if(w.date){document.getElementById('log-date').value=w.date;updateDateDisplay();}
    return true;
  }
  return false;
}

function showPage(p){
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(el){el.classList.remove('active');});
  document.getElementById('page-'+p).classList.add('active');
  document.getElementById('nav-'+p).classList.add('active');
  updateSyncStamps();
  if(p==='history')renderHistory();
  if(p==='dlr'){var d=document.getElementById('log-date');if(d&&d.value)mileDate=d.value;renderMileage();maybeNotifyDraft();}
  if(p==='month')renderMonth();
  if(p==='settings'){updateSettingsCounts();renderProfile();}
}

// ── MILEAGE ──────────────────────────────────────────────────────
// Daily odometer capture. Stops pre-load from that date's DLR job locations;
// miles = difference between consecutive odometer readings. Foundation for the
// CI Mileage Form and Daily Log.
var mileDate=today();
function allMileage(){return getData('dlr_mileage',{});}
function mileSetDate(d){if(d){mileDate=d;renderMileage();}}
function mileStep(n){var dt=new Date(mileDate+'T12:00:00');dt.setDate(dt.getDate()+n);mileDate=dt.toISOString().split('T')[0];renderMileage();}
function milePrevEntry(date){var m=allMileage(),best=null;Object.keys(m).forEach(function(k){if(k<date&&(!best||k>best))best=k;});return best?m[best]:null;}
function mileSum(e){var t=0;((e&&e.stops)||[]).forEach(function(s,i){if(i===0)return;if(s.mi!==''&&s.mi!=null&&!isNaN(+s.mi))t+=+s.mi;});return t;}
function mileEndOdo(e){if(!e)return '';var so=e.startOdo;if(so===''||so==null||isNaN(+so))return '';return +so+mileSum(e);}
function mileSetStart(val){var e=currentMileEntry();val=(''+val).trim();e.startOdo=(val===''?'':(isNaN(+val)?e.startOdo:+val));saveMileageEntry(e);renderMileage();}
var MILE_SHIFTS=['2 - 07:00-15:00','3 - 15:00-23:00','1 - 23:00-07:00'];
var MILE_OT=['0','0.5','1','1.5','2','2.5','3','3.5','4','4.5','5'];
var MILE_POET=['XCMG - 216172870002','MP - 228728990001','BOTH'];
var MILE_CCI=['K. Garcia','E. Kelly','V. Cornwall','J. Connors'];
var MILE_WORKCODE=['Field','Training','Office','CFOR','WFH','Vacation','Holiday','NY-PFL'];
// Day's stops come from the loaded route sheet (available all day); fall back to a
// submitted DLR log only for past dates whose route is no longer loaded.
function mileStopSource(date){
  var seen={},out=[];
  function add(loc,tkt){loc=(loc||'').trim();if(!loc)return;var sl=shortAddr(loc);if(seen[sl])return;seen[sl]=1;out.push({loc:sl,ticket:cleanTicket(tkt)});}
  var ld=(document.getElementById('log-date')||{}).value;
  // 1) the DLR crews you're building today (one source — no double entry)
  if(currentCrews&&currentCrews.length&&ld===date){currentCrews.forEach(function(c){add(c.location,c.wo);});}
  // 2) the loaded route sheet for that date
  if(!out.length&&allData&&allData.routeDate===date&&allData.flavin&&allData.headers){
    var h=allData.headers;allData.flavin.forEach(function(row){add(gv(row,h,'Location'),gv(row,h,'Ticket #'));});
  }
  // 3) a previously submitted DLR log
  if(!out.length){var log=logs.find(function(l){return l.date===date;});if(log)(log.crews||[]).forEach(function(c){add(c.location,c.wo);});}
  return out;
}
function buildDefaultMileage(date){
  var prev=milePrevEntry(date);
  var e={date:date,shift:prev?(prev.shift||''):'',cci:prev?(prev.cci||''):'',poet:prev?(prev.poet||''):'',workCode:prev?(prev.workCode||'Field'):'Field',ot:'',expenses:'',expItems:'',notes:'',startOdo:mileEndOdo(prev),stops:[]};
  mileStopSource(date).forEach(function(s){e.stops.push({loc:s.loc,ticket:s.ticket,mi:'',remarks:''});});
  if(e.stops.length===0)e.stops.push({loc:'',ticket:'',mi:'',remarks:''});
  return e;
}
function currentMileEntry(){
  var m=allMileage();
  var e=m[mileDate]?JSON.parse(JSON.stringify(m[mileDate])):buildDefaultMileage(mileDate);
  (e.stops||[]).forEach(function(s){s.loc=shortAddr(s.loc||'');s.ticket=cleanTicket(s.ticket||'');}); // clean old saved data too
  return e;
}
function saveMileageEntry(e){e.savedAt=new Date().toISOString();var m=allMileage();m[e.date]=e;setData('dlr_mileage',m);syncPushMileage();}
function mileTotal(e){return mileSum(e);}
function mileSetField(field,val){var e=currentMileEntry();e[field]=val;saveMileageEntry(e);renderMileage();}
function mileSetStop(i,field,val){var e=currentMileEntry();if(!e.stops[i])return;if(field==='mi'){val=(''+val).trim();e.stops[i].mi=(val===''?'':(isNaN(+val)?e.stops[i].mi:+val));}else e.stops[i][field]=val;saveMileageEntry(e);renderMileage();}
function mileAddStop(){var e=currentMileEntry();e.stops.push({loc:'',ticket:'',mi:'',remarks:''});saveMileageEntry(e);renderMileage();}
function mileAddLoc(v){if(!v)return;var p=v.split('~');var e=currentMileEntry();e.stops.push({loc:p[0]||'',ticket:p[1]||'',mi:'',remarks:''});saveMileageEntry(e);renderMileage();}
function mileDelStop(i){var e=currentMileEntry();e.stops.splice(i,1);if(e.stops.length===0)e.stops.push({loc:'',ticket:'',mi:'',remarks:''});saveMileageEntry(e);renderMileage();}
function mileMoveStop(i,dir){var e=currentMileEntry();var j=i+dir;if(j<0||j>=e.stops.length)return;var t=e.stops[i];e.stops[i]=e.stops[j];e.stops[j]=t;saveMileageEntry(e);renderMileage();}
function mileDupStop(i){var e=currentMileEntry();var s=e.stops[i];if(!s)return;e.stops.splice(i+1,0,{loc:s.loc,ticket:s.ticket,mi:'',remarks:s.remarks});saveMileageEntry(e);renderMileage();}
function mileLoadFromLog(){
  var e=currentMileEntry(),src=mileStopSource(mileDate);
  if(!src.length){showToast('Load the route sheet for this day first');return;}
  var have={};e.stops.forEach(function(s){if(s.loc)have[s.loc.trim()]=1;});var added=0;
  src.forEach(function(s){if(!have[s.loc]){have[s.loc]=1;e.stops.push({loc:s.loc,ticket:s.ticket,mi:'',remarks:''});added++;}});
  saveMileageEntry(e);renderMileage();showToast(added?('Added '+added+' stop'+(added!==1?'s':'')):'Stops already loaded');
}
function mileMonthTotal(date){var ym=date.slice(0,7),m=allMileage(),t=0;Object.keys(m).forEach(function(k){if(k.slice(0,7)===ym)t+=mileTotal(m[k]);});return t;}
// ── CI MILEAGE FORM (CI-660-1) — print/PDF, the user's own layout ──
function monthDayCount(ym){return new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();}
function buildCIMileageHTML(ym){
  var p=getProfile(),m=allMileage(),days=monthDayCount(ym);
  var monthName=new Date(ym+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
  var rows='',gTot=0;
  for(var d=1;d<=days;d++){
    var ds=ym+'-'+('0'+d).slice(-2),e=m[ds],start='N/A',end='N/A',tot=0;
    if(e){var so=e.startOdo;if(so!==''&&so!=null&&!isNaN(+so)){start=+so;var eo=mileEndOdo(e);end=(eo===''?+so:eo);}tot=mileTotal(e)||0;}
    gTot+=(+tot||0);
    var dt=new Date(ds+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    rows+='<tr><td>'+d+'</td><td>'+start+'</td><td>'+end+'</td><td>'+tot+'</td><td>NRQ</td><td>0</td><td>'+tot+'</td><td>See Daily Log Sheet</td><td>'+dt+'</td></tr>';
  }
  function hc(v,l){return '<td><b>'+escHtml(v||'')+'</b><div class="cil">'+l+'</div></td>';}
  return '<div class="ci-form">'+
    '<div class="ci-title">CI-660-1, &ldquo;REIMBURSEMENT FOR FREQUENT USE OF PERSONAL VEHICLE ON COMPANY BUSINESS&rdquo;</div>'+
    '<div class="ci-sub">DAILY MILEAGE REPORT</div>'+
    '<table class="ci-head">'+
      '<tr>'+hc(p.name,"Employee's Name")+hc(p.empNo,'Employees No.')+hc(p.roll,'Roll No. and Dept.')+'</tr>'+
      '<tr>'+hc(p.vehicle,'Auto Make &amp; Year')+hc(p.plate,'License Plate No.')+hc(monthName,'Month / Year')+'</tr>'+
    '</table>'+
    '<table class="ci-tbl"><thead>'+
      '<tr><th rowspan="2">DATE</th><th colspan="2">ODOMETER READINGS</th><th rowspan="2">TOTAL MILEAGE DRIVEN IN AUTO</th><th colspan="3">MILEAGE ANALYSIS</th><th rowspan="2">EXPLANATION OF COMPANY BUSINESS MILEAGE</th><th rowspan="2">DATE</th></tr>'+
      '<tr><th>START</th><th>END</th><th>FROM HOME TO WORK OUT &amp; RETURN</th><th>OTHER NON-BUSINESS MILEAGE</th><th>COMPANY BUSINESS MILEAGE</th></tr>'+
    '</thead><tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td></td><td colspan="2">GRAND TOTALS</td><td>'+gTot+'</td><td>0</td><td>0</td><td>'+gTot+'</td><td></td><td></td></tr></tfoot></table>'+
    '<div class="ci-decl">I DECLARE THE INFORMATION ON THIS REPORT IS TRUE, CORRECT, AND COMPLETE TO THE BEST OF MY KNOWLEDGE AND BELIEF.</div>'+
    '<div class="ci-sig"><span>Date: ______________</span><span>Print name: '+escHtml(p.name||'')+'</span><span>Signature: ______________</span></div>'+
  '</div>';
}
function exportCIMileage(){
  var pa=document.getElementById('printArea');if(!pa)return;
  pa.innerHTML=buildCIMileageHTML(monthYM);
  setTimeout(function(){window.print();},40);
}
// ── MONTH overview (live mileage roll-up + form export) ──
var monthYM=today().slice(0,7);
function monthStep(k){var p=monthYM.split('-');var d=new Date(+p[0],(+p[1]-1)+k,1);monthYM=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);renderMonth();}
function renderMonth(){
  var disp=document.getElementById('month-display'),body=document.getElementById('month-body');
  if(!body)return;
  var d0=new Date(monthYM+'-01T12:00:00');
  if(disp)disp.textContent=d0.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  var m=allMileage(),days=monthDayCount(monthYM),p=getProfile(),rows='',tot=0;
  for(var d=1;d<=days;d++){
    var ds=monthYM+'-'+('0'+d).slice(-2),e=m[ds];
    var mi=e?mileTotal(e):0,start=(e&&e.startOdo!==''&&e.startOdo!=null&&!isNaN(+e.startOdo))?+e.startOdo:'',end=e?mileEndOdo(e):'';
    tot+=(+mi||0);
    var dt=new Date(ds+'T12:00:00');
    rows+='<tr'+(mi>0?'':' class="mz-0"')+'><td>'+d+'</td><td>'+dt.toLocaleDateString('en-US',{weekday:'short'})+'</td><td>'+(start===''?'—':start)+'</td><td>'+(end===''?'—':end)+'</td><td><b>'+mi+'</b></td></tr>';
  }
  body.innerHTML=
    '<div class="mz-prof">'+escHtml(p.name||'')+' · '+escHtml(p.vehicle||'')+' · '+escHtml(p.plate||'')+' · Emp '+escHtml(p.empNo||'')+'</div>'+
    '<table class="mz-tbl"><thead><tr><th>Day</th><th></th><th>ODO Start</th><th>ODO End</th><th>Miles</th></tr></thead><tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td colspan="4">Total business miles</td><td><b>'+tot+'</b></td></tr><tr><td colspan="4">Reimbursement @ $0.70/mi</td><td><b>$'+(tot*0.7).toFixed(2)+'</b></td></tr></tfoot></table>'+
    '<div style="padding:16px 12px 24px"><button class="btn btn-green" style="width:100%;justify-content:center" onclick="exportCIMileage()">CI Mileage Form — '+d0.toLocaleDateString('en-US',{month:'long'})+' (PDF)</button></div>';
}
function mileDaysWithStops(){var m=allMileage(),ym=mileDate.slice(0,7),out=[];Object.keys(m).sort().reverse().forEach(function(k){if(k!==mileDate&&k.slice(0,7)===ym&&(m[k].stops||[]).some(function(s){return s.loc;}))out.push(k);});return out;}
function mileCopyFrom(date){var src=allMileage()[date];if(!src)return;var e=currentMileEntry();e.stops=(src.stops||[]).map(function(s){return {loc:s.loc||'',ticket:s.ticket||'',mi:'',remarks:s.remarks||''};});saveMileageEntry(e);renderMileage();showToast('Copied '+e.stops.length+' stops');}
function mileMapStops(){
  var e=currentMileEntry();
  var stops=(e.stops||[]).map(function(s){return s.loc?shortAddr(s.loc):'';}).filter(Boolean)
    .map(function(s){return /bronx|queens|brooklyn|manhattan|ny/i.test(s)?s:s+', Bronx, NY';});
  if(!stops.length){showToast('Add stops first');return;}
  openMapsWith(stops);
}
function renderMileage(){
  var disp=document.getElementById('mile-display'),di=document.getElementById('mile-date'),body=document.getElementById('mileage-body');
  if(!body)return;
  if(disp)disp.textContent=fmtDate(mileDate);
  if(di)di.value=mileDate;
  var e=currentMileEntry();
  function sel(field,list,ph){return '<select class="mile-sel" onchange="mileSetField(\''+field+'\',this.value)"><option value="">'+ph+'</option>'+list.map(function(o){return '<option'+(String(e[field]||'')===o?' selected':'')+'>'+escHtml(o)+'</option>';}).join('')+'</select>';}
  function f(label,inner){return '<label class="mile-f"><span>'+label+'</span>'+inner+'</label>';}
  var h='<div class="mile-card">'+
      '<div class="mile-ot"><span class="mile-ot-l">Overtime Hours</span>'+
        '<input class="mile-ot-sel" inputmode="decimal" placeholder="0" value="'+escHtml(e.ot||'')+'" onchange="mileSetField(\'ot\',this.value)"></div>'+
      '<div class="mile-fields">'+
        f('Shift',sel('shift',MILE_SHIFTS,'—'))+
        f('Work Code',sel('workCode',MILE_WORKCODE,'—'))+
        f('Contact',sel('cci',MILE_CCI,'—'))+
        f('POET #',sel('poet',MILE_POET,'—'))+
      '</div>'+
      '<div class="mile-extra">'+
        '<input class="field-input mile-mini" inputmode="decimal" placeholder="Expenses $" value="'+escHtml(e.expenses||'')+'" onchange="mileSetField(\'expenses\',this.value)">'+
        '<input class="field-input mile-mini" placeholder="Expensed items" value="'+escHtml(e.expItems||'')+'" onchange="mileSetField(\'expItems\',this.value)">'+
      '</div>'+
      '<input class="field-input mile-mini" style="margin-top:6px" placeholder="Notes" value="'+escHtml(e.notes||'')+'" onchange="mileSetField(\'notes\',this.value)">'+
      '<div class="mile-carry">Header carried from your last day — change a field to set just today</div>'+
  '</div>';
  h+='<div class="mile-card"><div class="mile-rowhdr"><span>Stops — miles driven</span><span>'+mileTotal(e)+' mi</span></div>';
  h+='<label class="mile-f" style="margin-bottom:12px"><span>Start odometer (first stop)</span><input class="mile-sel" inputmode="numeric" placeholder="e.g. 72388" value="'+(e.startOdo===''||e.startOdo==null?'':e.startOdo)+'" onchange="mileSetStart(this.value)"></label>';
  var cum=(e.startOdo!==''&&e.startOdo!=null&&!isNaN(+e.startOdo))?+e.startOdo:null;
  var n=e.stops.length;
  h+='<div class="ms-list">';
  e.stops.forEach(function(s,i){
    if(i>0&&cum!==null&&s.mi!==''&&s.mi!=null&&!isNaN(+s.mi))cum+=+s.mi;
    var isStart=(i===0);
    h+='<div class="ms-row'+(isStart?' ms-start':'')+'">'+
      '<span class="ms-ctl-l">'+
        (isStart?'<span class="ms-star">★</span>':(i>=1?'<button class="ms-ic" onclick="mileMoveStop('+i+',-1)">↑</button>':'<span class="ms-ic-sp"></span>'))+
        (i<n-1?'<button class="ms-ic" onclick="mileMoveStop('+i+',1)">↓</button>':'<span class="ms-ic-sp"></span>')+
      '</span>'+
      '<div class="ms-loc"><input class="field-input" placeholder="'+(isStart?'Start (first job)':'Location')+'" value="'+escHtml(s.loc||'')+'" onchange="mileSetStop('+i+',\'loc\',this.value)">'+(s.ticket?'<span class="ms-tkt">'+escHtml(s.ticket)+'</span>':'')+'</div>'+
      '<input class="field-input ms-cmt" placeholder="comments" value="'+escHtml(s.remarks||'')+'" onchange="mileSetStop('+i+',\'remarks\',this.value)">'+
      (isStart?'<span class="ms-mi ms-start-lbl">START</span>':'<input class="field-input ms-mi" inputmode="numeric" placeholder="mi" value="'+(s.mi===''||s.mi==null?'':s.mi)+'" onchange="mileSetStop('+i+',\'mi\',this.value)">')+
      '<button class="ms-ic ms-del" onclick="mileDelStop('+i+')">×</button>'+
    '</div>';
  });
  h+='</div>';
  var copyDays=mileDaysWithStops();
  var copySel=copyDays.length?('<select class="mile-sel mile-copy" onchange="mileCopyFrom(this.value);this.value=\'\'"><option value="">Copy stops from another day…</option>'+copyDays.map(function(k){return '<option value="'+k+'">'+new Date(k+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</option>';}).join('')+'</select>'):'';
  var addLocs=mileStopSource(mileDate);
  var addSel=addLocs.length?('<select class="mile-sel" style="margin-top:8px" onchange="mileAddLoc(this.value);this.value=\'\'"><option value="">+ Add stop from a job location…</option>'+addLocs.map(function(o){return '<option value="'+escHtml(o.loc)+'~'+escHtml(o.ticket||'')+'">'+escHtml(o.loc)+'</option>';}).join('')+'</select>'):'';
  h+='<div class="mile-actions"><button class="btn btn-secondary btn-sm" onclick="mileAddStop()">+ Add blank</button><button class="btn btn-secondary btn-sm" onclick="mileLoadFromLog()">Load all from crews</button><button class="btn btn-green btn-sm" onclick="mileMapStops()">Map drive</button></div>'+
     addSel+
     (copySel?'<div style="margin-top:8px">'+copySel+'</div>':'')+
     '<div class="mile-total">'+mileTotal(e)+' mi today'+(mileEndOdo(e)!==''?' · ends '+mileEndOdo(e):'')+'</div></div>';
  var prevEnd=mileEndOdo(milePrevEntry(mileDate));
  h+='<div class="mile-foot"><div><span class="mile-foot-l">Prev ODO end</span><b>'+(prevEnd===''?'—':prevEnd)+'</b></div><div><span class="mile-foot-l">Month total → Month tab</span><b>'+mileMonthTotal(mileDate)+' mi</b></div></div>';
  body.innerHTML=h;
  applyMileCollapsed();
}
function applyMileCollapsed(){var b=document.getElementById('mileage-body'),c=document.getElementById('mile-chev');if(!b)return;var col=getData('dlr_mile_collapsed',false);b.style.display=col?'none':'';if(c)c.textContent=col?'›':'⌄';}
function toggleMileage(){setData('dlr_mile_collapsed',!getData('dlr_mile_collapsed',false));applyMileCollapsed();}
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2200);}
function escHtml(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── ROUTE EXTRACTOR ──────────────────────────────────────────────
var inspectorInput=document.getElementById('inspectorInput');
var headingName=document.getElementById('headingName');
var dropZone=document.getElementById('dropZone');
var fileInput=document.getElementById('fileInput');
var statusBar=document.getElementById('statusBar');
var statusDot=document.getElementById('statusDot');
var statusText=document.getElementById('statusText');
var uploadSection=document.getElementById('uploadSection');
var resultsSection=document.getElementById('resultsSection');
var cciBar=document.getElementById('cciBar');
var cciList=document.getElementById('cciList');
var tabBar=document.getElementById('tabBar');
var resultsHdr=document.getElementById('resultsHdr');
var resultsCount=document.getElementById('resultsCount');
var jobsContainer=document.getElementById('jobsContainer');

inspectorInput.addEventListener('input',function(){headingName.textContent=this.value.trim()||'Jeremiah Flavin';});
dropZone.addEventListener('dragover',function(e){e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',function(){dropZone.classList.remove('drag-over');});
dropZone.addEventListener('drop',function(e){e.preventDefault();dropZone.classList.remove('drag-over');var f=e.dataTransfer.files[0];if(f)processFile(f);});
fileInput.addEventListener('change',function(){if(this.files&&this.files[0])processFile(this.files[0]);});
document.getElementById('resetBtn').addEventListener('click',function(){clearRoute();location.reload();});
document.getElementById('wipeRouteBtn').addEventListener('click',function(){
  if(!confirm('Clear the loaded route sheet from this device?\n\nYour logs, drafts and mileage are NOT affected. Your other devices keep their route until you load a new one.'))return;
  clearRoute();location.reload(); // clearRoute keeps dlr_route_sa, so cloud sync won't re-add it
});
document.getElementById('genDlrBtn').addEventListener('click',function(){generateDLR();});
(function(){var b=document.getElementById('mapStopsBtn');if(b)b.addEventListener('click',openMapModal);})();

function setStatus(t,m){statusBar.classList.add('visible');statusDot.className='status-dot '+t;statusText.textContent=m;}
function fmtName(n){if(!n)return '';var p=n.trim().split(/\s+/);return p.length===1?p[0]:p[0].charAt(0).toUpperCase()+'. '+p[p.length-1];}

// SUMMARY sheet holds two attendance tables (col C name / col D status):
// a "CR" roster (inspectors: IN / Out / Nights) then a "CCI's" roster.
function summarySheet(wb){
  // Prefer a sheet literally named "Summary"…
  for(var i=0;i<wb.SheetNames.length;i++){if(wb.SheetNames[i].toLowerCase().trim()==='summary')return wb.Sheets[wb.SheetNames[i]];}
  // …else find the roster by content (some sheets ship it as "Sheet2"): a row
  // whose col C is the "CR" header next to an IN/OUT column.
  for(var s=0;s<wb.SheetNames.length;s++){
    var ws=wb.Sheets[wb.SheetNames[s]];if(!ws)continue;
    var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    for(var r=0;r<Math.min(rows.length,8);r++){
      var c=rows[r]&&rows[r][2],d=rows[r]&&rows[r][3];
      if(c&&String(c).toLowerCase().trim()==='cr'&&d&&String(d).toLowerCase().indexOf('out')!==-1)return ws;
    }
  }
  return null;
}
function parseAttendance(wb){
  var ss=summarySheet(wb);if(!ss)return{crs:[],ccis:[]};
  var rows=XLSX.utils.sheet_to_json(ss,{header:1,defval:null}),crs=[],ccis=[],mode=null;
  for(var i=0;i<rows.length;i++){
    var c=rows[i][2],d=rows[i][3],cl=c?String(c).toLowerCase().trim():'';
    if(cl==='cr'){mode='cr';continue;}
    if(cl.indexOf('cci')!==-1){mode='cci';continue;}
    if(!c||!String(c).trim()){if(mode==='cci')break;continue;}
    var rec={name:String(c).trim(),status:String(d||'').trim()};
    if(mode==='cr')crs.push(rec);else if(mode==='cci')ccis.push(rec);
  }
  return {crs:crs,ccis:ccis};
}
function parseCCIs(wb){
  var ss=summarySheet(wb);if(!ss)return[];
  var rows=XLSX.utils.sheet_to_json(ss,{header:1,defval:null});
  var hi=-1;
  for(var i=0;i<rows.length;i++){if(rows[i][2]&&String(rows[i][2]).toLowerCase().indexOf('cci')!==-1&&rows[i][3]&&String(rows[i][3]).toLowerCase().indexOf('in')!==-1){hi=i;break;}}
  if(hi===-1)return[];
  var out=[];
  for(var j=hi+1;j<rows.length;j++){var nm=rows[j][2],st=rows[j][3];if(!nm||!String(nm).trim())break;out.push({name:String(nm).trim(),status:String(st||'').trim()});}
  return out;
}

// ── ROUTE-SHEET DATE ─────────────────────────────────────────────
// The work date is reliably in the file name (BxCMG MM.DD.YY ...xlsx);
// Summary!A1 (e.g. "Thursday, June 11, 2026") is a secondary fallback.
function parseDateFromName(name){
  if(!name)return null;
  var m=String(name).match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})/);
  if(!m)return null;
  var mo=+m[1],da=+m[2],yr=+m[3];if(yr<100)yr+=2000;
  if(mo<1||mo>12||da<1||da>31)return null;
  return yr+'-'+('0'+mo).slice(-2)+'-'+('0'+da).slice(-2);
}
function parseSummaryDate(wb){
  var ss=summarySheet(wb);if(!ss||!ss['A1'])return null;
  var v=ss['A1'].v;
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+('0'+(v.getMonth()+1)).slice(-2)+'-'+('0'+v.getDate()).slice(-2);
  var t=Date.parse(String(v));
  if(!isNaN(t)){var d=new Date(t);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
  return null;
}

// ── FOREMAN PHONE / SMS ──────────────────────────────────────────
// The foreman field embeds the number, e.g. "123456- Mike Jones (281-330-8004)".
function extractPhone(s){if(!s)return null;var m=String(s).match(/\(?\s*(\d{3})\s*[).\-\s]\s*(\d{3})\s*[.\-\s]\s*(\d{4})\b/);return m?(m[1]+m[2]+m[3]):null;}
function normPhone(p){if(!p)return '';var d=String(p).replace(/\D/g,'');if(d.length===10)return '+1'+d;if(d.length===11&&d.charAt(0)==='1')return '+'+d;return '+'+d;}
function smsHref(phone,msg){return 'sms:'+normPhone(phone)+'&body='+encodeURIComponent(msg);}
function formatPhone(p){var d=String(p||'').replace(/\D/g,'');if(d.length===11&&d.charAt(0)==='1')d=d.slice(1);if(d.length!==10)return String(p||'');return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6);}
// Foreman name without the leading "ID- " and trailing " (phone)".
function foremanName(s){if(!s)return '';return String(s).replace(/^\d+\s*[-\s]\s*/,'').replace(/\s*\([^)]*\)\s*$/,'').trim();}

// Tap a foreman number → small Call / Send-text chooser (text keeps the
// prefilled greeting). Actions are stashed by index to avoid attribute escaping.
function openForemanActions(idx){
  var a=(window._fmActions||[])[idx];if(!a)return;
  var ov=document.createElement('div');ov.className='modal-overlay';
  ov.innerHTML='<div class="modal fm-actions">'+
    '<div class="fm-actions-name">'+escHtml(a.name||'Foreman')+'</div>'+
    '<div class="fm-actions-num">'+escHtml(a.display)+'</div>'+
    '<a class="btn btn-green fm-act" href="tel:'+a.intl+'">Call</a>'+
    '<a class="btn btn-primary fm-act" href="'+smsHref(a.digits,a.msg)+'">Send text</a>'+
    '<button class="btn btn-secondary fm-act fm-cancel">Cancel</button>'+
  '</div>';
  function close(){if(ov.parentNode)ov.parentNode.removeChild(ov);}
  ov.addEventListener('click',function(e){if(e.target===ov||e.target.classList.contains('fm-cancel'))close();});
  var links=ov.querySelectorAll('a.fm-act');
  for(var i=0;i<links.length;i++){links[i].addEventListener('click',function(){setTimeout(close,150);});}
  document.body.appendChild(ov);
}

function processFile(file){
  var NAME=inspectorInput.value.trim()||'Jeremiah Flavin';
  headingName.textContent=NAME;
  setStatus('spin','Reading file…');
  dropZone.style.display='none';
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      var att=parseAttendance(wb),ccis=(att.ccis.length?att.ccis:parseCCIs(wb)),crs=att.crs;
      var sheetJobs={};var headers=null;var allJobsList=[];var allSeen={};
      var SHEETS=['CAC','Donofrio','EJ','Gianfia','MFM'];
      for(var si=0;si<wb.SheetNames.length;si++){
        var sn=wb.SheetNames[si];
        var snl=String(sn).toLowerCase().trim();
        if(snl==='summary'||snl==='raw data'||snl==='data'||snl.charAt(0)==='#')continue;
        var ws=wb.Sheets[sn];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
        if(rows.length<3)continue;
        var company=sn;
        var hrow=-1,ciIdx=-1;
        for(var i=0;i<Math.min(rows.length,8);i++){var idx=rows[i].indexOf('Covering Inspector');if(idx!==-1){hrow=i;ciIdx=idx;break;}}
        if(hrow===-1)continue;
        if(!headers)headers=rows[hrow];
        var lastF='';var jobs=[];var seen={};
        for(var r=hrow+1;r<rows.length;r++){
          var row=rows[r];
          if(!row||row.every(function(c){return c===null||c==='';}))continue;
          var fv=row[0];if(fv&&String(fv).trim()!=='')lastF=String(fv).trim();
          var insp=row[ciIdx];
          // Capture EVERY job (all inspectors) for the "All" list.
          var aLoc=String(row[headers.indexOf('Location')]||'').trim();
          var aTk=String(row[headers.indexOf('Ticket #')]||'').trim();
          var aWo=String(row[headers.indexOf('Layout/CWORX Work Order #')]||'').trim();
          var aIn=insp?String(insp).trim():'';
          var aTow=String(row[headers.indexOf('Type Of Work')]||'').trim();
          if(aLoc||aTk){
            var aKey=aLoc+'|'+aTk+'|'+aIn;
            if(!allSeen[aKey]){allSeen[aKey]=true;allJobsList.push({location:aLoc,contractor:company,ticket:aTk,wo:aWo,inspector:aIn,tow:aTow});}
          }
          if(insp&&String(insp).trim()===NAME){
            if(!row[0]||String(row[0]).trim()===''){row=row.slice();row[0]=lastF;}
            var wdI=headers.indexOf('Work Description');
            var wd=row[wdI]?String(row[wdI]).trim():'';
            var key=String(row[headers.indexOf('Ticket #')]||'')+'|'+String(row[headers.indexOf('Location')]||'')+'|'+wd;
            if(!seen[key]){seen[key]=true;var jr=row.slice();jr._co=company;jobs.push(jr);}
          }
        }
        sheetJobs[sn]={jobs:jobs,company:company};
      }
      if(!headers)throw new Error('Could not find column headers.');
      var myJobs=[];var myJobsCompany=[];
      SHEETS.forEach(function(sn){
        if(sheetJobs[sn]){
          myJobs=myJobs.concat(sheetJobs[sn].jobs);
          sheetJobs[sn].jobs.forEach(function(){myJobsCompany.push(sheetJobs[sn].company);});
        }
      });
      var ownedJobs=[];var ownedSeen={};
      var joIdx=headers.indexOf('Job Owner');
      if(joIdx!==-1){
        SHEETS.forEach(function(sn){
          if(!sheetJobs[sn])return;
          var ws2=wb.Sheets[sn];var rows2=XLSX.utils.sheet_to_json(ws2,{header:1,defval:null});
          var hrow2=-1;
          for(var i3=0;i3<Math.min(rows2.length,8);i3++){if(rows2[i3].indexOf('Job Owner')!==-1){hrow2=i3;break;}}
          if(hrow2===-1)return;
          var lastF2='';var company2=(rows2[1]&&rows2[1][4])?String(rows2[1][4]).trim():sn;
          var joIdx2=rows2[hrow2].indexOf('Job Owner');
          for(var r2=hrow2+1;r2<rows2.length;r2++){
            var row2=rows2[r2];
            if(!row2||row2.every(function(c){return c===null||c==='';}))continue;
            if(row2[0]&&String(row2[0]).trim()!=='')lastF2=String(row2[0]).trim();
            var joVal=row2[joIdx2];
            if(joVal&&String(joVal).trim()===NAME){
              if(!row2[0]||String(row2[0]).trim()===''){row2=row2.slice();row2[0]=lastF2;}
              var wdI2=headers.indexOf('Work Description');var wd2=row2[wdI2]?String(row2[wdI2]).trim():'';
              var key2=String(row2[headers.indexOf('Ticket #')]||'')+'|'+String(row2[headers.indexOf('Location')]||'')+'|'+wd2;
              if(!ownedSeen[key2]){ownedSeen[key2]=true;var jr2=row2.slice();jr2._co=company2;ownedJobs.push(jr2);}
            }
          }
        });
      }
      allJobsList.sort(function(a,b){return (a.inspector||'~~~').localeCompare(b.inspector||'~~~')||a.location.localeCompare(b.location);});
      var routeDate=parseDateFromName(file.name)||parseSummaryDate(wb)||null;
      allData={headers:headers,flavin:myJobs,flavinCompany:myJobsCompany,owned:ownedJobs,sheets:sheetJobs,ccis:ccis,crs:crs,contractorSheets:SHEETS,name:NAME,routeDate:routeDate,allJobs:allJobsList};
      saveRoute();syncPushRoute();
      renderRouteResults();
    }catch(err){setStatus('err','Error: '+err.message);dropZone.style.display='';}
  };
  reader.onerror=function(){setStatus('err','Could not read file.');dropZone.style.display='';};
  reader.readAsArrayBuffer(file);
}

function renderRouteResults(){
  uploadSection.style.display='none';resultsSection.style.display='block';statusBar.classList.remove('visible');
  cciList.innerHTML='';
  allData.ccis.forEach(function(c){
    var sl=c.status.toLowerCase();var el=document.createElement('span');el.className='cci-entry';
    el.innerHTML='<span class="cci-name">'+fmtName(c.name)+'</span><span class="'+(sl==='in'?'cci-in':'cci-out')+'">'+c.status.toUpperCase()+' '+(sl==='in'?'✓':'✕')+'</span>';
    cciList.appendChild(el);
  });
  cciBar.classList.toggle('visible',allData.ccis.length>0);
  var grouped=groupByWOLocation(allData.flavin);var keys=Object.keys(grouped);
  document.getElementById('genDlrInfo').innerHTML=(allData.routeDate?'<div class="gen-dlr-date">'+escHtml(fmtDate(allData.routeDate))+'</div>':'')+'<b>'+allData.flavin.length+' job row'+(allData.flavin.length!==1?'s':'')+' → '+keys.length+' DLR block'+(keys.length!==1?'s':'')+' by WO / Location</b>';
  document.getElementById('genDlrBar').classList.add('visible');
  routeAll=false;routeCRs=false;routeMine='flavin';routeCo='';
  buildRouteTabs();renderRouteBody();
}

// Route view state: my jobs (Covering / Owned) with a one-at-a-time contractor
// filter, plus a separate All-jobs reference view.
var routeAll=false,routeCRs=false,routeMine='flavin',routeCo='';
function buildRouteTabs(){
  var lastName=allData.name.split(' ').pop();
  var mine=(!routeAll&&!routeCRs);
  tabBar.innerHTML=
    '<button class="tab'+(mine&&routeMine==='flavin'?' active':'')+'" onclick="setMineTab(\'flavin\')">'+escHtml(lastName)+'<span class="tab-ct">'+allData.flavin.length+'</span></button>'+
    '<button class="tab'+(mine&&routeMine==='owned'?' active':'')+'" onclick="setMineTab(\'owned\')">Owned<span class="tab-ct">'+allData.owned.length+'</span></button>'+
    '<button class="tab'+(routeAll?' active':'')+'" onclick="setRouteAll()">All jobs<span class="tab-ct">'+(allData.allJobs||[]).length+'</span></button>'+
    ((allData.crs&&allData.crs.length)?'<button class="tab tab-crs'+(routeCRs?' active':'')+'" style="margin-left:auto" onclick="setRouteCRs()">CRs<span class="tab-ct">'+allData.crs.length+'</span></button>':'');
}
function setMineTab(w){routeAll=false;routeCRs=false;routeMine=w;routeCo='';buildRouteTabs();renderRouteBody();}
function setRouteAll(){routeAll=true;routeCRs=false;routeCo='';buildRouteTabs();renderRouteBody();}
function setRouteCRs(){routeCRs=true;routeAll=false;buildRouteTabs();renderRouteBody();}
function setRouteCo(co){routeCo=co;renderRouteBody();}
function attRank(s){s=(s||'').toLowerCase();if(s.indexOf('night')!==-1)return 1;if(s.indexOf('out')!==-1)return 2;if(s.indexOf('in')!==-1)return 0;return 3;}
function attClass(s){var r=attRank(s);return r===0?'att-in':r===1?'att-night':r===2?'att-out':'att-na';}
function renderCRs(){
  resultsHdr.style.display='none';
  var crs=(allData.crs||[]),me=inspectorName();
  if(!crs.length){jobsContainer.innerHTML='<div class="no-jobs">No CR attendance on this route sheet</div>';return;}
  var inCt=crs.filter(function(r){return attRank(r.status)===0;}).length;
  // clk=true → tappable row that opens the inspector's jobs.
  function row(r,clk){return '<div class="att-row'+(r.name.toLowerCase()===me.toLowerCase()?' att-me':'')+(clk?' att-click':'')+'"'+
    (clk?' data-name="'+escHtml(r.name)+'" onclick="showCRJobs(this.getAttribute(\'data-name\'))"':'')+'>'+
    '<span class="att-name">'+escHtml(r.name)+'</span>'+
    (clk?'<span class="att-arrow">›</span>':'')+
    '<span class="att-st '+attClass(r.status)+'">'+escHtml(r.status||'—')+'</span></div>';}
  var sorted=crs.slice().sort(function(a,b){return attRank(a.status)-attRank(b.status)||a.name.localeCompare(b.name);});
  var h='<div class="att-hdr">'+inCt+' of '+crs.length+' CRs in</div><div class="att-list">'+sorted.map(function(r){return row(r,true);}).join('')+'</div>';
  if(allData.ccis&&allData.ccis.length)h+='<div class="att-sub">CCIs</div><div class="att-list">'+allData.ccis.slice().sort(function(a,b){return attRank(a.status)-attRank(b.status)||a.name.localeCompare(b.name);}).map(function(r){return row(r,false);}).join('')+'</div>';
  jobsContainer.innerHTML=h;
}
// Match a roster name to covering-inspector values regardless of order / middle initials
// ("Flavin, Jeremiah M" ⇔ "Jeremiah Flavin").
function crNameKey(s){var toks=String(s||'').toLowerCase().replace(/[.,]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(function(t){return t.length>1;});return toks.sort().join(' ');}
function showCRJobs(name){
  var key=crNameKey(name);
  var jobs=key?(allData.allJobs||[]).filter(function(j){return crNameKey(j.inspector)===key;}):[];
  var rec=(allData.crs||[]).concat(allData.ccis||[]).filter(function(r){return crNameKey(r.name)===key;})[0];
  document.getElementById('crjobs-title').innerHTML=escHtml(name)+(rec&&rec.status?' <span class="att-st '+attClass(rec.status)+'">'+escHtml(rec.status)+'</span>':'');
  document.getElementById('crjobs-count').textContent=jobs.length+' job'+(jobs.length!==1?'s':'')+' on this route sheet';
  var host=document.getElementById('crjobs-list');
  if(!jobs.length){host.innerHTML='<div class="no-jobs">No jobs for '+escHtml(name)+' on this route sheet</div>';}
  else host.innerHTML=jobs.map(function(j){var jc=contractorColor(j.contractor);
    return '<div class="list-item"'+(jc?' style="border-left:3px solid '+jc+';background:'+hexToRgba(jc,0.07)+'"':'')+'>'+
      '<div class="list-loc">'+escHtml(j.location||'—')+'</div><div class="list-meta">'+
      (j.contractor?'<span class="lm" style="font-weight:800'+(jc?';color:'+jc:'')+'">'+escHtml(j.contractor)+'</span>':'')+
      (j.ticket?'<span class="lm">WR# <b>'+escHtml(j.ticket)+'</b></span>':'')+
      (j.wo?'<span class="lm">WO# <b>'+escHtml(j.wo)+'</b></span>':'')+
      '</div></div>';}).join('');
  document.getElementById('crjobs-modal').style.display='block';
}
function closeCRJobs(e){if(e&&!e.target.classList.contains('modal-overlay'))return;document.getElementById('crjobs-modal').style.display='none';}
function coChip(label,val,count,color){
  var active=routeCo===val,style='';
  if(active){var c=color||'#111';style='background:'+c+';border-color:'+c+';color:#fff';}
  else if(color){style='color:'+color+';border-color:'+color;}
  return '<button class="co-chip'+(active?' active':'')+'" style="'+style+'" onclick="setRouteCo(\''+String(val).replace(/'/g,"\\'")+'\')">'+escHtml(label)+'<span class="co-chip-ct">'+count+'</span></button>';
}
function renderRouteBody(){
  var row=document.getElementById('coFilterRow');
  if(routeCRs){if(row)row.style.display='none';renderCRs();return;}
  if(routeAll){if(row)row.style.display='none';renderAllJobs(allData.allJobs);return;}
  var jobs=(routeMine==='owned')?allData.owned:allData.flavin;
  var counts={},order=[];
  jobs.forEach(function(j){var c=j._co||'';if(!c)return;if(!(c in counts)){counts[c]=0;order.push(c);}counts[c]++;});
  order.sort(function(a,b){var ia=allData.contractorSheets.indexOf(a),ib=allData.contractorSheets.indexOf(b);ia=ia<0?99:ia;ib=ib<0?99:ib;return ia-ib||a.localeCompare(b);});
  if(routeCo&&!counts[routeCo])routeCo='';
  if(row){
    if(order.length>=1){
      var html=coChip('All','',jobs.length,'');
      order.forEach(function(c){html+=coChip(c,c,counts[c],contractorColor(c));});
      row.innerHTML=html;row.style.display='flex';
    }else{row.innerHTML='';row.style.display='none';}
  }
  var filtered=routeCo?jobs.filter(function(j){return (j._co||'')===routeCo;}):jobs;
  renderFlavinJobs(filtered);
}

function gv(row,h,name){var i=h.indexOf(name);if(i===-1||row[i]==null||row[i]==='')return null;return String(row[i]).trim();}
// Fusing Peer column name varies on the sheet — match it loosely.
var FUSE_RE=/fus[a-z]*\s*peer|peer\s*fus[a-z]*|fusing/i;
function gvRe(row,h,re){for(var i=0;i<h.length;i++){if(h[i]&&re.test(String(h[i]))){var v=row[i];return (v==null||v==='')?null:String(v).trim();}}return null;}
// A Contingency / Hold Point / Fusing Peer value counts as "active" unless it's blank or a negative.
function isActive(v){if(!v)return false;var s=String(v).trim().toLowerCase();return s!==''&&s!=='no'&&s!=='n'&&s!=='n/a'&&s!=='none'&&s!=='0'&&s!=='false';}

// Subtle per-contractor accent (from their logo colors). Matched loosely on name.
var CONTRACTOR_THEME=[['cac','#1F7A4D'],['onofrio','#C1272D'],['ej','#E0322E'],['gianfia','#2B4A9B'],['mfm','#7A1F2B']];
function hexToRgba(hex,a){hex=String(hex).replace('#','');if(hex.length===3)hex=hex.replace(/(.)/g,'$1$1');var n=parseInt(hex,16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
function contractorColor(name){
  if(!name)return '';var s=String(name).toLowerCase();
  for(var i=0;i<CONTRACTOR_THEME.length;i++){if(s.indexOf(CONTRACTOR_THEME[i][0])!==-1)return CONTRACTOR_THEME[i][1];}
  return '';
}
function renderFlavinJobs(jobs){
  resultsHdr.style.display='flex';resultsCount.textContent=jobs.length+' job'+(jobs.length!==1?'s':'');
  jobsContainer.innerHTML='';if(!jobs||jobs.length===0){jobsContainer.innerHTML='<div class="no-jobs">No jobs assigned</div>';return;}
  var h=allData.headers;var grid=document.createElement('div');grid.className='jobs';
  window._fmActions=[];window._contData=[];window._hpData=[];
  jobs.forEach(function(row){
    var loc=gv(row,h,'Location')||'—',tw=gv(row,h,'Type Of Work')||'',wd=gv(row,h,'Work Description'),tk=gv(row,h,'Ticket #'),wo=gv(row,h,'Layout/CWORX Work Order #'),fm=gv(row,h,"Contractor's Foreman"),ph=gv(row,h,'Permit Hours'),psc=gv(row,h,'PSC File #'),cci=gv(row,h,'CCI'),jo=gv(row,h,'Job Owner'),cg=gv(row,h,'Contingency (Y/N)'),cn=gv(row,h,'Contingency #'),hp=gv(row,h,'Hold Point'),fz=gvRe(row,h,FUSE_RE),c7=gv(row,h,'Code 753'),co=row._co||'';
    var twl=tw.toLowerCase();var bc=twl.indexOf('major')!==-1?'tbadge t-major':twl.indexOf('new')!==-1?'tbadge t-new':'tbadge t-mrp';
    var cgf=(cg&&cg.toLowerCase()!=='no')?(cg+(cn?' · '+cn:'')):null;
    var fmPhone=extractPhone(fm);var fmDisp=fm?(foremanName(fm)||fm):'';
    var wrMsg=(tk||wo||'');
    var greet='Good morning, I\'m covering you on '+((wrMsg+' '+(loc==='—'?'':loc)).replace(/\s+/g,' ').trim())+' today';
    var fmLink='';
    if(fmPhone){
      var fmIdx=window._fmActions.push({name:fmDisp,digits:fmPhone,intl:normPhone(fmPhone),display:formatPhone(fmPhone),msg:greet})-1;
      fmLink='<a class="fm-phone" href="javascript:void(0)" onclick="openForemanActions('+fmIdx+');return false;">'+formatPhone(fmPhone)+'</a>';
    }
    var contTag='<span class="status-off">Contingency: No</span>';
    if(isActive(cg)){
      var contIdx=window._contData.push({num:cn||'',layout:wo||'',code:c7||'',contractor:co||'',location:(loc==='—'?'':loc),inspector:allData.name})-1;
      contTag='<button class="cont-chip" onclick="openContingencyRoute('+contIdx+')">⚠ '+escHtml(cn||'Contingency')+' →</button>';
    }
    var hpTag;
    if(isActive(hp)){
      var hpIdx=window._hpData.push({date:allData.routeDate||today(),ticket:tk||'',wo:wo||'',location:(loc==='—'?'':loc),hp:hp})-1;
      hpTag='<button class="hp-chip" onclick="holdPointAlbum('+hpIdx+')">📷 Hold Point: '+escHtml(hp)+'</button>';
    }else hpTag='<span class="status-off">Hold Point: No</span>';
    var fuseTag=isActive(fz)?('<span class="b-fuse">Pressure Test: '+escHtml(fz)+'</span>'):'<span class="status-off">Pressure Test: No</span>';
    var coColor=contractorColor(co);
    var coTint=coColor?hexToRgba(coColor,0.12):'';
    var card=document.createElement('div');card.className='job-card';
    if(coColor)card.style.borderLeft='3px solid '+coColor;
    card.innerHTML='<div class="card-head"'+(coTint?' style="background:'+coTint+'"':'')+'><div class="loc">'+loc+'</div>'+(tw?'<span class="'+bc+'">'+tw+'</span>':'')+' </div>'+
      '<div class="card-primary"><div class="pf"><span class="fl">Ticket #</span><span class="fv'+(tk?'':' mt')+'">'+(tk||'N/A')+'</span></div><div class="pf"><span class="fl">Contingency</span><span class="fv pl'+(cgf?'':' mt')+'">'+(cgf||'No')+'</span></div></div>'+
      '<div class="card-foreman">'+(co?'<div class="co-tag"'+(coColor?' style="color:'+coColor+'"':'')+'>'+co+'</div>':'')+' <div class="fm-name'+(fm?'':' mt')+'">'+(fmDisp||'N/A')+'</div>'+fmLink+'</div>'+
      '<div class="card-fields"><div class="cf"><span class="fl">Work</span><span class="cfv pl'+(wd?'':' mt')+'">'+(wd||'N/A')+'</span></div><div class="cf"><span class="fl">Work order</span><span class="cfv'+(wo?'':' mt')+'">'+(wo||'N/A')+'</span></div><div class="cf"><span class="fl">Permit hrs</span><span class="cfv'+(ph?'':' mt')+'">'+(ph||'N/A')+'</span></div><div class="cf"><span class="fl">PSC</span><span class="cfv pl'+(psc?'':' mt')+'">'+(psc||'N/A')+'</span></div><div class="cf"><span class="fl">CCI</span><span class="cfv pl'+(cci?'':' mt')+'">'+(cci||'N/A')+'</span></div><div class="cf"><span class="fl">Job owner</span><span class="cfv pl'+(jo?'':' mt')+'">'+(jo||'N/A')+'</span></div><div class="cf"><span class="fl">Code 753</span><span class="cfv'+(c7?'':' mt')+'">'+(c7||'N/A')+'</span></div></div>'+
      '<div class="badges">'+contTag+hpTag+fuseTag+'</div>';
    grid.appendChild(card);
  });
  jobsContainer.appendChild(grid);
}

function renderListJobs(jobs){
  resultsHdr.style.display='none';jobsContainer.innerHTML='';
  if(!jobs||jobs.length===0){jobsContainer.innerHTML='<div class="no-jobs">No jobs assigned</div>';return;}
  var h=allData.headers;var list=document.createElement('div');list.className='list-jobs';
  jobs.forEach(function(row){
    var loc=gv(row,h,'Location')||'—',wd=gv(row,h,'Work Description'),tk=gv(row,h,'Ticket #'),fm=gv(row,h,"Contractor's Foreman"),ph=gv(row,h,'Permit Hours'),cg=gv(row,h,'Contingency (Y/N)'),cn=gv(row,h,'Contingency #'),hp=gv(row,h,'Hold Point');
    var cgf=(cg&&cg.toLowerCase()!=='no')?(cg+(cn?' · '+cn:'')):null;
    var fmShort='';if(fm){var pts=fm.replace(/^\d+-\s*/,'').split(' ');fmShort=pts.slice(0,2).join(' ');}
    var item=document.createElement('div');item.className='list-item';
    item.innerHTML='<div class="list-loc">'+loc+'</div><div class="list-work">'+(wd||'—')+'</div>'+
      '<div class="list-meta">'+(tk?'<span class="lm">Ticket <b>'+tk+'</b></span>':'')+(fmShort?'<span class="lm">Foreman <b>'+fmShort+'</b></span>':'')+(ph?'<span class="lm">Hours <b>'+ph+'</b></span>':'')+' </div>'+
      '<div class="list-badges"><span class="b-cont">Contingency: '+(cgf||'No')+'</span><span class="b-hp">Hold Point: '+((hp&&hp.toLowerCase()!=='n')?hp:'N/A')+'</span></div>';
    list.appendChild(item);
  });
  jobsContainer.appendChild(list);
}

// All jobs across every inspector: location · contractor · WR#/WO# · covering inspector.
var ajCo='',ajInsp='',ajSort='inspector',ajTow='';
function ajChange(kind,val){if(kind==='co')ajCo=val;else if(kind==='insp')ajInsp=val;else if(kind==='tow')ajTow=val;else ajSort=val;renderAllJobs(allData.allJobs);}
function renderAllJobs(jobs){
  jobs=jobs||[];resultsHdr.style.display='none';jobsContainer.innerHTML='';
  if(jobs.length===0){jobsContainer.innerHTML='<div class="no-jobs">No jobs found</div>';return;}
  var cos={},insps={},tows={};
  jobs.forEach(function(j){if(j.contractor)cos[j.contractor]=1;insps[j.inspector||'—']=1;if(j.tow)tows[j.tow]=1;});
  var coList=Object.keys(cos).sort(),inspList=Object.keys(insps).sort(),towList=Object.keys(tows).sort();
  if(ajCo&&!cos[ajCo])ajCo='';if(ajInsp&&!insps[ajInsp])ajInsp='';if(ajTow&&!tows[ajTow])ajTow='';
  var filtered=jobs.filter(function(j){return (!ajCo||j.contractor===ajCo)&&(!ajInsp||(j.inspector||'—')===ajInsp)&&(!ajTow||j.tow===ajTow);});
  filtered=filtered.slice().sort(function(a,b){
    if(ajSort==='contractor')return (a.contractor||'~').localeCompare(b.contractor||'~')||(a.location||'').localeCompare(b.location||'');
    if(ajSort==='location')  return (a.location||'~').localeCompare(b.location||'~');
    return (a.inspector||'~~~').localeCompare(b.inspector||'~~~')||(a.location||'').localeCompare(b.location||'');
  });
  function opts(arr,sel,allLabel){return '<option value="">'+allLabel+'</option>'+arr.map(function(v){return '<option value="'+escHtml(v)+'"'+(v===sel?' selected':'')+'>'+escHtml(v)+'</option>';}).join('');}
  var ss='background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:7px 8px;font-size:12px;color:var(--ink);font-family:var(--font);outline:none;flex:1;min-width:0';
  var bar=document.createElement('div');bar.className='aj-controls';
  bar.innerHTML=
    '<select style="'+ss+'" onchange="ajChange(\'co\',this.value)">'+opts(coList,ajCo,'All contractors')+'</select>'+
    '<select style="'+ss+'" onchange="ajChange(\'insp\',this.value)">'+opts(inspList,ajInsp,'All inspectors')+'</select>'+
    (towList.length?'<select style="'+ss+'" onchange="ajChange(\'tow\',this.value)">'+opts(towList,ajTow,'All work types')+'</select>':'')+
    '<select style="'+ss+'" onchange="ajChange(\'sort\',this.value)">'+
      '<option value="inspector"'+(ajSort==='inspector'?' selected':'')+'>Sort: Inspector</option>'+
      '<option value="contractor"'+(ajSort==='contractor'?' selected':'')+'>Sort: Contractor</option>'+
      '<option value="location"'+(ajSort==='location'?' selected':'')+'>Sort: Location</option>'+
    '</select>';
  jobsContainer.appendChild(bar);
  var cnt=document.createElement('div');cnt.className='aj-count';cnt.textContent=filtered.length+' of '+jobs.length+' job'+(jobs.length!==1?'s':'');
  jobsContainer.appendChild(cnt);
  if(filtered.length===0){var nf=document.createElement('div');nf.className='no-jobs';nf.textContent='No matching jobs';jobsContainer.appendChild(nf);return;}
  var list=document.createElement('div');list.className='list-jobs';
  filtered.forEach(function(j){
    var jc=contractorColor(j.contractor);
    var item=document.createElement('div');item.className='list-item';
    if(jc){item.style.borderLeft='3px solid '+jc;item.style.background=hexToRgba(jc,0.07);}
    item.innerHTML='<div class="list-loc">'+escHtml(j.location||'—')+'</div>'+
      '<div class="list-meta">'+
        (j.contractor?'<span class="lm" style="font-weight:800'+(contractorColor(j.contractor)?';color:'+contractorColor(j.contractor):'')+'">'+escHtml(j.contractor)+'</span>':'')+
        (j.ticket?'<span class="lm">WR# <b>'+escHtml(j.ticket)+'</b></span>':'')+
        (j.wo?'<span class="lm">WO# <b>'+escHtml(j.wo)+'</b></span>':'')+
        '<span class="lm">Insp <b>'+escHtml(j.inspector||'—')+'</b></span>'+
      '</div>';
    list.appendChild(item);
  });
  jobsContainer.appendChild(list);
  var wrs=filtered.map(function(j){return j.ticket||j.wo||'';}).filter(Boolean);
  var sum=document.createElement('div');sum.className='aj-summary';
  sum.innerHTML='<div class="aj-sum-h">'+filtered.length+' job'+(filtered.length!==1?'s':'')+' · WR#/WO# list</div>'+
    '<div class="aj-sum-list" id="aj-wrs">'+escHtml(wrs.join(', '))+'</div>'+
    '<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="copyText(document.getElementById(\'aj-wrs\').textContent)">Copy list</button>';
  jobsContainer.appendChild(sum);
}

// Hold Point chip → copy a standardized Photos album name (date - job#s - location).
// iOS web can't create an album directly; this makes naming one a paste away.
function albumDate(iso){
  iso=iso||today();var p=String(iso).split('-');
  return p.length===3?((+p[1])+'/'+(+p[2])+'/'+p[0].slice(-2)):iso; // YYYY-MM-DD → M/D/YY
}
function abbrevStreet(s){
  s=s.replace(/\bEast\b/gi,'E').replace(/\bWest\b/gi,'W').replace(/\bNorth\b/gi,'N').replace(/\bSouth\b/gi,'S');
  [[/\bStreet\b/gi,'St'],[/\bAvenue\b/gi,'Ave'],[/\bAv\b/gi,'Ave'],[/\bRoad\b/gi,'Rd'],[/\bBoulevard\b/gi,'Blvd'],
   [/\bDrive\b/gi,'Dr'],[/\bLane\b/gi,'Ln'],[/\bPlace\b/gi,'Pl'],[/\bCourt\b/gi,'Ct'],
   [/\bTerrace\b/gi,'Ter'],[/\bParkway\b/gi,'Pkwy'],[/\bExpressway\b/gi,'Expwy'],
   [/\bHighway\b/gi,'Hwy'],[/\bSquare\b/gi,'Sq'],[/\bPlaza\b/gi,'Plz']].forEach(function(m){s=s.replace(m[0],m[1]);});
  return s.replace(/\s+/g,' ').replace(/\s+,/g,',').trim();
}
// Smart shorten: street address w/ house # drops cross-streets ("3003 Eastchester
// Rd"); a plain intersection keeps just the FIRST cross street ("E 166th St & Brook Ave").
function shortAddr(loc){
  if(!loc)return '';
  var s=String(loc).replace(/\s+/g,' ').trim();
  // strip a leading WR job prefix the route sheet jams on, e.g. "WR100170592-P2 – "
  s=s.replace(/^WR\s*\d+(?:\s*-\s*P?\d+)?\s*[–-]?\s*/i,'').trim();
  var hasNum=/^\d+\s/.test(s);
  var parts=s.split(/\s+(?:btwn?|between|bet\.?|b\/w|bt|&|and|@)\s+/i);
  var out=parts[0];
  if(!hasNum&&parts.length>1&&parts[1])out=parts[0]+' & '+parts[1];
  return abbrevStreet(out);
}
function abbrevLoc(loc){return shortAddr(loc);}
// Tickets sometimes carry a trailing " - QIAS" tag that's irrelevant here.
function cleanTicket(t){return String(t||'').replace(/\s*-\s*QIAS\b/ig,'').replace(/\bQIAS\b/ig,'').replace(/\s+/g,' ').trim();}
// Strip the company "X<year>" prefix (e.g. X26-101623765 → 101623765; lone "X26" dropped).
function stripJobPrefix(s){
  s=String(s||'').trim().replace(/^X\d{2}\s*-\s*/i,'');
  return /^X\d{2}$/i.test(s)?'':s;
}
function albumName(d){
  var seen={},jobs=[];
  [d.wo,d.ticket].forEach(function(v){v=stripJobPrefix(v);if(v&&!seen[v]){seen[v]=true;jobs.push(v);}});
  return [albumDate(d.date),jobs.join(' - '),abbrevLoc(d.location)].filter(Boolean).join(' - ');
}
function copyAlbumName(d){
  var name=albumName(d);
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(name).catch(function(){}); // reliable fallback
  if(getData('dlr_hp_shortcut',false)&&isIOS()){
    showToast('Opening Photos shortcut…');
    window.location.href='shortcuts://run-shortcut?name='+encodeURIComponent(HP_SHORTCUT_NAME)+'&input=text&text='+encodeURIComponent(name);
  }else showToast('Album name copied — Photos › New Album › paste');
}
function holdPointAlbum(i){var d=window._hpData&&window._hpData[i];if(d)copyAlbumName(d);}
function holdPointAlbumCrew(cid){
  var c=currentCrews.find(function(x){return x.id===cid;});if(!c)return;
  copyAlbumName({date:(document.getElementById('log-date')||{}).value||today(),ticket:c.wo||'',wo:c.cworxWO||'',location:c.location||''});
}
// Hold Point portal helper: the ConEd form auto-fills from the WR#; the user only
// types the contractor + foreman. This surfaces those three as tap-to-copy rows.
var HP_PORTAL_URL='https://constructionandgasforms.coned.com/';
function openHpPortal(){window.open(HP_PORTAL_URL,'_blank','noopener');}
function holdPointInfo(cid){
  var c=currentCrews.find(function(x){return x.id===cid;});if(!c)return;
  var rows=[{label:'WR# / Ticket #',value:cleanTicket(c.wo||'')},{label:'Contractor',value:c.contractor||''}];
  if(c.leads&&c.leads.length){
    c.leads.forEach(function(l){rows.push({label:c.leads.length>1?('Foreman ('+(leadTypeLabel(l.type)||'—')+')'):'Foreman',value:l.name});});
  }else{
    (c.foremen||[]).map(cleanLeadName).filter(Boolean).forEach(function(n,i,a){rows.push({label:a.length>1?'Foreman '+(i+1):'Foreman',value:n});});
  }
  window._hpFields=rows;
  document.getElementById('hpinfo-rows').innerHTML=rows.map(function(r,i){
    return '<div class="hpi-row" onclick="copyHpField('+i+')"><div class="hpi-txt">'+
      '<div class="hpi-l">'+escHtml(r.label)+'</div>'+
      '<div class="hpi-v">'+escHtml(r.value||'—')+'</div></div>'+
      '<div class="hpi-copy">Copy</div></div>';
  }).join('');
  document.getElementById('hpinfo-modal').style.display='block';
}
function copyHpField(i){
  var r=(window._hpFields||[])[i];if(!r||!r.value)return;
  var el=document.querySelectorAll('#hpinfo-rows .hpi-row')[i];
  var done=function(){var c=el&&el.querySelector('.hpi-copy');if(c){c.textContent='Copied ✓';el.classList.add('copied');setTimeout(function(){c.textContent='Copy';el.classList.remove('copied');},1200);}};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(r.value).then(done).catch(function(){fallbackCopy(r.value);done();});
  else{fallbackCopy(r.value);done();}
}
function closeHpInfo(e){if(e&&!e.target.classList.contains('modal-overlay'))return;document.getElementById('hpinfo-modal').style.display='none';}
var HP_SHORTCUT_NAME='FieldLog Album';
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function toggleHpShortcut(){var v=!getData('dlr_hp_shortcut',false);setData('dlr_hp_shortcut',v);updateHpShortcutState();showToast(v?'Hold Point will open the "FieldLog Album" shortcut':'Hold Point will copy the album name');}
function updateHpShortcutState(){var el=document.getElementById('hp-shortcut-state');if(el)el.textContent=getData('dlr_hp_shortcut',false)?'On':'Off';}

// ── GROUPING ─────────────────────────────────────────────────────

function getContractorForRow(row){
  if(!allData||!allData.headers)return '';
  var h=allData.headers;
  var tk=gv(row,h,'Ticket #')||'';
  var loc=gv(row,h,'Location')||'';
  var SHEETS=allData.contractorSheets||[];
  for(var i=0;i<SHEETS.length;i++){
    var sn=SHEETS[i];
    var sd=allData.sheets[sn];
    if(!sd)continue;
    for(var j=0;j<sd.jobs.length;j++){
      var jr=sd.jobs[j];
      if((gv(jr,h,'Ticket #')||'')=== tk && (gv(jr,h,'Location')||'')=== loc)
        return sd.company||sn;
    }
  }
  return '';
}
// Foreman/lead type from the job's Work Description (col J). Labor → Mechanic →
// Welder ordering on the crew block; "other" (e.g. Support) sorts last.
function foremanType(wd){
  var d=(wd||'').toLowerCase();
  if(d.indexOf('weld')!==-1)return 'welder';
  if(/cut ?out|service transfer|install dead main|pressure test|main cut/.test(d))return 'mechanic';
  if(/excavat|backfill|restoration|test pit|cathodic/.test(d))return 'labor';
  return 'other';
}
function LEAD_RANK(t){return t==='labor'?0:t==='mechanic'?1:t==='welder'?2:3;}
function leadTypeLabel(t){return t==='labor'?'Labor':t==='mechanic'?'Mech':t==='welder'?'Weld':'';}
function cleanLeadName(s){return String(s||'').replace(/^\d+[-\s]+/,'').replace(/\s*\(.*?\)\s*$/,'').replace(/\s+/g,' ').trim();}
// ITS# = the leading employee number on a lead string, e.g. "419813- Elvis Aguiluz".
function leadIts(s){var m=String(s||'').match(/^\s*(\d{3,})/);return m?m[1]:'';}
// Name with its ITS# to the left, matching the route-sheet convention "419813- Name".
function leadLabel(l){return (l&&l.its?l.its+'- ':'')+((l&&l.name)||'');}
function addLead(g,raw,type){var name=cleanLeadName(raw);if(!name)return;for(var i=0;i<g.leads.length;i++){if(g.leads[i].name.toLowerCase()===name.toLowerCase()){if(!g.leads[i].its){var ex=leadIts(raw);if(ex)g.leads[i].its=ex;}return;}}g.leads.push({name:name,type:type,its:leadIts(raw)});}
function groupByWOLocation(jobs){
  var h=allData.headers;var groups={};var order=[];
  var isMainJobs=(jobs===allData.flavin);
  jobs.forEach(function(row,rowIdx){
    var loc=(gv(row,h,'Location')||'').toUpperCase().trim();
    var tk=gv(row,h,'Ticket #')||'';
    var key=tk.replace(/\s/g,'').toUpperCase()+'||'+loc;
    if(!groups[key]){
      groups[key]={location:gv(row,h,'Location')||'',wo:tk,cworxWO:gv(row,h,'Layout/CWORX Work Order #')||'',contractor:(isMainJobs&&allData.flavinCompany&&allData.flavinCompany[rowIdx])||row._co||'',foremen:[],leads:[],workDescs:[],permitHours:gv(row,h,'Permit Hours')||'',psc:gv(row,h,'PSC File #')||'',contingency:gv(row,h,'Contingency (Y/N)')||'',contingencyNum:gv(row,h,'Contingency #')||'',code753:gv(row,h,'Code 753')||'',holdPoint:gv(row,h,'Hold Point')||'',fusingPeer:gvRe(row,h,FUSE_RE)||''};
      order.push(key);
    }
    var g=groups[key];
    var wd=gv(row,h,'Work Description')||'';
    if(wd&&g.workDescs.indexOf(wd)===-1)g.workDescs.push(wd);
    var t=foremanType(wd);
    var fm=gv(row,h,"Contractor's Foreman");
    if(fm)addLead(g,fm,t);
    var mech=gv(row,h,'Mechanics/Fusers/Welders');
    if(mech)String(mech).split(/[\n;]+/).forEach(function(nm){if(nm&&nm.trim())addLead(g,nm,t==='welder'?'welder':'mechanic');});
  });
  order.forEach(function(k){var g=groups[k];g.leads.sort(function(a,b){return LEAD_RANK(a.type)-LEAD_RANK(b.type);});g.foremen=g.leads.map(leadLabel);});
  var result={};order.forEach(function(k){result[k]=groups[k];});return result;
}

// ── GENERATE DLR ─────────────────────────────────────────────────
function generateDLR(){
  if(!allData.flavin||allData.flavin.length===0){showToast('No assigned jobs found');return;}
  var grouped=groupByWOLocation(allData.flavin);var keys=Object.keys(grouped);
  currentCrews=[];
  keys.forEach(function(k,idx){
    var g=grouped[k];
    currentCrews.push({
      id:Date.now()+idx,num:idx+1,
      location:g.location,wo:g.wo,cworxWO:g.cworxWO,contractor:g.contractor,
      foremen:g.foremen,leads:g.leads,workDescs:g.workDescs,
      permitHours:g.permitHours,psc:g.psc,
      contingency:g.contingency,contingencyNum:g.contingencyNum,code753:g.code753||'',holdPoint:g.holdPoint,fusingPeer:g.fusingPeer||'',
      trades:DEFAULT_TRADES.map(function(t){return {n:t.n,c:t.c};}),
      equip:DEFAULT_EQUIP.map(function(e){return {n:e.n,c:e.c};}),
      comments:'',te:false,teHours:'',teReason:'',teRemarks:'',_fromRoute:true
    });
  });
  var rd=(allData&&allData.routeDate)||today();
  document.getElementById('log-date').value=rd;
  lastDraftSave=Date.now();
  updateDateDisplay();
  saveWorkingDLR();
  renderCrews();showPage('dlr');
  showToast(keys.length+' block'+(keys.length!==1?'s':'')+' generated'+(allData&&allData.routeDate?' · '+rd:''));
}

// ── DLR RENDERING ────────────────────────────────────────────────
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){var dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
function updateDateDisplay(){var v=document.getElementById('log-date').value;document.getElementById('today-display').textContent=fmtDate(v);mileDate=v;saveWorkingDLR();renderMileage();}
function initLogDate(){var d=today();document.getElementById('log-date').value=d;document.getElementById('today-display').textContent=fmtDate(d);}

function addCrew(){
  var idx=currentCrews.length+1;
  currentCrews.push({id:Date.now(),num:idx,location:'',wo:'',cworxWO:'',contractor:'',foremen:[],workDescs:[],permitHours:'',psc:'',contingency:'',contingencyNum:'',code753:'',holdPoint:'',fusingPeer:'',
    trades:DEFAULT_TRADES.map(function(t){return {n:t.n,c:t.c};}),
    equip:DEFAULT_EQUIP.map(function(e){return {n:e.n,c:e.c};}),
    comments:'',te:false,teHours:'',teReason:'',teRemarks:'',_fromRoute:false});
  saveWorkingDLR();
  renderCrews();
  setTimeout(function(){var els=document.querySelectorAll('.crew-card');if(els.length)els[els.length-1].scrollIntoView({behavior:'smooth',block:'start'});},100);
}

function removeCrew(id){
  var cid=parseInt(id);
  currentCrews=currentCrews.filter(function(c){return c.id!==cid;});
  currentCrews.forEach(function(c,i){c.num=i+1;});
  saveWorkingDLR();
  renderCrews();
}

function renderCrews(){
  var container=document.getElementById('crews-container');
  if(currentCrews.length===0){
    container.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--ink-4);font-size:14px">No crews yet.<br>Generate from route sheet or tap Add Crew.</div>';
    return;
  }
  container.innerHTML=currentCrews.map(function(crew){return crewHTML(crew);}).join('')+crewSummaryHTML();
}
// Copyable comma-separated WR#/WO# list for the day's jobs (mirrors All jobs footer).
function crewSummaryHTML(){
  var wrs=currentCrews.map(function(c){return c.wo||c.cworxWO||'';}).filter(Boolean);
  if(!wrs.length)return '';
  return '<div class="aj-summary">'+
    '<div class="aj-sum-h">'+wrs.length+' job'+(wrs.length!==1?'s':'')+' · WR#/WO# list</div>'+
    '<div class="aj-sum-list" id="day-wrs">'+escHtml(wrs.join(', '))+'</div>'+
    '<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="copyText(document.getElementById(\'day-wrs\').textContent)">Copy list</button>'+
  '</div>';
}

function renderOneCrew(cid){
  // Re-render a single crew card in place, preserving open/closed state
  var crew=currentCrews.find(function(c){return c.id===cid;});if(!crew)return;
  var oldCard=document.getElementById('crew-'+cid);if(!oldCard)return;
  var wasOpen=oldCard.querySelector('.crew-body')&&oldCard.querySelector('.crew-body').classList.contains('open');
  var tmp=document.createElement('div');
  tmp.innerHTML=crewHTML(crew);
  var newCard=tmp.firstChild;
  if(wasOpen){
    var body=newCard.querySelector('.crew-body');
    var chev=newCard.querySelector('.chevron');
    if(body)body.classList.add('open');
    if(chev)chev.classList.add('open');
  }
  oldCard.parentNode.replaceChild(newCard,oldCard);
}

function crewHTML(crew){
  var equipRows=crew.equip.map(function(item,i){
    return '<div class="count-row">'+
      '<span class="count-name">'+escHtml(item.n)+'</span>'+
      '<div class="count-controls">'+
        '<button class="count-btn" onclick="adjustItem(\'equip\','+crew.id+','+i+',-1)">−</button>'+
        '<input class="count-input" type="number" min="0" value="'+item.c+'" onchange="setItem(\'equip\','+crew.id+','+i+',this.value)">'+
        '<button class="count-btn" onclick="adjustItem(\'equip\','+crew.id+','+i+',1)">+</button>'+
        '<button class="count-remove" onclick="removeItem(\'equip\','+crew.id+','+i+')" title="Remove">×</button>'+
      '</div></div>';
  }).join('');

  var tradeRows=crew.trades.map(function(item,i){
    return '<div class="count-row">'+
      '<span class="count-name">'+escHtml(item.n)+'</span>'+
      '<div class="count-controls">'+
        '<button class="count-btn" onclick="adjustItem(\'trade\','+crew.id+','+i+',-1)">−</button>'+
        '<input class="count-input" type="number" min="0" value="'+item.c+'" onchange="setItem(\'trade\','+crew.id+','+i+',this.value)">'+
        '<button class="count-btn" onclick="adjustItem(\'trade\','+crew.id+','+i+',1)">+</button>'+
        '<button class="count-remove" onclick="removeItem(\'trade\','+crew.id+','+i+')" title="Remove">×</button>'+
      '</div></div>';
  }).join('');

  var fmHTML=crew.foremen&&crew.foremen.length?
    '<div class="foremen-wrap">'+crew.foremen.map(function(f){return '<span class="foreman-tag">'+escHtml(f)+'</span>';}).join('')+'</div>':
    '<input class="field-input" style="margin-top:4px" placeholder="Foreman name" oninput="updateCrewForeman('+crew.id+',this.value)">';

  var wdText=crew.workDescs&&crew.workDescs.length?crew.workDescs.join(' · '):'';
  var routeTag=crew._fromRoute?'<span class="crew-source-tag">Route</span>':'';
  var contBadge=isActive(crew.contingency)?
    '<button class="cont-chip" onclick="openContingencyCrew('+crew.id+')">⚠ '+escHtml(crew.contingencyNum||'Contingency')+' →</button>':
    '<span class="status-off">Contingency: No</span>';
  var hpBadge=isActive(crew.holdPoint)?
    '<button class="hp-chip" onclick="event.stopPropagation();holdPointAlbumCrew('+crew.id+')">📷 Hold Point: '+escHtml(crew.holdPoint)+'</button>':
    '<span class="status-off">Hold Point: No</span>';
  var leadTags=(crew.leads&&crew.leads.length)?
    crew.leads.map(function(l){var lbl=leadTypeLabel(l.type);return '<span class="lead-tag lead-'+l.type+'">'+(l.its?'<b class="lead-its">'+escHtml(l.its)+'</b>':'')+escHtml(l.name)+(lbl?'<i>'+lbl+'</i>':'')+'</span>';}).join(''):'';
  var fuseBadge=isActive(crew.fusingPeer)?
    '<span class="b-fuse">Pressure Test: '+escHtml(crew.fusingPeer)+'</span>':
    '<span class="status-off">Pressure Test: No</span>';
  var badgeBar='<div class="urgent-cap">Urgent Tasks</div><div class="badge-bar">'+contBadge+hpBadge+fuseBadge+'</div>'+
    '<button class="hpinfo-btn" onclick="event.stopPropagation();holdPointInfo('+crew.id+')">Hold Point info →</button>';
  var urg=[];
  if(isActive(crew.contingency))urg.push('<span class="utag ut-cont">⚠ '+escHtml(crew.contingencyNum||'Contingency')+'</span>');
  if(isActive(crew.holdPoint))urg.push('<span class="utag ut-hp">Hold Point</span>');
  if(isActive(crew.fusingPeer))urg.push('<span class="utag ut-pt">Pressure Test</span>');
  var metaLine=(leadTags||urg.length)?'<div class="crew-h-meta">'+leadTags+urg.join('')+'</div>':'';
  var wr=[crew.wo,crew.cworxWO].filter(Boolean).join(' · ');

  var coC=contractorColor(crew.contractor),coT=coC?hexToRgba(coC,0.12):'';
  return '<div class="crew-card" id="crew-'+crew.id+'"'+(coC?' style="border-left-color:'+coC+'"':'')+'>'+
    '<div class="crew-card-header" onclick="toggleCrew('+crew.id+')"'+(coT?' style="background:'+coT+'"':'')+'>'+
      '<div style="flex:1;min-width:0">'+
        '<div class="crew-h-top"><h2>Job '+crew.num+'</h2>'+(wr?'<span class="crew-wr">'+escHtml(wr)+'</span>':'')+routeTag+'</div>'+
        (crew.location?'<div class="crew-loc-line">'+escHtml(shortAddr(crew.location))+'</div>':'')+
        metaLine+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'+
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();removeCrew('+crew.id+')" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center">×</button>'+
        '<span class="chevron open" id="chev-'+crew.id+'">⌄</span>'+
      '</div>'+
    '</div>'+
    '<div class="crew-body" id="body-'+crew.id+'">'+

      // Info fields
      '<div class="card-section">'+
        '<div class="field-row"><span class="field-label">Location</span><input class="field-input" value="'+escHtml(crew.location)+'" oninput="updateCrew('+crew.id+',\'location\',this.value)"></div>'+
        '<div class="field-row"><span class="field-label">Ticket #</span><input class="field-input" value="'+escHtml(crew.wo)+'" oninput="updateCrew('+crew.id+',\'wo\',this.value)"></div>'+
        '<div class="field-row"><span class="field-label">WO #</span><input class="field-input" value="'+escHtml(crew.cworxWO)+'" oninput="updateCrew('+crew.id+',\'cworxWO\',this.value)"></div>'+
        '<div class="field-row"><span class="field-label">Contractor</span><input class="field-input" value="'+escHtml(crew.contractor)+'" oninput="updateCrew('+crew.id+',\'contractor\',this.value)"></div>'+
        '<div class="field-row"><span class="field-label">Foreman(s)</span><div style="flex:1">'+fmHTML+'</div></div>'+
        (wdText?'<div class="field-row"><span class="field-label">Work</span><div style="flex:1;font-size:13px;color:var(--ink-2);padding-top:8px;line-height:1.4">'+escHtml(wdText)+'</div></div>':'')+
      '</div>'+

      badgeBar+

      // Equipment
      '<div class="card-section">'+
        '<div class="count-section-title">Equipment</div>'+
        equipRows+
        '<button class="add-item-btn" onclick="openPicker(\'equip\','+crew.id+')">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          'Add Equipment'+
        '</button>'+
      '</div>'+

      // Trades
      '<div class="card-section">'+
        '<div class="count-section-title">Employee Trades</div>'+
        tradeRows+
        '<button class="add-item-btn" onclick="openPicker(\'trade\','+crew.id+')">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          'Add Trade'+
        '</button>'+
      '</div>'+

      // Nudge
      '<div id="nudge-'+crew.id+'" class="nudge"></div>'+

      // Comments
      '<div class="card-section">'+
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-4);margin-bottom:6px">Comments</div>'+
        '<textarea class="field-input" rows="3" placeholder="Labor / task performed today…" oninput="updateCrew('+crew.id+',\'comments\',this.value)">'+escHtml(crew.comments)+'</textarea>'+
      '</div>'+

      // T&E
      '<div class="card-section">'+
        '<div class="te-toggle" onclick="toggleTE('+crew.id+')">'+
          '<span class="te-toggle-label'+(crew.te?' on':'')+'">Potential T&amp;E</span>'+
          '<div class="te-check'+(crew.te?' on':'')+'" id="te-check-'+crew.id+'">'+(crew.te?'✓':'')+' </div>'+
        '</div>'+
        '<div class="te-fields'+(crew.te?' open':'')+'" id="te-fields-'+crew.id+'">'+
          '<div class="te-grid">'+
            '<div class="te-field"><label>Trade Hours</label><input class="field-input" placeholder="e.g. 8:00" value="'+escHtml(crew.teHours||'')+'" oninput="updateCrew('+crew.id+',\'teHours\',this.value)"></div>'+
            '<div class="te-field"><label>T&amp;E Reason</label><input class="field-input" placeholder="Field Decision" value="'+escHtml(crew.teReason||'')+'" oninput="updateCrew('+crew.id+',\'teReason\',this.value)"></div>'+
          '</div>'+
          '<div class="te-field"><label>T&amp;E Remarks</label><textarea class="field-input" rows="2" placeholder="8 HOURS T&E - ALL CREW / EQUIPMENT" oninput="updateCrew('+crew.id+',\'teRemarks\',this.value)">'+escHtml(crew.teRemarks||'')+'</textarea></div>'+
        '</div>'+
      '</div>'+

    '</div>'+
  '</div>';
}

function toggleCrew(id){
  var b=document.getElementById('body-'+id);var c=document.getElementById('chev-'+id);
  if(b)b.classList.toggle('open');if(c)c.classList.toggle('open');
}

function toggleTE(id){
  var crew=currentCrews.find(function(c){return c.id===parseInt(id);});if(!crew)return;
  crew.te=!crew.te;
  var check=document.getElementById('te-check-'+id);var fields=document.getElementById('te-fields-'+id);
  var lbl=check&&check.previousElementSibling;
  if(check){check.className='te-check'+(crew.te?' on':'');check.textContent=crew.te?'✓':'';}
  if(fields)fields.classList.toggle('open',crew.te);
  if(lbl)lbl.classList.toggle('on',crew.te);
  saveWorkingDLR();
}

function updateCrew(id,field,val){var cid=parseInt(id);var crew=currentCrews.find(function(c){return c.id===cid;});if(crew){crew[field]=val;saveWorkingDLR();}}
function updateCrewForeman(id,val){var cid=parseInt(id);var crew=currentCrews.find(function(c){return c.id===cid;});if(crew){crew.foremen=[val];saveWorkingDLR();}}

function adjustItem(type,crewId,idx,delta){
  var cid=parseInt(crewId);
  var crew=currentCrews.find(function(c){return c.id===cid;});if(!crew)return;
  var arr=type==='trade'?crew.trades:crew.equip;
  var i=parseInt(idx);
  var item=arr[i];if(!item)return;
  item.c=Math.max(0,(item.c||0)+delta);
  // update just the input field without full re-render
  var inputs=document.querySelectorAll('#crew-'+cid+' .count-input');
  var offset=type==='equip'?0:crew.equip.length;
  if(inputs[offset+i])inputs[offset+i].value=item.c;
  if(type==='trade')checkNudge(crew,item.n,item.c);
  saveWorkingDLR();
}

function setItem(type,crewId,idx,val){
  var cid=parseInt(crewId);
  var crew=currentCrews.find(function(c){return c.id===cid;});if(!crew)return;
  var arr=type==='trade'?crew.trades:crew.equip;
  var i=parseInt(idx);
  if(!arr[i])return;
  arr[i].c=Math.max(0,parseInt(val)||0);
  if(type==='trade')checkNudge(crew,arr[i].n,arr[i].c);
  saveWorkingDLR();
}

function removeItem(type,crewId,idx){
  var cid=parseInt(crewId);
  var crew=currentCrews.find(function(c){return c.id===cid;});if(!crew)return;
  var arr=type==='trade'?crew.trades:crew.equip;
  arr.splice(parseInt(idx),1);
  saveWorkingDLR();
  // Re-render just this crew's section to fix indices
  renderOneCrew(cid);
}

function checkNudge(crew,name,count){
  var nudgeEl=document.getElementById('nudge-'+crew.id);if(!nudgeEl)return;
  var msg=NUDGE[name];if(!msg){nudgeEl.classList.remove('visible');return;}
  if(count>0){nudgeEl.textContent=msg;nudgeEl.classList.add('visible');}
  else nudgeEl.classList.remove('visible');
}

// ── PICKER ───────────────────────────────────────────────────────
function openPicker(type,crewId){
  pickerCrewId=parseInt(crewId);pickerType=type;
  var crew=currentCrews.find(function(c){return c.id===pickerCrewId;});
  var masterList=(type==='trade'?trades:equipment).slice().sort(function(a,b){
    if(a==='Other')return 1;if(b==='Other')return -1; // keep the catch-all last
    return a.localeCompare(b);
  });
  var activeNames=(type==='trade'?crew.trades:crew.equip).map(function(i){return i.n;});
  document.getElementById('picker-title').textContent=type==='trade'?'Add Trade':'Add Equipment';
  var list=document.getElementById('picker-list');
  list.innerHTML=masterList.map(function(name){
    var already=activeNames.indexOf(name)!==-1;
    return '<div class="picker-item'+(already?' already':'')+'" onclick="'+(already?'':('pickItem(\''+escHtml(name)+'\')'))+'">' +escHtml(name)+'</div>';
  }).join('');
  document.getElementById('picker-overlay').style.display='block';
}

function pickItem(name){
  var crew=currentCrews.find(function(c){return c.id===pickerCrewId;});if(!crew)return;
  var arr=pickerType==='trade'?crew.trades:crew.equip;
  if(arr.find(function(i){return i.n===name;})){closePicker();return;}
  arr.push({n:name,c:1});
  var t=pickerType;var cid=pickerCrewId;
  saveWorkingDLR();
  closePicker();
  renderOneCrew(cid);
  if(t==='trade')checkNudge(crew,name,1);
}

function closePicker(e){
  if(e&&!e.target.classList.contains('picker-overlay'))return;
  document.getElementById('picker-overlay').style.display='none';
  pickerCrewId=null;pickerType=null;
}

function saveDraft(){
  var date=document.getElementById('log-date').value;
  var drafts=getData('dlr_drafts',{}),sa=new Date().toISOString();
  drafts[date]={date:date,crews:JSON.parse(JSON.stringify(currentCrews)),savedAt:sa};
  setData('dlr_drafts',drafts);lastDraftSave=new Date(sa).getTime();syncPushDrafts();showToast('Draft saved — syncs to your other devices');
}
// Notes-style: another device saved this day's crews → offer to load (never auto-overwrite).
var lastDraftSave=0;
function maybeNotifyDraft(){
  if(!syncOn())return;
  var ld=document.getElementById('log-date');if(!ld||!ld.value)return;
  if(!document.getElementById('page-dlr').classList.contains('active'))return;
  var dr=getData('dlr_drafts',{})[ld.value];if(!dr||!dr.savedAt)return;
  var sa=new Date(dr.savedAt).getTime();if(sa<=lastDraftSave)return;
  if(JSON.stringify(dr.crews||[])===JSON.stringify(currentCrews)){lastDraftSave=sa;return;}
  showDraftBanner(ld.value,dr.savedAt);
}
function showDraftBanner(date,saISO){
  var ex=document.getElementById('draft-banner');if(ex)ex.parentNode.removeChild(ex);
  var t=new Date(saISO).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  var b=document.createElement('div');b.id='draft-banner';b.className='update-banner';
  b.innerHTML='<span>Crews updated on another device ('+t+')</span><span class="ub-go">Tap to load →</span>';
  b.onclick=function(){loadDraftForDate(date);};
  document.body.appendChild(b);
}
function loadDraftForDate(d){
  var dr=getData('dlr_drafts',{})[d];if(!dr)return;
  currentCrews=JSON.parse(JSON.stringify(dr.crews||[]));
  lastDraftSave=new Date(dr.savedAt||Date.now()).getTime();
  var ld=document.getElementById('log-date');if(ld)ld.value=d;
  saveWorkingDLR();renderCrews();renderMileage();
  var b=document.getElementById('draft-banner');if(b)b.parentNode.removeChild(b);
  showToast('Loaded crews from your other device');
}

function submitLog(){
  var date=document.getElementById('log-date').value;
  if(currentCrews.length===0){showToast('Add at least one crew');return;}
  var idx=logs.findIndex(function(l){return l.date===date;});
  var now=new Date().toISOString();
  var createdAt=(idx>=0&&logs[idx].createdAt)||now;
  var entry={date:date,crews:JSON.parse(JSON.stringify(currentCrews)),submitted:true,createdAt:createdAt,savedAt:now};
  if(idx>=0)logs[idx]=entry;else logs.unshift(entry);
  logs.sort(function(a,b){return b.date.localeCompare(a.date);});
  setData('dlr_logs',logs);
  syncPushLog(entry);
  var drafts=getData('dlr_drafts',{});delete drafts[date];setData('dlr_drafts',drafts);syncPushDrafts();
  clearWorkingDLR();
  showToast('Log submitted');currentCrews=[];initLogDate();renderCrews();
}

function loadTodayDraft(){
  var d=today();var drafts=getData('dlr_drafts',{});
  if(drafts[d]){currentCrews=drafts[d].crews;lastDraftSave=new Date(drafts[d].savedAt||Date.now()).getTime();showToast('Draft restored');}
}

// ── HISTORY ──────────────────────────────────────────────────────
function renderHistory(){
  var q=(document.getElementById('search-input')&&document.getElementById('search-input').value||'').toLowerCase();
  var list=document.getElementById('history-list');
  var filtered=logs;
  if(q)filtered=logs.filter(function(l){return l.date.includes(q)||fmtDate(l.date).toLowerCase().includes(q)||l.crews.some(function(c){return(c.location||'').toLowerCase().includes(q)||(c.wo||'').toLowerCase().includes(q)||(c.foremen||[]).join(' ').toLowerCase().includes(q);});});
  if(filtered.length===0){list.innerHTML='<div class="empty-state"><p>'+(logs.length===0?'No logs submitted yet':'No results found')+'</p></div>';return;}
  var sort=(document.getElementById('history-sort')||{}).value||'date-desc';
  filtered=filtered.slice().sort(function(a,b){
    switch(sort){
      case 'date-asc':    return a.date.localeCompare(b.date);
      case 'created-desc':return (b.createdAt||b.savedAt||b.date).localeCompare(a.createdAt||a.savedAt||a.date);
      case 'created-asc': return (a.createdAt||a.savedAt||a.date).localeCompare(b.createdAt||b.savedAt||b.date);
      case 'updated-desc':return (b.savedAt||b.date).localeCompare(a.savedAt||a.date);
      case 'updated-asc': return (a.savedAt||a.date).localeCompare(b.savedAt||b.date);
      default:            return b.date.localeCompare(a.date);
    }
  });
  list.innerHTML=filtered.map(function(log){
    var tw=log.crews.reduce(function(s,c){return s+(c.trades||[]).reduce(function(a,t){return a+(t.c||0);},0);},0);
    var crewsHTML=log.crews.map(function(c){
      var tl=(c.trades||[]).filter(function(t){return t.c>0;}).map(function(t){return t.n+': '+t.c;}).join(' · ');
      var el=(c.equip||[]).filter(function(e){return e.c>0;}).map(function(e){return e.n+': '+e.c;}).join(' · ');
      return '<div class="log-crew-row">'+
        '<div class="log-crew-name">Crew '+c.num+(c.foremen&&c.foremen.length?' — '+c.foremen.slice(0,2).join(', '):'')+(c._fromRoute?' <span style="font-size:10px;color:var(--green);font-weight:700">ROUTE</span>':'')+'</div>'+
        '<div class="log-crew-detail">'+
          (c.location?'📍 '+c.location+'<br>':'')+
          (c.wo?'Ticket: <b>'+c.wo+'</b>'+(c.cworxWO?' · WO: <b>'+c.cworxWO+'</b>':'')+'<br>':'')+
          (tl?tl+'<br>':'')+
          (el?el+'<br>':'')+
          (c.comments?c.comments.substring(0,80)+(c.comments.length>80?'…':'')+'<br>':'')+
          (c.te?'T&E: '+(c.teHours||'')+(c.teReason?' · '+c.teReason:''):'')+
        '</div></div>';
    }).join('');
    var edited=(log.createdAt&&log.savedAt&&log.savedAt!==log.createdAt);
    var editedBadge=edited?' <span class="edited-tag">EDITED</span>':'';
    var savedTxt=log.savedAt?(' · saved '+fmtShortStamp(log.savedAt)):'';
    return '<div class="log-day">'+
      '<div class="log-day-header" onclick="toggleDay(\''+log.date+'\')">'+
        '<div><div class="log-day-title">'+fmtDate(log.date)+editedBadge+'</div><div class="log-day-meta">'+log.crews.length+' crew'+(log.crews.length!==1?'s':'')+savedTxt+'</div></div>'+
        '<span class="chevron" id="daychev-'+log.date+'">⌄</span></div>'+
      '<div class="log-expanded" id="daylog-'+log.date+'">'+crewsHTML+
        '<div style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap">'+
          '<button class="btn btn-secondary btn-sm" onclick="loadLogForEdit(\''+log.date+'\')">Edit</button>'+
          '<button class="btn btn-secondary btn-sm" onclick="duplicateLog(\''+log.date+'\')">Duplicate</button>'+
          '<button class="btn btn-secondary btn-sm" onclick="copyLogFormatted(\''+log.date+'\')">Copy</button>'+
          '<button class="btn btn-secondary btn-sm" onclick="shareLog(\''+log.date+'\')">Share</button>'+
          '<button class="btn btn-danger btn-sm" onclick="deleteLog(\''+log.date+'\')">Delete</button>'+
        '</div></div></div>';
  }).join('');
}
function fmtShortStamp(iso){var d=new Date(iso);if(isNaN(d))return '';return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
function duplicateLog(date){
  var log=logs.find(function(l){return l.date===date;});if(!log)return;
  currentCrews=JSON.parse(JSON.stringify(log.crews));
  var d=today();
  document.getElementById('log-date').value=d;
  updateDateDisplay();saveWorkingDLR();renderCrews();showPage('dlr');
  showToast('Copied to today — edit & submit');
}

function toggleDay(date){var el=document.getElementById('daylog-'+date);var ch=document.getElementById('daychev-'+date);if(el)el.classList.toggle('open');if(ch)ch.classList.toggle('open');}
function loadLogForEdit(date){var log=logs.find(function(l){return l.date===date;});if(!log)return;currentCrews=JSON.parse(JSON.stringify(log.crews));document.getElementById('log-date').value=date;updateDateDisplay();saveWorkingDLR();renderCrews();showPage('dlr');showToast('Log loaded for editing');}
function deleteLog(date){if(!confirm('Delete log for '+fmtDate(date)+'?'))return;logs=logs.filter(function(l){return l.date!==date;});setData('dlr_logs',logs);syncDeleteLog(date);renderHistory();updateSettingsCounts();showToast('Log deleted');}

// ── SETTINGS ─────────────────────────────────────────────────────
function showListEditor(type){
  editingList=type;var items=type==='trade'?trades:equipment;
  document.getElementById('list-modal-title').textContent=type==='trade'?'Employee Trades':'Equipment Types';
  document.getElementById('new-item-input').value='';
  renderListItems(items);document.getElementById('list-modal').style.display='block';
}
function renderListItems(items){
  document.getElementById('list-modal-items').innerHTML=items.map(function(item,i){
    return '<div class="master-list-item"><span>'+item+'</span><button class="btn btn-danger btn-sm" onclick="removeListItem('+i+')" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center">×</button></div>';
  }).join('');
}
function addListItem(){var input=document.getElementById('new-item-input');var val=input.value.trim();if(!val)return;if(editingList==='trade'){trades.push(val);setData('dlr_trades',trades);renderListItems(trades);}else{equipment.push(val);setData('dlr_equipment',equipment);renderListItems(equipment);}input.value='';updateSettingsCounts();syncPushLists();}
function removeListItem(i){if(editingList==='trade'){trades.splice(i,1);setData('dlr_trades',trades);renderListItems(trades);}else{equipment.splice(i,1);setData('dlr_equipment',equipment);renderListItems(equipment);}updateSettingsCounts();syncPushLists();}
function closeListModal(e){if(!e||e.target.classList.contains('modal-overlay'))document.getElementById('list-modal').style.display='none';}
function updateSettingsCounts(){document.getElementById('trade-count').textContent=trades.length+' items';document.getElementById('equip-count').textContent=equipment.length+' items';document.getElementById('log-count-display').textContent=logs.length;}
function clearAllData(){if(!confirm('Delete ALL logs and settings? Cannot be undone.'))return;localStorage.clear();trades=CWORX_TRADES.slice();equipment=CWORX_EQUIPMENT.slice();logs=[];currentCrews=[];setData('dlr_trades',trades);setData('dlr_equipment',equipment);updateSettingsCounts();showToast('All data cleared');}

// Home-screen PWAs can't be hard-refreshed; this pulls the newest service
// worker and reloads (network-first shell then serves the fresh files).
function checkForUpdate(){
  showToast('Checking for updates…');
  if('serviceWorker' in navigator&&navigator.serviceWorker.getRegistrations){
    navigator.serviceWorker.getRegistrations().then(function(regs){
      return Promise.all(regs.map(function(r){return r.update();}));
    })['catch'](function(){}).then(function(){setTimeout(function(){location.reload();},500);});
  }else location.reload();
}

// ── BACKUP / RESTORE (all data lives in localStorage on this device only) ──
function backupData(){
  var data={app:'FieldLog',version:1,exportedAt:new Date().toISOString(),
    logs:getData('dlr_logs',[]),drafts:getData('dlr_drafts',{}),
    trades:getData('dlr_trades',CWORX_TRADES),equipment:getData('dlr_equipment',CWORX_EQUIPMENT)};
  var json=JSON.stringify(data,null,2);
  var name='FieldLog_Backup_'+today()+'.json';
  if(navigator.share&&navigator.canShare){
    try{
      var file=new File([json],name,{type:'application/json'});
      if(navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:name}).catch(function(err){if(err&&err.name!=='AbortError')downloadFile(name,json,'application/json');});
        return;
      }
    }catch(e){}
  }
  downloadFile(name,json,'application/json');
}
function restoreFromFile(input){
  var f=input.files&&input.files[0];if(!f){return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data||(!data.logs&&!data.trades))throw new Error('not a Field Log backup');
      var n=(data.logs||[]).length;
      if(!confirm('Restore this backup ('+n+' log'+(n!==1?'s':'')+')? Logs & drafts are merged (backup wins on the same date); master lists are replaced.')){input.value='';return;}
      var byDate={};getData('dlr_logs',[]).forEach(function(l){byDate[l.date]=l;});
      (data.logs||[]).forEach(function(l){var ex=byDate[l.date];if(!ex||!ex.savedAt||(l.savedAt&&l.savedAt>=ex.savedAt))byDate[l.date]=l;});
      logs=Object.keys(byDate).map(function(k){return byDate[k];}).sort(function(a,b){return b.date.localeCompare(a.date);});
      setData('dlr_logs',logs);
      var curD=getData('dlr_drafts',{}),impD=data.drafts||{};
      Object.keys(impD).forEach(function(k){curD[k]=impD[k];});setData('dlr_drafts',curD);
      if(data.trades&&data.trades.length){trades=data.trades.slice();setData('dlr_trades',trades);}
      if(data.equipment&&data.equipment.length){equipment=data.equipment.slice();setData('dlr_equipment',equipment);}
      updateSettingsCounts();renderHistory();syncPushAll();
      showToast('Restored — '+logs.length+' logs total');
    }catch(err){showToast('Restore failed: '+err.message);}
    input.value='';
  };
  reader.onerror=function(){showToast('Could not read file');input.value='';};
  reader.readAsText(f);
}

function showExportModal(){var d=today();var ago=new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0];document.getElementById('export-from').value=ago;document.getElementById('export-to').value=d;document.getElementById('export-filter').value='';document.getElementById('export-modal').style.display='block';}
function closeExportModal(e){if(!e||e.target.classList.contains('modal-overlay'))document.getElementById('export-modal').style.display='none';}
function getFilteredLogs(){var from=document.getElementById('export-from').value;var to=document.getElementById('export-to').value;var f=(document.getElementById('export-filter').value||'').toLowerCase();return logs.filter(function(l){if(from&&l.date<from)return false;if(to&&l.date>to)return false;if(f)return l.crews.some(function(c){return(c.wo||'').toLowerCase().includes(f)||(c.location||'').toLowerCase().includes(f);});return true;});}

function exportCSV(){
  var filtered=getFilteredLogs();if(!filtered.length){showToast('No logs in range');return;}
  var rows=[['Date','Crew #','Location','Ticket #','CWORX WO #','Contractor','Foreman(s)','Work Description','Employee Trades','Equipment','Comments','T&E','T&E Hours','T&E Reason','T&E Remarks'].join(',')];
  filtered.forEach(function(log){
    log.crews.forEach(function(c){
      var tl=(c.trades||[]).filter(function(t){return t.c>0;}).map(function(t){return t.n+': '+t.c;}).join('; ');
      var el=(c.equip||[]).filter(function(e){return e.c>0;}).map(function(e){return e.n+': '+e.c;}).join('; ');
      var row=[log.date,'Crew '+c.num,'"'+(c.location||'').replace(/"/g,'""')+'"','"'+(c.wo||'').replace(/"/g,'""')+'"','"'+(c.cworxWO||'').replace(/"/g,'""')+'"','"'+(c.contractor||'').replace(/"/g,'""')+'"','"'+((c.foremen||[]).join(', ')).replace(/"/g,'""')+'"','"'+((c.workDescs||[]).join(' - ')).replace(/"/g,'""')+'"','"'+tl+'"','"'+el+'"','"'+(c.comments||'').replace(/"/g,'""').replace(/\n/g,' ')+'"',c.te?'Yes':'No','"'+(c.teHours||'')+'"','"'+(c.teReason||'')+'"','"'+(c.teRemarks||'').replace(/"/g,'""').replace(/\n/g,' ')+'"'];
      rows.push(row.join(','));
    });
  });
  downloadFile('DLR_Export_'+today()+'.csv',rows.join('\n'),'text/csv');closeExportModal();showToast('CSV exported');
}

function exportTXT(){
  var filtered=getFilteredLogs();if(!filtered.length){showToast('No logs in range');return;}
  var lines=['CON EDISON - DAILY LOG REPORT','Exported: '+new Date().toLocaleString(),'='.repeat(50),''];
  filtered.forEach(function(log){
    lines.push(fmtDate(log.date).toUpperCase());lines.push('-'.repeat(40));
    log.crews.forEach(function(c){
      lines.push('CREW '+c.num+(c.foremen&&c.foremen.length?' - '+c.foremen.join(', '):''));
      if(c.location)lines.push('  Location: '+c.location);
      if(c.wo)lines.push('  Ticket #: '+c.wo);if(c.cworxWO)lines.push('  CWORX WO: '+c.cworxWO);
      if(c.contractor)lines.push('  Contractor: '+c.contractor);
      var tl=(c.trades||[]).filter(function(t){return t.c>0;}).map(function(t){return t.n+': '+t.c;}).join(', ');if(tl)lines.push('  Trades: '+tl);
      var el=(c.equip||[]).filter(function(e){return e.c>0;}).map(function(e){return e.n+': '+e.c;}).join(', ');if(el)lines.push('  Equipment: '+el);
      if(c.comments)lines.push('  Comments: '+c.comments);
      if(c.te){lines.push('  T&E: '+(c.teHours||'')+(c.teReason?' - '+c.teReason:''));if(c.teRemarks)lines.push('  T&E Remarks: '+c.teRemarks);}
      lines.push('');
    });lines.push('');
  });
  downloadFile('DLR_Report_'+today()+'.txt',lines.join('\n'),'text/plain');closeExportModal();showToast('Report exported');
}

function downloadFile(name,content,type){var blob=new Blob([content],{type:type});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);}

// ── SHARE (iOS share sheet → Notes / OneNote / etc.) ─────────────
// Builds a clean, readable text report for ONE log and hands it to the
// native share sheet. On iPhone the sheet offers Notes, OneNote (if
// installed), Mail, Messages, and Copy. Works offline.
// Short names matching the user's Apple Notes DLR template.
var TRADE_ABBR={
  'Foreman':'FOREMAN','Operating Engineer':'OPERATOR','Laborers':'LABORER',
  'Maintenance Engineer':'MECH','Welders':'WELDER','Chauffeur':'CHAFF','Flagger':'FLAGGER'
};
var EQUIP_ABBR={
  'Pick Up Truck':'4x4 TRK','Backhoe':'BACKHOE','Compressor Truck':'COMP TRK',
  'Box Truck':'BOX TRK','Weld Truck':'WELD TRK','Dump Truck':'DUMP TRK'
};
function abbr(map,name){return map[name]||String(name||'').toUpperCase();}
function padR(s,n){s=String(s==null?'':s);while(s.length<n)s+=' ';return s;}

// Build a plain-text report that mirrors the Apple Notes "Daily Log Report"
// template (dividers, ••(CREW n) headers, aligned CREW/EQUIPMENT columns,
// Task/Description/T&E/Explanation/Notes scaffold). Reads best in a
// monospaced note. Tables can't be injected via the share sheet, so the
// grid is rendered as aligned text columns.
function buildLogText(log){
  var RULE='━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  var d=new Date(log.date+'T12:00:00');
  var dateLine=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  var out=[];
  // First line becomes the Notes title — carries the (route-sheet) date.
  out.push('Daily Log Report — '+dateLine);
  out.push('');
  log.crews.forEach(function(c,ci){
    if(ci>0){out.push('');out.push(RULE);out.push('');}
    out.push('CREW '+c.num);
    var lead=(c.foremen||[]).join(', ');
    if(lead)out.push(padR('Crew Lead:',12)+lead);
    if(c.contractor)out.push(padR('Contractor:',12)+c.contractor);
    if(c.location)out.push(padR('Location:',12)+c.location);
    var wr=[c.wo,c.cworxWO].filter(Boolean).join('  ');
    if(wr)out.push(padR('WO/WR#:',12)+wr);
    out.push('');
    // CREW / EQUIPMENT as aligned monospaced columns
    var crewList=(c.trades||[]).filter(function(t){return t.c>0;}).map(function(t){return {n:abbr(TRADE_ABBR,t.n),c:t.c};});
    var equipList=(c.equip||[]).filter(function(e){return e.c>0;}).map(function(e){return {n:abbr(EQUIP_ABBR,e.n),c:e.c};});
    if(crewList.length||equipList.length){
      out.push(padR('CREW',18)+'EQUIPMENT');
      var rowN=Math.max(crewList.length,equipList.length);
      for(var i=0;i<rowN;i++){
        var L=crewList[i]?padR(crewList[i].n,10)+crewList[i].c:'';
        var R=equipList[i]?padR(equipList[i].n,10)+equipList[i].c:'';
        out.push(padR(L,18)+R);
      }
      out.push('');
    }
    // Task / Description, then Labor Crew / Mechanic / Welders ONLY if that
    // trade is on the crew. Comments ride on Labor Crew (else Description).
    var hasLab=(c.trades||[]).some(function(t){return t.n==='Laborers'&&t.c>0;});
    var hasMech=(c.trades||[]).some(function(t){return t.n==='Maintenance Engineer'&&t.c>0;});
    var hasWeld=(c.trades||[]).some(function(t){return t.n==='Welders'&&t.c>0;});
    out.push('Task:');
    out.push('Description:'+((c.comments&&!hasLab)?(' '+c.comments):''));
    if(hasLab)out.push('Labor Crew:'+(c.comments?(' '+c.comments):''));
    if(hasMech)out.push('Mechanic:');
    if(hasWeld)out.push('Welders:');
    if(c.te){
      out.push('');
      out.push(padR('T&E:',12)+(c.teHours||'')+'    OT:');
      var teNote=[c.teReason,c.teRemarks].filter(Boolean).join(' — ');
      if(teNote)out.push(teNote);
    }
  });
  return out.map(function(l){return l.replace(/\s+$/,'');}).join('\n');
}

function fallbackCopy(text){
  try{
    var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.focus();ta.select();
    var ok=document.execCommand('copy');document.body.removeChild(ta);
    showToast(ok?'Copied — paste into Notes':'Could not share');
  }catch(e){showToast('Could not share');}
}

function shareText(title,text){
  if(navigator.share){
    navigator.share({title:title,text:text}).catch(function(err){
      // User cancelling the share sheet rejects with AbortError — ignore that.
      if(err&&err.name!=='AbortError'){
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(function(){showToast('Copied — paste into Notes');}).catch(function(){fallbackCopy(text);});
        }else fallbackCopy(text);
      }
    });
  }else if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){showToast('Copied — paste into Notes');}).catch(function(){fallbackCopy(text);});
  }else{
    fallbackCopy(text);
  }
}

function shareCurrentDLR(){
  if(currentCrews.length===0){showToast('No crews to share');return;}
  var date=document.getElementById('log-date').value;
  shareText('DLR — '+fmtDate(date),buildLogText({date:date,crews:currentCrews}));
}

function shareLog(date){
  var log=logs.find(function(l){return l.date===date;});if(!log)return;
  shareText('DLR — '+fmtDate(date),buildLogText(log));
}

// ── DLR rich copy (real table + bold for Notes / OneNote) ────────
// Plain share can't carry a table; this puts text/html on the clipboard so a
// paste into Notes becomes an actual crew/equipment table with bold labels.
function copyText(t){t=t||'';if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){showToast('Copied');}).catch(function(){fallbackCopy(t);});else fallbackCopy(t);}
function copyRich(plain,html,msg){
  msg=msg||'Copied — paste into Notes';
  if(window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
    try{
      var item=new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})});
      navigator.clipboard.write([item]).then(function(){showToast(msg);}).catch(function(){fallbackCopy(plain);});
      return;
    }catch(e){}
  }
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(plain).then(function(){showToast(msg);}).catch(function(){fallbackCopy(plain);});
  else fallbackCopy(plain);
}
function buildLogHTML(log){
  var d=new Date(log.date+'T12:00:00');
  var dateLine=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  var out=['<b>Daily Log Report — '+bcEsc(dateLine)+'</b>'];
  log.crews.forEach(function(c){
    out.push('<br>');
    out.push('<b>CREW '+c.num+'</b>');
    var meta=[];
    var lead=(c.foremen||[]).join(', ');
    if(lead)meta.push('<b>Crew Lead:</b> '+bcEsc(lead));
    if(c.contractor)meta.push('<b>Contractor:</b> '+bcEsc(c.contractor));
    if(c.location)meta.push('<b>Location:</b> '+bcEsc(c.location));
    var wr=[c.wo,c.cworxWO].filter(Boolean).join('  ');
    if(wr)meta.push('<b>WO/WR#:</b> '+bcEsc(wr));
    if(meta.length)out.push(meta.join('<br>'));
    var crewList=(c.trades||[]).filter(function(t){return t.c>0;});
    var equipList=(c.equip||[]).filter(function(e){return e.c>0;});
    if(crewList.length||equipList.length){
      var rowN=Math.max(crewList.length,equipList.length);
      var tbl='<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse"><tr><td><b>CREW</b></td><td><b>#</b></td><td><b>EQUIPMENT</b></td><td><b>#</b></td></tr>';
      for(var i=0;i<rowN;i++){
        var L=crewList[i],R=equipList[i];
        tbl+='<tr><td>'+(L?bcEsc(L.n):'')+'</td><td>'+(L?L.c:'')+'</td><td>'+(R?bcEsc(R.n):'')+'</td><td>'+(R?R.c:'')+'</td></tr>';
      }
      out.push(tbl+'</table>');
    }
    var hasLab=crewList.some(function(t){return t.n==='Laborers';});
    var hasMech=crewList.some(function(t){return t.n==='Maintenance Engineer';});
    var hasWeld=crewList.some(function(t){return t.n==='Welders';});
    var lines=['<b>Task:</b>','<b>Description:</b>'+((c.comments&&!hasLab)?(' '+bcEsc(c.comments)):'')];
    if(hasLab)lines.push('<b>Labor Crew:</b>'+(c.comments?(' '+bcEsc(c.comments)):''));
    if(hasMech)lines.push('<b>Mechanic:</b>');
    if(hasWeld)lines.push('<b>Welders:</b>');
    if(c.te){
      lines.push('<b>T&amp;E:</b> '+bcEsc(c.teHours||'')+'   <b>OT:</b>');
      var teNote=[c.teReason,c.teRemarks].filter(Boolean).join(' — ');
      if(teNote)lines.push(bcEsc(teNote));
    }
    out.push(lines.join('<br>'));
  });
  return out.join('<br>');
}
function copyCurrentDLRFormatted(){
  if(currentCrews.length===0){showToast('No crews to copy');return;}
  var log={date:document.getElementById('log-date').value,crews:currentCrews};
  copyRich(buildLogText(log),buildLogHTML(log));
}
function copyLogFormatted(date){
  var log=logs.find(function(l){return l.date===date;});if(!log)return;
  copyRich(buildLogText(log),buildLogHTML(log));
}

// ── CONTINGENCY REPORT (tap a contingency # → prefilled email) ───
// Builds the Con Edison contingency notification from the .docx template:
// route fields are preloaded, field details are typed in, then it opens a
// mailto: (recipients added in Mail) — or copies as a fallback.
function inspectorName(){return (allData&&allData.name)||(inspectorInput&&inspectorInput.value.trim())||'Jeremiah Flavin';}
function setContVal(id,v){var el=document.getElementById(id);if(el)el.value=v||'';}
function getContVal(id){var el=document.getElementById(id);return el?(el.value||'').trim():'';}

function openContingencyModal(p){
  p=p||{};
  setContVal('cont-num',p.num);setContVal('cont-layout',p.layout);setContVal('cont-code',p.code);
  setContVal('cont-contractor',p.contractor);setContVal('cont-inspector',p.inspector||inspectorName());
  setContVal('cont-scope','');setContVal('cont-comments','');
  // dimensions / distances / directions — typed fresh each time
  ['cont-dim-l','cont-dim-w','cont-dim-d','cont-pin1-dist','cont-pin1-dir',
   'cont-pin2-dist','cont-pin2-dir'].forEach(function(id){setContVal(id,'');});
  // Pre-fill the two cross streets from the workbook Location (e.g. "Bussing Ave & Bronxwood Ave").
  var streets=String(p.location||'').split(/\s*(?:&|\band\b|\/|@)\s*/i).filter(function(s){return s.trim();});
  setContVal('cont-pin1-ref',(streets[0]||'').trim());
  setContVal('cont-pin2-ref',(streets[1]||'').trim());
  // facility list — reset to a single fresh "main" row
  var fl=document.getElementById('cont-fac-list');if(fl)fl.innerHTML='';
  addFacRow();
  var subj='Contingency'+(p.num?' - '+p.num:'')+(p.location?' - '+p.location:'');
  setContVal('cont-subject',subj);
  document.getElementById('cont-modal').style.display='block';
}
function closeContModal(e){if(!e||e.target.classList.contains('modal-overlay'))document.getElementById('cont-modal').style.display='none';}

// Mirror raw feet entry back with a foot mark: 4 -> 4’ (idempotent).
function mirrorFeet(el){if(!el)return;var v=String(el.value||'').replace(/[’']+/g,'').trim();el.value=v?v+'’':'';}
// Facility "main" rows are repeatable; each is over OR a distance/direction away.
function facRowHTML(){
  return '<div class="fac-item" data-rel="over">'+
    '<div class="fac-head">'+
      '<div class="fac-rel-toggle">'+
        '<button type="button" class="fac-rel-btn active" onclick="setFacRel(this,\'over\')">Over</button>'+
        '<button type="button" class="fac-rel-btn" onclick="setFacRel(this,\'away\')">Away</button>'+
      '</div>'+
      '<button type="button" class="fac-remove" onclick="removeFacRow(this)">×</button>'+
    '</div>'+
    '<div class="fac-away" style="display:none">'+
      '<input class="field-input fac-dist" inputmode="decimal" enterkeyhint="next" placeholder="dist" onblur="mirrorFeet(this)">'+
      '<div class="dir-wrap fac-dir-wrap"><input class="field-input fac-dir" enterkeyhint="next" placeholder="N/S/E/W" autocapitalize="characters" autocorrect="off" spellcheck="false"><button type="button" class="dir-pick" onclick="openDirPicker(this,\'card\')">⌄</button></div>'+
    '</div>'+
    '<input class="field-input fac-desc" enterkeyhint="next" placeholder="36” XHP ST(C) 2013 Main">'+
  '</div>';
}
function addFacRow(){
  var list=document.getElementById('cont-fac-list');if(!list)return;
  var tmp=document.createElement('div');tmp.innerHTML=facRowHTML();
  list.appendChild(tmp.firstChild);
  updateFacRemoveButtons();
}
function facItem(el){while(el&&el!==document){if(el.className&&(' '+el.className+' ').indexOf(' fac-item ')!==-1)return el;el=el.parentNode;}return null;}
function removeFacRow(btn){
  var item=facItem(btn);
  if(item&&item.parentNode)item.parentNode.removeChild(item);
  updateFacRemoveButtons();
}
function updateFacRemoveButtons(){
  var items=document.querySelectorAll('#cont-fac-list .fac-item');
  items.forEach(function(it){var r=it.querySelector('.fac-remove');if(r)r.style.display=items.length>1?'flex':'none';});
}
function setFacRel(btn,rel){
  var item=facItem(btn);if(!item)return;
  item.querySelectorAll('.fac-rel-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  item.setAttribute('data-rel',rel);
  var away=item.querySelector('.fac-away');if(away)away.style.display=(rel==='away')?'flex':'none';
}

// ── DIRECTION PICKER (tap ⌄ to choose; field still accepts typed custom) ──
var CURB_DIRS=[['EEC','East of East curb'],['EWC','East of West curb'],['WEC','West of East curb'],['WWC','West of West curb'],['SSC','South of South curb'],['SNC','South of North curb'],['NSC','North of South curb'],['NNC','North of North curb']];
var CARD_DIRS=[['N','North'],['S','South'],['E','East'],['W','West']];
var dirTarget=null;
function openDirPicker(btn,kind){
  dirTarget=btn.parentNode.querySelector('input');
  var list=kind==='card'?CARD_DIRS:CURB_DIRS;
  document.getElementById('dir-picker-title').textContent=kind==='card'?'Direction':'Curb direction';
  document.getElementById('dir-picker-list').innerHTML=list.map(function(o){
    return '<div class="picker-item" onclick="pickDir(\''+o[0]+'\')"><span>'+o[0]+'</span><span class="dir-desc">'+o[1]+'</span></div>';
  }).join('');
  document.getElementById('dir-picker').style.display='block';
}
function pickDir(v){if(dirTarget)dirTarget.value=v;closeDirPicker();}
function closeDirPicker(e){if(e&&!e.target.classList.contains('picker-overlay'))return;document.getElementById('dir-picker').style.display='none';dirTarget=null;}

// iOS often hides the keyboard prev/next arrows — make Return jump to the next field.
function setupContKeyboard(){
  var form=document.querySelector('#cont-modal .cont-form');if(!form)return;
  form.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.keyCode!==13)return;
    var t=e.target;if(!t||t.tagName!=='INPUT')return; // textareas keep newline
    e.preventDefault();
    var inputs=Array.prototype.slice.call(form.querySelectorAll('input'));
    var i=inputs.indexOf(t);
    for(var j=i+1;j<inputs.length;j++){if(inputs[j].offsetParent!==null){inputs[j].focus();return;}}
    t.blur();
  });
}

// Route cards stash payloads by index (like _fmActions); DLR crews look up live.
function openContingencyRoute(idx){var p=(window._contData||[])[idx];if(p)openContingencyModal(p);}
function openContingencyCrew(id){
  var cid=parseInt(id);var c=currentCrews.find(function(x){return x.id===cid;});if(!c)return;
  openContingencyModal({num:c.contingencyNum||'',layout:c.cworxWO||'',code:c.code753||'',contractor:c.contractor||'',location:c.location||'',inspector:inspectorName()});
}

function ft(v){v=String(v==null?'':v).replace(/[’'\s]+$/,'');return v?v+'’':'';} // foot mark, idempotent
function dirWord(d){var m={N:'north',S:'south',E:'east',W:'west'};if(!d)return '';return m[d.toUpperCase()]||String(d).toLowerCase();}
// "310 / NNC / E 141st St" -> "310’ NNC E 141st St"
function contOffset(dist,dir,ref){
  var s=[ft(dist),dir].filter(Boolean).join(' ');
  if(ref)s=(s?s+' ':'')+ref;
  return s.trim();
}
// Facility clauses: "Directly over the X" or "16’ west of 24” main", joined by " and ".
function facilityClause(){
  var items=document.querySelectorAll('#cont-fac-list .fac-item');
  var clauses=[];
  items.forEach(function(it){
    var desc=((it.querySelector('.fac-desc')||{}).value||'').trim();
    var rel=it.getAttribute('data-rel')||'over';
    if(rel==='away'){
      var dist=((it.querySelector('.fac-dist')||{}).value||'').trim();
      var dir=((it.querySelector('.fac-dir')||{}).value||'').trim();
      if(!desc&&!dist&&!dir)return;
      clauses.push((ft(dist)+' '+dirWord(dir)+' of '+desc).replace(/\s+/g,' ').trim());
    }else{
      if(!desc)return;
      clauses.push('Directly over the '+desc);
    }
  });
  return clauses.join(' and ');
}
function buildContingencyBody(){
  var num=getContVal('cont-num'),layout=getContVal('cont-layout'),code=getContVal('cont-code'),
      contractor=getContVal('cont-contractor'),scope=getContVal('cont-scope').toLowerCase(),
      comments=getContVal('cont-comments'),insp=getContVal('cont-inspector');
  // Dimensions: L x W x D (skip any blank)
  var dparts=[];
  if(getContVal('cont-dim-l'))dparts.push(ft(getContVal('cont-dim-l'))+' L');
  if(getContVal('cont-dim-w'))dparts.push(ft(getContVal('cont-dim-w'))+' W');
  if(getContVal('cont-dim-d'))dparts.push(ft(getContVal('cont-dim-d'))+' D');
  var dims=dparts.join(' x ');
  // Pinpoint: up to two curb offsets joined by " & "
  var pin=[contOffset(getContVal('cont-pin1-dist'),getContVal('cont-pin1-dir'),getContVal('cont-pin1-ref')),
           contOffset(getContVal('cont-pin2-dist'),getContVal('cont-pin2-dir'),getContVal('cont-pin2-ref'))]
          .filter(Boolean).join(' & ');
  var fac=facilityClause();
  var locLine=(dims?dims+' ':'')+'excavation'+(pin?' located '+pin:'')+(fac?' – '+fac:'');
  var L=[];
  L.push('Contingency: '+num);
  L.push('Layout: '+layout);
  L.push('Code 753/811: '+code);
  L.push('');
  L.push('────────────────────');
  L.push('');
  L.push('Good morning,');
  L.push('Con Edison contractor '+contractor+' will be '+scope+' at the following location(s);');
  L.push('1. '+locLine.replace(/[ \t]+/g,' ').trim());
  L.push('');
  if(comments){L.push(comments);L.push('');}
  L.push('I, '+insp+', am on location');
  return L.join('\n');
}
// Quick-insert the standard closing line into Additional comments (it renders bold).
function addNoExcavation(){
  var el=document.getElementById('cont-comments');if(!el)return;
  var phrase='NO ADDITIONAL EXCAVATION REQUIRED!';
  if(el.value.indexOf(phrase)!==-1){el.focus();return;}
  var v=el.value.replace(/\s+$/,'');
  el.value=v?(v+'\n'+phrase):phrase;
}
function composeContingencyEmail(){
  var subject=getContVal('cont-subject');
  var url='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(buildContingencyBody());
  var a=document.createElement('a');a.href=url;document.body.appendChild(a);a.click();document.body.removeChild(a);
}
// ── Bold HTML version (for "Copy formatted") ─────────────────────
// mailto bodies are plain text and can't carry bold, so the formatted copy
// puts rich text/html on the clipboard; pasting into Mail/OneNote keeps the
// bold on dimensions, distances, and street/facility names.
function bcEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function B(s){s=String(s==null?'':s).trim();return s?'<b>'+bcEsc(s)+'</b>':'';}
function facilityClauseHTML(){
  var items=document.querySelectorAll('#cont-fac-list .fac-item');
  var clauses=[];
  items.forEach(function(it){
    var desc=((it.querySelector('.fac-desc')||{}).value||'').trim();
    var rel=it.getAttribute('data-rel')||'over';
    if(rel==='away'){
      var dist=((it.querySelector('.fac-dist')||{}).value||'').trim();
      var dir=((it.querySelector('.fac-dir')||{}).value||'').trim();
      if(!desc&&!dist&&!dir)return;
      var dd=(ft(dist)+' '+dirWord(dir)).replace(/\s+/g,' ').trim();
      clauses.push((dd?B(dd)+' ':'')+'of '+B(desc));
    }else{
      if(!desc)return;
      clauses.push('Directly over the '+B(desc));
    }
  });
  return clauses.join(' and ');
}
function buildContingencyHTML(){
  var num=getContVal('cont-num'),layout=getContVal('cont-layout'),code=getContVal('cont-code'),
      contractor=getContVal('cont-contractor'),scope=getContVal('cont-scope').toLowerCase(),
      comments=getContVal('cont-comments'),insp=getContVal('cont-inspector');
  var dparts=[];
  if(getContVal('cont-dim-l'))dparts.push(ft(getContVal('cont-dim-l'))+' L');
  if(getContVal('cont-dim-w'))dparts.push(ft(getContVal('cont-dim-w'))+' W');
  if(getContVal('cont-dim-d'))dparts.push(ft(getContVal('cont-dim-d'))+' D');
  var dims=dparts.join(' x ');
  var offs=[];
  [['cont-pin1-dist','cont-pin1-dir','cont-pin1-ref'],['cont-pin2-dist','cont-pin2-dir','cont-pin2-ref']].forEach(function(ids){
    var dist=getContVal(ids[0]),dir=getContVal(ids[1]),ref=getContVal(ids[2]);
    if(!dist&&!dir&&!ref)return;
    var dd=[ft(dist),dir].filter(Boolean).join(' ');
    offs.push([B(dd),B(ref)].filter(Boolean).join(' '));
  });
  var facHtml=facilityClauseHTML();
  var loc=(dims?B(dims)+' ':'')+'excavation'+(offs.length?' located '+offs.join(' &amp; '):'')+(facHtml?' – '+facHtml:'');
  var head=['<b>Contingency:</b> '+bcEsc(num),'<b>Layout:</b> '+bcEsc(layout),'<b>Code 753/811:</b> '+bcEsc(code)].join('<br>');
  var body=[];
  body.push('Good morning,');
  body.push('Con Edison contractor '+bcEsc(contractor)+' will be '+bcEsc(scope)+' at the following location(s);');
  body.push('<ol><li>'+loc+'</li></ol>');
  if(comments)body.push('<b>'+bcEsc(comments).replace(/\n/g,'<br>')+'</b>');
  body.push('');
  body.push('I, '+bcEsc(insp)+', am on location');
  return head+'<br><br>────────────────────<br><br>'+body.join('<br>');
}
function copyContingencyReport(){
  // Pasted into the email BODY (subject is set separately), so omit the subject line.
  var plain=buildContingencyBody();
  var html=buildContingencyHTML();
  if(window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
    try{
      var item=new ClipboardItem({
        'text/html':new Blob([html],{type:'text/html'}),
        'text/plain':new Blob([plain],{type:'text/plain'})
      });
      navigator.clipboard.write([item]).then(function(){showToast('Copied — paste into your email');}).catch(function(){fallbackCopy(plain);});
      return;
    }catch(e){}
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(plain).then(function(){showToast('Copied — paste into your email');}).catch(function(){fallbackCopy(plain);});
  }else fallbackCopy(plain);
}

// ── MAP MY STOPS (Google Maps personal routing) ──────────────────
// Pull unique job locations into an editable list (sheet data is messy, so
// every stop is editable / removable / reorderable), append an area for
// geocoding accuracy, then open a Google Maps driving route through them all.
function uniqueRouteLocations(){
  if(!allData||!allData.flavin||!allData.headers)return [];
  var h=allData.headers;var seen={};var out=[];
  allData.flavin.forEach(function(row){
    var loc=gv(row,h,'Location');if(!loc)return;
    loc=loc.replace(/\s+/g,' ').trim();
    var k=loc.toUpperCase();if(seen[k])return;seen[k]=true;out.push(loc);
  });
  return out;
}
function mapRowHTML(v){
  return '<div class="map-row">'+
    '<button type="button" class="map-move" onclick="moveMapStop(this,-1)">↑</button>'+
    '<button type="button" class="map-move" onclick="moveMapStop(this,1)">↓</button>'+
    '<input class="field-input map-stop" value="'+escHtml(v||'')+'" placeholder="Address or intersection">'+
    '<button type="button" class="count-remove" onclick="this.parentNode.remove()">×</button>'+
  '</div>';
}
function addMapStop(){var t=document.createElement('div');t.innerHTML=mapRowHTML('');document.getElementById('map-list').appendChild(t.firstChild);}
function moveMapStop(btn,dir){
  var row=btn.parentNode;var list=row.parentNode;
  if(dir<0&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
  else if(dir>0&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
}
function openMapModal(){
  if(!allData||!allData.flavin){showToast('Load a route sheet first');return;}
  var locs=uniqueRouteLocations();
  var sfx=document.getElementById('map-suffix');if(sfx&&!sfx.value.trim())sfx.value='Bronx, NY';
  document.getElementById('map-list').innerHTML=(locs.length?locs:['']).map(function(l){return mapRowHTML(shortAddr(l));}).join('');
  document.getElementById('map-modal').style.display='block';
}
function closeMapModal(e){if(!e||e.target.classList.contains('modal-overlay'))document.getElementById('map-modal').style.display='none';}
function mapStopList(){
  var suffix=(document.getElementById('map-suffix').value||'').trim();
  var stops=[];
  document.querySelectorAll('#map-list .map-stop').forEach(function(inp){
    var v=(inp.value||'').replace(/\s+/g,' ').trim();if(!v)return;
    if(suffix&&v.toLowerCase().indexOf(suffix.toLowerCase())===-1)v=v+', '+suffix;
    stops.push(v);
  });
  return stops;
}
function homeAddr(){return getProfile().home||'93 Hyatt Pl, Yonkers, NY';}
// One-time Profile for form headers (seeded from the workbook).
function getProfile(){return getData('dlr_profile',{name:'Jeremiah Flavin',empNo:'31086',roll:'204',vehicle:'Subaru 2019',plate:'GKE 7821',phone:'347-387-6934',home:'93 Hyatt Pl, Yonkers, NY'});}
function setProfileField(f,v){var p=getProfile();p[f]=v;setData('dlr_profile',p);syncPushProfile();}
function renderProfile(){var p=getProfile();['name','empNo','roll','vehicle','plate','phone','home'].forEach(function(f){var el=document.getElementById('prof-'+f);if(el)el.value=p[f]||'';});}
function openMapsWith(stops){
  stops=(stops||[]).filter(Boolean);
  if(!stops.length){showToast('No stops to map');return;}
  var home=encodeURIComponent(homeAddr());
  // round trip: home -> all stops as waypoints -> home
  var url='https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+home+'&destination='+home+
          '&waypoints='+stops.map(encodeURIComponent).join('|');
  if(stops.length>9)showToast('Many stops — Google caps waypoints (~9)');
  var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}
// Rough sweep: sort numbered Bronx streets high→low (north/near-home first); plain
// addresses keep their order at the end. Free heuristic, not true optimization.
function streetNum(s){var m=String(s).match(/\b(\d{1,3})(?:st|nd|rd|th)\b/i);return m?+m[1]:null;}
function smartOrderMapStops(){
  var vals=[].slice.call(document.querySelectorAll('#map-list .map-stop')).map(function(i){return i.value;}).filter(function(v){return (v||'').trim();});
  var withNum=[],without=[];
  vals.forEach(function(v){var n=streetNum(v);if(n!=null)withNum.push({v:v,n:n});else without.push(v);});
  withNum.sort(function(a,b){return b.n-a.n;});
  var ordered=withNum.map(function(x){return x.v;}).concat(without);
  document.getElementById('map-list').innerHTML=(ordered.length?ordered:['']).map(function(l){return mapRowHTML(l);}).join('');
  showToast('Reordered north→south (rough)');
}
function openMapsRoute(){var stops=mapStopList();if(!stops.length){showToast('Add at least one stop');return;}openMapsWith(stops);}
function copyMapStops(){
  var stops=mapStopList();if(!stops.length){showToast('No stops');return;}
  var text=stops.join('\n');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){showToast('List copied');}).catch(function(){fallbackCopy(text);});
  else fallbackCopy(text);
}

// ── CLOUD SYNC (Firebase: Firestore + email-link Auth) ───────────
// Local-first: localStorage stays the on-device source of truth and the app
// works fully offline; when signed in & online we mirror logs/drafts/lists to
// the user's private Firestore so the 4 devices share one dataset. Conflicts
// resolve by newest savedAt (same rule as backup/restore).
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyAsoT_pJfMr1Zlxg5d0F3w_D4Yk1esJNbI",
  authDomain: "bullfrog-field-log.firebaseapp.com",
  projectId: "bullfrog-field-log",
  storageBucket: "bullfrog-field-log.firebasestorage.app",
  messagingSenderId: "1061730210243",
  appId: "1:1061730210243:web:a300f274241c7f5b752d76"
};
var fbDb=null,fbUser=null,fbUnsub=null,fbUnsubMile=null,fbUnsubDraft=null,fbUnsubRoute=null,fbUnsubWork=null,lastSync=null;
function markSynced(){lastSync=new Date();updateSyncStamps();}
function syncAgo(){if(!lastSync)return fbUser?'syncing…':'local only';var s=Math.round((Date.now()-lastSync.getTime())/1000);if(s<60)return 'synced '+s+'s ago';var m=Math.round(s/60);if(m<60)return 'synced '+m+'m ago';return 'synced '+lastSync.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
function updateSyncStamps(){var els=document.querySelectorAll('.sync-stamp');for(var i=0;i<els.length;i++)els[i].textContent=syncAgo();}
function syncRefresh(){
  if(!syncOn()){showToast('Sign in (Settings) to sync devices');return;}
  showToast('Refreshing…');
  pushLocalLogs();syncMeta();
  setTimeout(function(){markSynced();var a=document.querySelector('.page.active');if(a){if(a.id==='page-dlr'){renderCrews();renderMileage();}else if(a.id==='page-month')renderMonth();else if(a.id==='page-history')renderHistory();}showToast('Up to date');},900);
}
setInterval(updateSyncStamps,30000);
function syncAvailable(){return !!(window.firebase&&firebase.apps&&firebase.firestore);}
function syncOn(){return !!(fbDb&&fbUser);}
function userCol(name){return fbDb.collection('users').doc(fbUser.uid).collection(name);}

function initSync(){
  if(!window.firebase||!firebase.initializeApp){updateAccountUI();return;}
  try{
    if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    fbDb=firebase.firestore();
    fbDb.enablePersistence({synchronizeTabs:true}).catch(function(){});
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
    firebase.auth().onAuthStateChanged(onAuthChange);
  }catch(e){}
  updateAccountUI();
}
function onAuthChange(user){fbUser=user;updateAccountUI();if(user)startSync();else stopSync();}

// Email + password sign-in. Stays inside the app (no Safari redirect), so it
// works in the iOS home-screen PWA. First sign-in for an email auto-creates the
// account; after that it just logs in and the session persists indefinitely.
function authMsg(err){
  var c=err&&err.code||'';
  if(c==='auth/invalid-email')return'That email looks invalid';
  if(c==='auth/wrong-password'||c==='auth/invalid-credential')return'Wrong password';
  if(c==='auth/user-not-found')return'No account for that email';
  if(c==='auth/too-many-requests')return'Too many tries — wait a bit';
  if(c==='auth/weak-password')return'Password must be 6+ characters';
  if(c==='auth/network-request-failed')return'No connection — try again online';
  return (err&&err.message)||'Sign-in failed';
}
function doSignIn(){
  if(!syncAvailable()){showToast('Connect to the internet first');return;}
  var em=document.getElementById('account-email'),pw=document.getElementById('account-pass');
  var email=(em&&em.value||'').trim(),pass=(pw&&pw.value||'');
  if(!email||!pass){showToast('Enter email and password');return;}
  if(pass.length<6){showToast('Password must be 6+ characters');return;}
  var auth=firebase.auth();
  auth.signInWithEmailAndPassword(email,pass).catch(function(err){
    var c=err&&err.code||'';
    if(c==='auth/user-not-found'||c==='auth/invalid-credential'){
      return auth.createUserWithEmailAndPassword(email,pass).catch(function(e2){
        if(e2&&e2.code==='auth/email-already-in-use')throw{code:'auth/wrong-password'};
        throw e2;
      });
    }
    throw err;
  }).then(function(){if(pw)pw.value='';showToast('Signed in — syncing');}).catch(function(err){showToast(authMsg(err));});
}
function doForgotPass(){
  if(!syncAvailable()){showToast('Connect to the internet first');return;}
  var em=document.getElementById('account-email');
  var email=(em&&em.value||'').trim();
  if(!email){showToast('Enter your email above first');if(em)em.focus();return;}
  firebase.auth().sendPasswordResetEmail(email)
    .then(function(){showToast('Reset link sent to '+email+' — check your email');})
    .catch(function(err){showToast(authMsg(err));});
}
function signOutSync(){if(window.firebase&&firebase.auth)firebase.auth().signOut();}
function togglePass(){
  var i=document.getElementById('account-pass'),ic=document.getElementById('eye-icon');if(!i)return;
  var hidden=i.type==='password';i.type=hidden?'text':'password';
  if(ic)ic.innerHTML=hidden
    ?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    :'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
}

function startSync(){
  if(!syncOn())return;
  pushLocalLogs().then(function(){
    if(fbUnsub)fbUnsub();
    fbUnsub=userCol('logs').onSnapshot(function(snap){
      var changed=false;
      snap.docChanges().forEach(function(ch){
        var data=ch.doc.data();
        if(ch.type==='removed'){
          var i=logs.findIndex(function(l){return l.date===data.date;});
          if(i>=0){logs.splice(i,1);changed=true;}
        }else{changed=mergeRemoteLog(data)||changed;}
      });
      if(changed){logs.sort(function(a,b){return b.date.localeCompare(a.date);});setData('dlr_logs',logs);renderHistory();updateSettingsCounts();}
      markSynced();
    },function(){});
  });
  // Live mileage so devices stay uniform without submitting
  if(fbUnsubMile)fbUnsubMile();
  fbUnsubMile=userCol('meta').doc('mileage').onSnapshot(function(d){
    if(!d.exists)return;var remote=d.data().data||{},local=allMileage(),changed=false;
    Object.keys(remote).forEach(function(k){if(!local[k]||!local[k].savedAt||(remote[k].savedAt&&remote[k].savedAt>local[k].savedAt)){local[k]=remote[k];changed=true;}});
    if(changed)setData('dlr_mileage',local);
    markSynced();
    var act=document.querySelector('.page.active');
    if(changed&&act){if(act.id==='page-dlr')renderMileage();else if(act.id==='page-month')renderMonth();}
  },function(){});
  // Live drafts (unfinished work shared across devices)
  if(fbUnsubDraft)fbUnsubDraft();
  fbUnsubDraft=userCol('meta').doc('drafts').onSnapshot(function(d){
    if(!d.exists)return;var drafts=getData('dlr_drafts',{}),rd=d.data().drafts||{},ch=false;
    Object.keys(rd).forEach(function(k){if(!drafts[k]||!drafts[k].savedAt||(rd[k].savedAt&&rd[k].savedAt>drafts[k].savedAt)){drafts[k]=rd[k];ch=true;}});
    if(ch)setData('dlr_drafts',drafts);markSynced();
    if(ch)maybeNotifyDraft();
  },function(){});
  // Live route — load the sheet on one device, it appears on all
  if(fbUnsubRoute)fbUnsubRoute();
  fbUnsubRoute=userCol('meta').doc('route').onSnapshot(function(d){
    if(!d.exists||!d.data().json)return;var sa=d.data().savedAt||'';
    if(sa<=getData('dlr_route_sa',''))return;
    try{var rd=JSON.parse(d.data().json);if(rd&&rd.headers){allData=rebuildRoute(rd);setData('dlr_route',rd);setData('dlr_route_sa',sa);markSynced();if(document.getElementById('page-route').classList.contains('active'))renderRouteResults();}}catch(e){}
  },function(){});
  syncMeta();
}
function rebuildRoute(r){
  if(r.flavin&&r._coFlavin)r.flavin.forEach(function(row,i){if(row)row._co=r._coFlavin[i]||'';});
  if(r.owned&&r._coOwned)r.owned.forEach(function(row,i){if(row)row._co=r._coOwned[i]||'';});
  if(r.sheets)Object.keys(r.sheets).forEach(function(sn){var sd=r.sheets[sn];if(sd&&sd.jobs)sd.jobs.forEach(function(row){if(row)row._co=sd.company||sn;});});
  return r;
}
function stopSync(){[fbUnsub,fbUnsubMile,fbUnsubDraft,fbUnsubRoute,fbUnsubWork].forEach(function(u){if(u)u();});fbUnsub=fbUnsubMile=fbUnsubDraft=fbUnsubRoute=fbUnsubWork=null;}
function mergeRemoteLog(r){
  if(!r||!r.date)return false;
  var i=logs.findIndex(function(l){return l.date===r.date;});
  if(r.deleted){ // tombstone — drop locally unless our copy is newer than the delete
    if(i>=0&&(!logs[i].savedAt||!r.savedAt||r.savedAt>=logs[i].savedAt)){logs.splice(i,1);return true;}
    return false;
  }
  if(i<0){logs.push(r);return true;}
  if(!logs[i].savedAt||(r.savedAt&&r.savedAt>logs[i].savedAt)){logs[i]=r;return true;}
  return false;
}
function pushLocalLogs(){
  if(!syncOn())return Promise.resolve();
  return userCol('logs').get().then(function(snap){
    var remote={};snap.forEach(function(d){var x=d.data();if(x&&x.date)remote[x.date]=x;});
    var batch=fbDb.batch(),n=0;
    logs.forEach(function(l){
      var r=remote[l.date];
      if(!r){batch.set(userCol('logs').doc(l.date),l);n++;}                              // new locally
      else if(r.deleted){if(l.savedAt&&r.savedAt&&l.savedAt>r.savedAt){batch.set(userCol('logs').doc(l.date),l);n++;}} // honor tombstone unless local edit is newer
      else if(!r.savedAt||(l.savedAt&&l.savedAt>r.savedAt)){batch.set(userCol('logs').doc(l.date),l);n++;}            // local newer
    });
    var changed=false;Object.keys(remote).forEach(function(k){changed=mergeRemoteLog(remote[k])||changed;});
    if(changed){logs.sort(function(a,b){return b.date.localeCompare(a.date);});setData('dlr_logs',logs);renderHistory();updateSettingsCounts();}
    return n>0?batch.commit():null;
  }).catch(function(){});
}
function syncMeta(){
  if(!syncOn())return;
  userCol('meta').doc('lists').get().then(function(d){
    if(d.exists){var x=d.data();if(x.trades&&x.trades.length){trades=x.trades;setData('dlr_trades',trades);}if(x.equipment&&x.equipment.length){equipment=x.equipment;setData('dlr_equipment',equipment);}updateSettingsCounts();}
    else syncPushLists();
  }).catch(function(){});
  userCol('meta').doc('drafts').get().then(function(d){
    if(d.exists){var drafts=getData('dlr_drafts',{}),rd=d.data().drafts||{};Object.keys(rd).forEach(function(k){drafts[k]=rd[k];});setData('dlr_drafts',drafts);}
  }).catch(function(){});
  userCol('meta').doc('mileage').get().then(function(d){
    if(d.exists){
      var local=allMileage(),rd=d.data().data||{},changed=false;
      Object.keys(rd).forEach(function(k){if(!local[k]||!local[k].savedAt||(rd[k].savedAt&&rd[k].savedAt>local[k].savedAt)){local[k]=rd[k];changed=true;}});
      if(changed){setData('dlr_mileage',local);if(document.getElementById('page-mileage').classList.contains('active'))renderMileage();}
      syncPushMileage();
    }else syncPushMileage();
  }).catch(function(){});
  userCol('meta').doc('profile').get().then(function(d){
    if(d.exists&&d.data().data){setData('dlr_profile',d.data().data);renderProfile();}
    else syncPushProfile();
  }).catch(function(){});
}
function syncPushLog(entry){if(syncOn())userCol('logs').doc(entry.date).set(entry).catch(function(){});}
function syncDeleteLog(date){if(syncOn())userCol('logs').doc(date).set({date:date,deleted:true,savedAt:new Date().toISOString()}).catch(function(){});}
function syncPushDrafts(){if(syncOn())userCol('meta').doc('drafts').set({drafts:getData('dlr_drafts',{})}).catch(function(){});}
function syncPushLists(){if(syncOn())userCol('meta').doc('lists').set({trades:trades,equipment:equipment}).catch(function(){});}
function syncPushMileage(){if(syncOn())userCol('meta').doc('mileage').set({data:allMileage()}).catch(function(){});}
function syncPushProfile(){if(syncOn())userCol('meta').doc('profile').set({data:getProfile()}).catch(function(){});}
// Sync the loaded route sheet (as JSON — it has nested arrays Firestore won't take raw).
function syncPushRoute(){
  if(!syncOn()||!allData||!allData.headers)return;
  var sa=new Date().toISOString();setData('dlr_route_sa',sa);
  try{userCol('meta').doc('route').set({json:JSON.stringify(getData('dlr_route',allData)),savedAt:sa}).catch(function(){});}catch(e){}
}
// Sync the in-progress DLR scratchpad (debounced — saveWorkingDLR fires on every keystroke).
var _workTimer=null;
function syncPushWorking(){
  if(!syncOn())return;
  clearTimeout(_workTimer);
  _workTimer=setTimeout(function(){
    if(!syncOn())return;
    var w=getData('dlr_working',null),sa=new Date().toISOString();
    setData('dlr_working_sa',sa);
    var payload=w?{date:w.date||'',crews:w.crews||[],savedAt:sa}:{cleared:true,savedAt:sa};
    userCol('meta').doc('working').set(payload).catch(function(){});
  },1400);
}
function syncPushAll(){if(!syncOn())return;logs.forEach(function(l){syncPushLog(l);});syncPushDrafts();syncPushLists();syncPushMileage();syncPushProfile();syncPushRoute();}

function updateAccountUI(){
  var signedOut=document.getElementById('account-signedout');
  var signedIn=document.getElementById('account-signedin');
  var unavail=document.getElementById('account-unavailable');
  if(!signedOut||!signedIn||!unavail)return;
  if(!syncAvailable()){signedOut.style.display='none';signedIn.style.display='none';unavail.style.display='';return;}
  unavail.style.display='none';
  if(fbUser){signedOut.style.display='none';signedIn.style.display='';var who=document.getElementById('account-who');if(who)who.textContent=fbUser.email||'Signed in';}
  else{signedIn.style.display='none';signedOut.style.display='';}
}

initLogDate();
if(!restoreWorkingDLR())loadTodayDraft();
renderCrews();updateSettingsCounts();updateHpShortcutState();
restoreRoute();
setupContKeyboard();
initSync();
// Desktop: Cmd+S / Ctrl+S saves the DLR draft (instead of the browser Save dialog).
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&!e.altKey&&(e.key==='s'||e.key==='S')){
    var dlr=document.getElementById('page-dlr');
    if(dlr&&dlr.classList.contains('active')){e.preventDefault();saveDraft();}
  }
});
function showUpdateBanner(){
  if(document.getElementById('update-banner'))return;
  var b=document.createElement('div');b.id='update-banner';b.className='update-banner';
  b.innerHTML='<span>New version ready</span><span class="ub-go">Tap to refresh →</span>';
  b.onclick=function(){checkForUpdate();};
  document.body.appendChild(b);
}
var APP_VERSION='v11.8';
function setVersion(){var els=document.querySelectorAll('.vbadge,.ver-chip');for(var i=0;i<els.length;i++)els[i].textContent=APP_VERSION;}
setVersion();
function setNavH(){var n=document.querySelector('.nav');if(n)document.documentElement.style.setProperty('--navh',n.offsetHeight+'px');}
setNavH();window.addEventListener('resize',setNavH);window.addEventListener('orientationchange',setNavH);
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      try{reg.update();}catch(e){}
      reg.addEventListener('updatefound',function(){
        var nw=reg.installing;if(!nw)return;
        nw.addEventListener('statechange',function(){
          // 'installed' + an existing controller = an update (not first install)
          if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner();
        });
      });
    })['catch'](function(){});
  });
}
