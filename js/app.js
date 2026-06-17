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
var DEFAULT_TRADES = [{n:'Foreman',c:1},{n:'Operating Engineer',c:1},{n:'Laborers',c:4},{n:'Flagger',c:2}];
var DEFAULT_EQUIP  = [{n:'Pick Up Truck',c:1},{n:'Backhoe',c:1},{n:'Compressor Truck',c:1}];
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
  if(p==='history')renderHistory();
  if(p==='settings')updateSettingsCounts();
}
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
document.getElementById('genDlrBtn').addEventListener('click',function(){generateDLR();});
(function(){var b=document.getElementById('mapStopsBtn');if(b)b.addEventListener('click',openMapModal);})();

function setStatus(t,m){statusBar.classList.add('visible');statusDot.className='status-dot '+t;statusText.textContent=m;}
function fmtName(n){if(!n)return '';var p=n.trim().split(/\s+/);return p.length===1?p[0]:p[0].charAt(0).toUpperCase()+'. '+p[p.length-1];}

function parseCCIs(wb){
  var ss=wb.Sheets['Summary'];if(!ss)return[];
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
  var ss=wb.Sheets['Summary'];if(!ss||!ss['A1'])return null;
  var v=ss['A1'].v;
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+('0'+(v.getMonth()+1)).slice(-2)+'-'+('0'+v.getDate()).slice(-2);
  var t=Date.parse(String(v));
  if(!isNaN(t)){var d=new Date(t);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
  return null;
}

// ── FOREMAN PHONE / SMS ──────────────────────────────────────────
// The foreman field embeds the number, e.g. "566059- Ben Cramer (973-919-9700)".
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
      var ccis=parseCCIs(wb);
      var sheetJobs={};var headers=null;
      var SHEETS=['CAC','Donofrio','EJ','Gianfia','MFM'];
      for(var si=0;si<wb.SheetNames.length;si++){
        var sn=wb.SheetNames[si];
        if(sn==='Summary'||sn==='Raw Data'||sn==='DATA')continue;
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
      var routeDate=parseDateFromName(file.name)||parseSummaryDate(wb)||null;
      allData={headers:headers,flavin:myJobs,flavinCompany:myJobsCompany,owned:ownedJobs,sheets:sheetJobs,ccis:ccis,contractorSheets:SHEETS,name:NAME,routeDate:routeDate};
      saveRoute();
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
  document.getElementById('genDlrInfo').innerHTML='<b>'+allData.flavin.length+' job row'+(allData.flavin.length!==1?'s':'')+' → '+keys.length+' DLR block'+(keys.length!==1?'s':'')+' by WO / Location</b>';
  document.getElementById('genDlrBar').classList.add('visible');
  tabBar.innerHTML='';
  var lastName=allData.name.split(' ').pop();
  var tabs=[{id:'flavin',label:lastName,jobs:allData.flavin},{id:'owned',label:'Owned',jobs:allData.owned}];
  allData.contractorSheets.forEach(function(sn){var d=allData.sheets[sn];if(d)tabs.push({id:sn,label:sn,jobs:d.jobs});});
  tabs.forEach(function(t,idx){
    var btn=document.createElement('button');btn.className='tab'+(idx===0?' active':'');
    btn.innerHTML=t.label+'<span class="tab-ct">'+t.jobs.length+'</span>';
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});btn.classList.add('active');
      if(t.id==='flavin'||t.id==='owned')renderFlavinJobs(t.jobs);else renderListJobs(t.jobs);
    });
    tabBar.appendChild(btn);
  });
  renderFlavinJobs(allData.flavin);
}

function gv(row,h,name){var i=h.indexOf(name);if(i===-1||row[i]==null||row[i]==='')return null;return String(row[i]).trim();}
// Fusing Peer column name varies on the sheet — match it loosely.
var FUSE_RE=/fus[a-z]*\s*peer|peer\s*fus[a-z]*|fusing/i;
function gvRe(row,h,re){for(var i=0;i<h.length;i++){if(h[i]&&re.test(String(h[i]))){var v=row[i];return (v==null||v==='')?null:String(v).trim();}}return null;}
// A Contingency / Hold Point / Fusing Peer value counts as "active" unless it's blank or a negative.
function isActive(v){if(!v)return false;var s=String(v).trim().toLowerCase();return s!==''&&s!=='no'&&s!=='n'&&s!=='n/a'&&s!=='none'&&s!=='0'&&s!=='false';}

