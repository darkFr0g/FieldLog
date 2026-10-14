/* ─────────────────────────────────────────────────────────────
   FieldLog — tad patch (branch: tad/mileage-payroll)
   Loaded AFTER js/app.js. These definitions REPLACE their app.js
   originals (last definition wins in JS):
     - renderMileage()  → phone-first card-per-stop layout
     - renderMonth()    → adds payroll section + Excel export button
   New: mileNotesOpen/mileToggleNote, payroll week report, .xlsx export.
   When this work is finalized, fold it into js/app.js and delete this file.
   ───────────────────────────────────────────────────────────── */
var mileNotesOpen={};
function mileToggleNote(i){var k=mileDate+':'+i;mileNotesOpen[k]=!mileNotesOpen[k];renderMileage();}

function renderMileage(){
  var disp=document.getElementById('mile-display'),di=document.getElementById('mile-date'),body=document.getElementById('mileage-body');
  if(!body)return;
  var scY=(window.scrollY||document.documentElement.scrollTop||0);
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
  h+='<label class="mile-f" style="margin-bottom:10px"><span>Start odometer (first stop)</span><input class="mile-sel nst-startodo" inputmode="numeric" placeholder="e.g. 72388" value="'+(e.startOdo===''||e.startOdo==null?'':e.startOdo)+'" onchange="mileSetStart(this.value)"></label>';
  var cum=(e.startOdo!==''&&e.startOdo!=null&&!isNaN(+e.startOdo))?+e.startOdo:null;
  var endOdo=[];
  e.stops.forEach(function(s,i){
    if(cum===null){endOdo.push(null);return;}
    if(i===0){endOdo.push(cum);return;}
    var leg=(s.mi===''||s.mi==null||isNaN(+s.mi))?null:+s.mi;
    endOdo.push(leg===null?cum:(cum=cum+leg));
  });
  h+='<div class="nst-list">';
  e.stops.forEach(function(s,i){
    var isStart=(i===0),n=e.stops.length;
    var chip='';
    if(endOdo[i]!==null){chip=isStart?'<span class="nst-odo">◉ '+endOdo[i]+'</span>':'<span class="nst-odo">'+endOdo[i-1]+' → '+endOdo[i]+'</span>';}
    var noteOpen=mileNotesOpen[mileDate+':'+i];
    h+='<div class="nst-card'+(isStart?' nst-card-start':'')+'">'+
      '<div class="nst-top"><span class="nst-num">'+(i+1)+'</span>'+
        '<input class="field-input nst-loc" placeholder="'+(isStart?'Start location (first job)':'Location')+'" value="'+escHtml(s.loc||'')+'" onchange="mileSetStop('+i+',\'loc\',this.value)">'+
        (s.ticket?'<span class="nst-tkt">'+escHtml(s.ticket)+'</span>':'')+'</div>'+
      '<div class="nst-mid">'+
        (isStart?'<span class="nst-startlbl">START</span>':'<input class="field-input nst-mi" inputmode="decimal" placeholder="miles" value="'+(s.mi===''||s.mi==null?'':s.mi)+'" onchange="mileSetStop('+i+',\'mi\',this.value)">')+
        chip+
        '<span class="nst-btns">'+
          (i>0?'<button class="nst-btn" onclick="mileMoveStop('+i+',-1)" aria-label="Move stop up">↑</button>':'')+
          (i<n-1?'<button class="nst-btn" onclick="mileMoveStop('+i+',1)" aria-label="Move stop down">↓</button>':'')+
          '<button class="nst-btn nst-del" onclick="mileDelStop('+i+')" aria-label="Delete stop">×</button>'+
        '</span></div>'+
      '<div class="nst-sub"><button class="nst-notebtn" onclick="mileToggleNote('+i+')">'+(s.remarks?'✎ Edit note':'+ Add note')+'</button></div>'+
      (noteOpen?'<input class="field-input nst-rmk" placeholder="Note for this stop" value="'+escHtml(s.remarks||'')+'" onchange="mileSetStop('+i+',\'remarks\',this.value)">':'')+
    '</div>';
  });
  h+='</div>';
  var copyDays=mileDaysWithStops();
  var copySel=copyDays.length?('<select class="mile-sel mile-copy" onchange="mileCopyFrom(this.value);this.value=\'\'"><option value="">Copy stops from another day…</option>'+copyDays.map(function(k){return '<option value="'+k+'">'+new Date(k+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</option>';}).join('')+'</select>'):'';
  var addLocs=mileStopSource(mileDate);
  var addSel=addLocs.length?('<select class="mile-sel" style="margin-top:8px" onchange="mileAddLoc(this.value);this.value=\'\'"><option value="">+ Add stop from a job location…</option>'+addLocs.map(function(o){return '<option value="'+escHtml(o.loc)+'~'+escHtml(o.ticket||'')+'">'+escHtml(o.loc)+'</option>';}).join('')+'</select>'):'';
  h+='<div class="mile-actions"><button class="btn btn-secondary btn-sm" onclick="mileAddStop()">+ Add stop</button><button class="btn btn-secondary btn-sm" onclick="mileLoadFromLog()">Load all from crews</button><button class="btn btn-green btn-sm" onclick="mileMapStops()">Map drive</button></div>'+
     addSel+
     (copySel?'<div style="margin-top:8px">'+copySel+'</div>':'')+
     '<div class="mile-total">'+mileTotal(e)+' mi today'+(mileEndOdo(e)!==''?' · ends '+mileEndOdo(e):'')+'</div></div>';
  var prevEnd=mileEndOdo(milePrevEntry(mileDate));
  h+='<div class="mile-foot"><div><span class="mile-foot-l">Prev ODO end</span><b>'+(prevEnd===''?'—':prevEnd)+'</b></div><div><span class="mile-foot-l">Month total → Month tab</span><b>'+mileMonthTotal(mileDate)+' mi</b></div></div>';
  body.innerHTML=h;
  applyMileCollapsed();
  window.scrollTo(0,scY);
}

// ── PAYROLL WEEK (Friday submission) ─────────────────────────────
var payWeek=weekStartOf(today());
function weekStartOf(ds){var d=new Date(ds+'T12:00:00');d.setDate(d.getDate()-d.getDay());return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function payStep(k){var d=new Date(payWeek+'T12:00:00');d.setDate(d.getDate()+7*k);payWeek=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);renderMonth();}
function payRegHrs(e){if(!e)return 0;if(e.shift&&e.shift!=='')return 8;if(e.workCode==='Vacation'||e.workCode==='Holiday'||e.workCode==='NY-PFL')return 8;return 0;}
function payOT(e){if(!e||e.ot===''||e.ot==null||isNaN(+e.ot))return 0;return +e.ot;}
function payExp(e){if(!e||e.expenses===''||e.expenses==null||isNaN(+e.expenses))return 0;return +e.expenses;}
function payWeekLabel(ws){var a=new Date(ws+'T12:00:00'),b=new Date(ws+'T12:00:00');b.setDate(b.getDate()+6);return a.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' – '+b.toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function buildPayrollHTML(ws){
  var p=getProfile(),m=allMileage(),rows='',tR=0,tO=0,tE=0;
  for(var i=0;i<7;i++){
    var d=new Date(ws+'T12:00:00');d.setDate(d.getDate()+i);
    var ds=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    var e=m[ds],rh=payRegHrs(e),ot=payOT(e),ex=payExp(e);
    tR+=rh;tO+=ot;tE+=ex;
    var dt=d.toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric'});
    rows+='<tr><td>'+dt+'</td><td>'+escHtml(e&&e.shift?e.shift:'')+'</td><td>'+(rh||'')+'</td><td>'+(ot||'')+'</td><td>'+escHtml(e&&e.workCode?e.workCode:'')+'</td><td>'+escHtml(e&&e.poet?e.poet:'')+'</td><td>'+(ex?ex.toFixed(2):'')+'</td></tr>';
  }
  var a=new Date(ws+'T12:00:00'),b=new Date(ws+'T12:00:00');b.setDate(b.getDate()+6);
  var lbl=a.toLocaleDateString('en-US',{month:'long',day:'numeric'})+' – '+b.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  return '<div class="ci-form">'+
    '<div class="ci-title">WEEKLY PAYROLL — HOURS &amp; PAY ITEMS</div><div class="ci-sub">'+escHtml(lbl)+'</div>'+
    '<table class="ci-head"><tr><td><b>'+escHtml(p.name||'')+'</b><div class="cil">Employee\'s Name</div></td><td><b>'+escHtml(p.empNo||'')+'</b><div class="cil">Employees No.</div></td><td><b>'+escHtml(p.roll||'')+'</b><div class="cil">Roll No. and Dept.</div></td></tr></table>'+
    '<table class="ci-tbl"><thead><tr><th>DATE</th><th>SHIFT</th><th>REG HRS</th><th>OT</th><th>WORK CODE</th><th>TASK # (POET)</th><th>EXPENSES $</th></tr></thead><tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td colspan="2">WEEK TOTALS</td><td>'+tR+'</td><td>'+tO+'</td><td></td><td></td><td>'+(tE?tE.toFixed(2):'')+'</td></tr></tfoot></table>'+
    '<div class="ci-decl">I DECLARE THE INFORMATION ON THIS REPORT IS TRUE, CORRECT, AND COMPLETE TO THE BEST OF MY KNOWLEDGE AND BELIEF.</div>'+
    '<div class="ci-sig"><span>Date: ______________</span><span>Print name: '+escHtml(p.name||'')+'</span><span>Signature: ______________</span></div></div>';
}
function exportPayroll(){var pa=document.getElementById('printArea');if(!pa)return;pa.innerHTML=buildPayrollHTML(payWeek);setTimeout(function(){window.print();},40);}

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
    '<div style="padding:16px 12px 8px"><button class="btn btn-green" style="width:100%;justify-content:center" onclick="exportExcel()">CI-660 Excel — '+d0.toLocaleDateString('en-US',{month:'long'})+' (.xlsx)</button></div>'+
    '<div style="padding:0 12px 8px"><button class="btn btn-secondary" style="width:100%;justify-content:center" onclick="exportCIMileage()">CI Mileage Form (PDF)</button></div>'+
    '<div class="pay-sec"><div class="pay-nav"><button class="btn btn-secondary btn-sm" onclick="payStep(-1)">‹ Prev</button><span class="pay-lbl">Payroll: '+payWeekLabel(payWeek)+'</span><button class="btn btn-secondary btn-sm" onclick="payStep(1)">Next ›</button></div>'+
    '<button class="btn btn-green" style="width:100%;justify-content:center" onclick="exportPayroll()">Payroll week (PDF)</button>'+
    '<div class="mile-carry">Regular hours = 8 per shift day · Vacation/Holiday/NY-PFL count as 8</div></div>';
}

// ── EXCEL EXPORT (.xlsx — the submittable CI-660 + Daily Log) ──────
// Uses the vendored SheetJS (XLSX global). Generates the actual file
// Jonah submits — no laptop needed.
function exportExcel(){
  if(typeof XLSX==='undefined'){showToast('Excel library not loaded');return;}
  var p=getProfile(),m=allMileage(),ym=monthYM;
  var wb=XLSX.utils.book_new();
  var monthName=new Date(ym+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
  // ---- CI Mileage Form (CI-660-1) ----
  var ci=[],merges=[];
  function ciRow(cells){ci.push(cells);return ci.length-1;}
  var r0=ciRow(['CI-660-1, \u201c REIMBURSEMENT FOR FREQUENT USE OF PERSONAL VEHICLE ON COMPANY BUSINESS\u201d']);
  merges.push({s:{r:r0,c:0},e:{r:r0,c:9}});
  var r1=ciRow(['DAILY MILEAGE REPORT']);
  merges.push({s:{r:r1,c:0},e:{r:r1+1,c:9}});
  ciRow([]);ciRow([]);
  ciRow(['',(p.name||''),'',(p.empNo||''),'',(p.roll||'')]);
  ciRow(['',"Employee's Name",'','Employees No.','','Roll No. and Dept.']);
  ciRow([]);
  ciRow(['',(p.vehicle||''),'',(p.plate||''),'',monthName]);
  ciRow(['','Auto Make & Year','','License Plate No.','','Month / Year']);
  ciRow([]);ciRow([]);
  var rh=ciRow(['DATE','ODOMETER READINGS','','TOTAL MILEAGE DRIVEN IN AUTO','MILEAGE ANALYSIS','','','EXPLANATION OF COMPANY BUSINESS MILEAGE','','DATE']);
  merges.push({s:{r:rh,c:1},e:{r:rh,c:2}});
  merges.push({s:{r:rh,c:4},e:{r:rh,c:6}});
  ciRow(['','START','END','','FROM HOME TO WORK OUT & RETURN','OTHER NON-BUSINESS MILEAGE','COMPANY BUSINESS MILEAGE']);
  ciRow([]);
  var days=monthDayCount(ym),gT=0;
  for(var d=1;d<=days;d++){
    var ds=ym+'-'+('0'+d).slice(-2),e=m[ds];
    var st='',en='',tot=0;
    if(e){
      var so=e.startOdo;
      if(so!==''&&so!=null&&!isNaN(+so)){st=+so;var eo=mileEndOdo(e);en=(eo===''||eo==null)?st:eo;}
      tot=mileTotal(e)||0;
    }
    gT+=tot;
    var dt=new Date(ds+'T12:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric'});
    ciRow([d,st,en,tot,'NRQ',0,tot,'See Daily Log Sheet','',dt]);
  }
  var rg=ciRow(['','GRAND TOTALS','',gT,0,0,gT]);
  merges.push({s:{r:rg,c:1},e:{r:rg,c:2}});
  ciRow(['I DECLARE THE INFORMATION ON THIS REPORT IS TRUE, CORRECT, AND COMPLETE TO THE BEST OF MY KNOWLEDGE AND BELIEF.']);
  ciRow(['Date:',today(),'Print name:',(p.name||''),'','Signature:']);
  var wsci=XLSX.utils.aoa_to_sheet(ci);
  wsci['!merges']=merges;
  wsci['!cols']=[{wch:6},{wch:13},{wch:13},{wch:13},{wch:15},{wch:15},{wch:15},{wch:24},{wch:4},{wch:12}];
  XLSX.utils.book_append_sheet(wb,wsci,'CI Mileage Form');
  // ---- Daily Log ----
  var dl=[['DAILY LOG \u2014 '+monthName],['Name:',(p.name||''),'Emp #:',(p.empNo||'')],[]];
  dl.push(['DATE','SHIFT','STOP','LOCATION','TICKET','ODO START','ODO END','MILES','REMARKS']);
  for(var d2=1;d2<=days;d2++){
    var ds2=ym+'-'+('0'+d2).slice(-2),e2=m[ds2];
    if(!e2||!(e2.stops||[]).length)continue;
    var dt2=new Date(ds2+'T12:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric'});
    var cum=(e2.startOdo!==''&&e2.startOdo!=null&&!isNaN(+e2.startOdo))?+e2.startOdo:null;
    (e2.stops||[]).forEach(function(s,i){
      var oS='',oE='',mi=(s.mi===''||s.mi==null||isNaN(+s.mi))?'':+s.mi;
      if(cum!==null){oS=(i===0)?cum:cum;oE=(i===0||mi===''||mi===null)?cum:(cum=cum+mi);}
      dl.push([i===0?dt2:'',i===0?(e2.shift||''):'',i+1,(s.loc||''),(s.ticket||''),oS,oE,mi,(s.remarks||'')]);
    });
    dl.push([dt2,'','','DAY TOTAL','','','',mileTotal(e2),'']);
    dl.push([]);
  }
  var wsdl=XLSX.utils.aoa_to_sheet(dl);
  wsdl['!merges']=[{s:{r:0,c:0},e:{r:0,c:8}}];
  wsdl['!cols']=[{wch:12},{wch:16},{wch:6},{wch:34},{wch:14},{wch:10},{wch:10},{wch:8},{wch:30}];
  XLSX.utils.book_append_sheet(wb,wsdl,'Daily Log');
  var fname='FieldLog_CI660_'+ym+'.xlsx';
  XLSX.writeFile(wb,fname);
  showToast('Excel saved: '+fname);
}