function renderFlavinJobs(jobs){
  resultsHdr.style.display='flex';resultsCount.textContent=jobs.length+' job'+(jobs.length!==1?'s':'');
  jobsContainer.innerHTML='';if(!jobs||jobs.length===0){jobsContainer.innerHTML='<div class="no-jobs">No jobs assigned</div>';return;}
  var h=allData.headers;var grid=document.createElement('div');grid.className='jobs';
  window._fmActions=[];window._contData=[];
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
    var hpTag=isActive(hp)?('<span class="b-hp">Hold Point: '+escHtml(hp)+'</span>'):'<span class="status-off">Hold Point: No</span>';
    var fuseTag=isActive(fz)?('<span class="b-fuse">Fusing Peer: '+escHtml(fz)+'</span>'):'<span class="status-off">Fusing Peer: No</span>';
    var card=document.createElement('div');card.className='job-card';
    card.innerHTML='<div class="card-head"><div class="loc">'+loc+'</div>'+(tw?'<span class="'+bc+'">'+tw+'</span>':'')+' </div>'+
      '<div class="card-primary"><div class="pf"><span class="fl">Ticket #</span><span class="fv'+(tk?'':' mt')+'">'+(tk||'N/A')+'</span></div><div class="pf"><span class="fl">Contingency</span><span class="fv pl'+(cgf?'':' mt')+'">'+(cgf||'No')+'</span></div></div>'+
      '<div class="card-foreman">'+(co?'<div class="co-tag">'+co+'</div>':'')+' <div class="fm-name'+(fm?'':' mt')+'">'+(fmDisp||'N/A')+'</div>'+fmLink+'</div>'+
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
function groupByWOLocation(jobs){
  var h=allData.headers;var groups={};var order=[];
  var isMainJobs=(jobs===allData.flavin);
  jobs.forEach(function(row,rowIdx){
    var loc=(gv(row,h,'Location')||'').toUpperCase().trim();
    var tk=gv(row,h,'Ticket #')||'';
    var key=tk.replace(/\s/g,'').toUpperCase()+'||'+loc;
    if(!groups[key]){
      groups[key]={location:gv(row,h,'Location')||'',wo:tk,cworxWO:gv(row,h,'Layout/CWORX Work Order #')||'',contractor:(isMainJobs&&allData.flavinCompany&&allData.flavinCompany[rowIdx])||row._co||'',foremen:[],workDescs:[],permitHours:gv(row,h,'Permit Hours')||'',psc:gv(row,h,'PSC File #')||'',contingency:gv(row,h,'Contingency (Y/N)')||'',contingencyNum:gv(row,h,'Contingency #')||'',code753:gv(row,h,'Code 753')||'',holdPoint:gv(row,h,'Hold Point')||'',fusingPeer:gvRe(row,h,FUSE_RE)||''};
      order.push(key);
    }
    var g=groups[key];
    var fm=gv(row,h,"Contractor's Foreman");
    if(fm){var cf=fm.replace(/^\d+[-\s]+/,'').trim();if(g.foremen.indexOf(cf)===-1)g.foremen.push(cf);}
    var wd=gv(row,h,'Work Description');
    if(wd&&g.workDescs.indexOf(wd)===-1)g.workDescs.push(wd);
  });
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
      foremen:g.foremen,workDescs:g.workDescs,
      permitHours:g.permitHours,psc:g.psc,
      contingency:g.contingency,contingencyNum:g.contingencyNum,code753:g.code753||'',holdPoint:g.holdPoint,fusingPeer:g.fusingPeer||'',
      trades:DEFAULT_TRADES.map(function(t){return {n:t.n,c:t.c};}),
      equip:DEFAULT_EQUIP.map(function(e){return {n:e.n,c:e.c};}),
      comments:'',te:false,teHours:'',teReason:'',teRemarks:'',_fromRoute:true
    });
  });
  var rd=(allData&&allData.routeDate)||today();
  document.getElementById('log-date').value=rd;
  updateDateDisplay();
  saveWorkingDLR();
  renderCrews();showPage('dlr');
  showToast(keys.length+' block'+(keys.length!==1?'s':'')+' generated'+(allData&&allData.routeDate?' · '+rd:''));
}

// ── DLR RENDERING ────────────────────────────────────────────────
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){var dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
function updateDateDisplay(){document.getElementById('today-display').textContent=fmtDate(document.getElementById('log-date').value);saveWorkingDLR();}
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
  container.innerHTML=currentCrews.map(function(crew){return crewHTML(crew);}).join('');
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
    '<span class="b-hp">Hold Point: '+escHtml(crew.holdPoint)+'</span>':
    '<span class="status-off">Hold Point: No</span>';
  var fuseBadge=isActive(crew.fusingPeer)?
    '<span class="b-fuse">Fusing Peer: '+escHtml(crew.fusingPeer)+'</span>':
    '<span class="status-off">Fusing Peer: No</span>';
  var badgeBar='<div class="badge-bar">'+contBadge+hpBadge+fuseBadge+'</div>';

  return '<div class="crew-card" id="crew-'+crew.id+'">'+
    '<div class="crew-card-header" onclick="toggleCrew('+crew.id+')">'+
      '<div style="display:flex;align-items:center;flex:1;min-width:0">'+
        '<h2>Crew '+crew.num+'</h2>'+routeTag+
        (crew.location?'<span class="crew-loc-preview">'+escHtml(crew.location.substring(0,45))+'</span>':'')+
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
  var masterList=type==='trade'?trades:equipment;
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
  var drafts=getData('dlr_drafts',{});
  drafts[date]={date:date,crews:JSON.parse(JSON.stringify(currentCrews)),savedAt:new Date().toISOString()};
  setData('dlr_drafts',drafts);syncPushDrafts();showToast('Draft saved');
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
  if(drafts[d]){currentCrews=drafts[d].crews;showToast('Draft restored');}
}

// ── HISTORY ──────────────────────────────────────────────────────
function renderHistory(){
  var q=(document.getElementById('search-input')&&document.getElementById('search-input').value||'').toLowerCase();
  var list=document.getElementById('history-list');
  var filtered=logs;
  if(q)filtered=logs.filter(function(l){return l.date.includes(q)||fmtDate(l.date).toLowerCase().includes(q)||l.crews.some(function(c){return(c.location||'').toLowerCase().includes(q)||(c.wo||'').toLowerCase().includes(q)||(c.foremen||[]).join(' ').toLowerCase().includes(q);});});
  if(filtered.length===0){list.innerHTML='<div class="empty-state"><p>'+(logs.length===0?'No logs submitted yet':'No results found')+'</p></div>';return;}
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
        '<div><div class="log-day-title">'+fmtDate(log.date)+editedBadge+'</div><div class="log-day-meta">'+log.crews.length+' block'+(log.crews.length!==1?'s':'')+' · '+tw+' workers'+savedTxt+'</div></div>'+
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
  var subject=getContVal('cont-subject');
  var plain=(subject?subject+'\n\n':'')+buildContingencyBody();
  var html=(subject?bcEsc(subject)+'<br><br>':'')+buildContingencyHTML();
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
  document.getElementById('map-list').innerHTML=(locs.length?locs:['']).map(function(l){return mapRowHTML(l);}).join('');
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
function openMapsRoute(){
  var stops=mapStopList();
  if(!stops.length){showToast('Add at least one stop');return;}
  var url;
  if(stops.length===1){
    url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stops[0]);
  }else{
    var dest=encodeURIComponent(stops[stops.length-1]);
    var mids=stops.slice(0,-1).map(encodeURIComponent).join('|');
    url='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+dest+'&waypoints='+mids;
    if(stops.length>10)showToast('Many stops — Google may cap waypoints (~9)');
  }
  var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}
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
var fbDb=null,fbUser=null,fbUnsub=null;
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
function signOutSync(){if(window.firebase&&firebase.auth)firebase.auth().signOut();}

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
    },function(){});
  });
  syncMeta();
}
function stopSync(){if(fbUnsub){fbUnsub();fbUnsub=null;}}
function mergeRemoteLog(r){
  if(!r||!r.date)return false;
  var i=logs.findIndex(function(l){return l.date===r.date;});
  if(i<0){logs.push(r);return true;}
  if(!logs[i].savedAt||(r.savedAt&&r.savedAt>logs[i].savedAt)){logs[i]=r;return true;}
  return false;
}
function pushLocalLogs(){
  if(!syncOn())return Promise.resolve();
  return userCol('logs').get().then(function(snap){
    var remote={};snap.forEach(function(d){var x=d.data();if(x&&x.date)remote[x.date]=x;});
    var batch=fbDb.batch(),n=0;
    logs.forEach(function(l){var r=remote[l.date];if(!r||!r.savedAt||(l.savedAt&&l.savedAt>r.savedAt)){batch.set(userCol('logs').doc(l.date),l);n++;}});
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
}
function syncPushLog(entry){if(syncOn())userCol('logs').doc(entry.date).set(entry).catch(function(){});}
function syncDeleteLog(date){if(syncOn())userCol('logs').doc(date)['delete']().catch(function(){});}
function syncPushDrafts(){if(syncOn())userCol('meta').doc('drafts').set({drafts:getData('dlr_drafts',{})}).catch(function(){});}
function syncPushLists(){if(syncOn())userCol('meta').doc('lists').set({trades:trades,equipment:equipment}).catch(function(){});}
function syncPushAll(){if(!syncOn())return;logs.forEach(function(l){syncPushLog(l);});syncPushDrafts();syncPushLists();}

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
renderCrews();updateSettingsCounts();
restoreRoute();
setupContKeyboard();
initSync();
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});}
