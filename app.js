const STORAGE_KEY = 'first2-achieve8-tasks-v1';
const $ = (selector) => document.querySelector(selector);
const taskGrid = $('#taskGrid');
const taskModal = $('#taskModal');
const progressModal = $('#progressModal');
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let editingId = null;
let calendarCursor = new Date();

const dateFmt = new Intl.DateTimeFormat('ja-JP', { month:'short', day:'numeric', weekday:'short' });
const fullDateFmt = new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
const asDate = (value) => new Date(`${value}T12:00:00`);
const toInputDate = (date) => { const d = new Date(date.getTime() - date.getTimezoneOffset()*60000); return d.toISOString().slice(0,10); };
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate()+days); return d; };
const daysBetween = (a,b) => Math.max(1, Math.ceil((asDate(b)-asDate(a))/86400000));
const checkpoint = (task) => addDays(asDate(task.startDate), Math.max(1, Math.ceil(daysBetween(task.startDate,task.deadline)*.2)));
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

function demoTasks(){
  const today=new Date();
  const make=(name,startOffset,dueOffset,hours,priority,progress,notes)=>({id:crypto.randomUUID(),name,startDate:toInputDate(addDays(today,startOffset)),deadline:toInputDate(addDays(today,dueOffset)),hours,priority,progress,notes,createdAt:new Date().toISOString(),demo:true});
  return [
    make('新サービスの企画書',-3,12,24,'high',55,'経営会議に出せる初稿をつくる'),
    make('採用サイトのリニューアル',-8,34,48,'high',82,'トップページと募集要項を先に確定'),
    make('ユーザーインタビュー分析',-1,8,12,'medium',20,'録音6件からインサイトを抽出'),
    make('夏季キャンペーン LP',2,19,30,'high',0,'コピー・ワイヤー・デザイン・実装'),
    make('四半期レポート作成',-14,5,16,'high',75,'KPIと次四半期の打ち手を整理'),
    make('チーム合宿の準備',1,27,18,'low',5,'会場、アジェンダ、参加者ガイド'),
    make('新機能オンボーディング',-5,16,22,'medium',40,'チュートリアル5画面とヘルプ記事'),
    make('ポートフォリオ更新',4,45,20,'low',0,'直近3プロジェクトを追加'),
    make('顧客向け提案資料',-2,3,10,'high',90,'課題仮説と導入効果を10枚にまとめる'),
    make('業務フロー自動化 PoC',6,58,60,'medium',0,'請求処理の手作業を検証対象にする'),
    make('ブランドガイドライン',-20,22,40,'medium',68,'ロゴ、色、タイポグラフィを定義'),
    make('読書会プレゼン',3,11,8,'low',0,'要点と実務への応用を15分で共有')
  ];
}

if(!localStorage.getItem(STORAGE_KEY)){ tasks=demoTasks(); save(); }

function updatePreview(){
  const start=$('#startDate').value, end=$('#deadline').value, hours=Number($('#hours').value)||0;
  if(!start||!end||asDate(end)<=asDate(start)){ $('#methodPreview').innerHTML='開始日より後の締切を選んでください。'; return; }
  const cp=addDays(asDate(start),Math.max(1,Math.ceil(daysBetween(start,end)*.2)));
  $('#methodPreview').innerHTML=`<b>${dateFmt.format(cp)}まで</b>に約<strong>${(hours*.8).toFixed(1)}時間</strong>を集中投下。残り約${(hours*.2).toFixed(1)}時間でレビューと改善を行います。`;
}

function render(){
  taskGrid.innerHTML='';
  const sorted=[...tasks].sort((a,b)=>new Date(a.deadline)-new Date(b.deadline));
  sorted.forEach(task=>{
    const node=$('#taskTemplate').content.cloneNode(true); const card=node.querySelector('.task-card');
    const cp=checkpoint(task), elapsed=Math.max(0,(new Date()-asDate(task.startDate))/86400000); const total=daysBetween(task.startDate,task.deadline);
    const expected=Math.min(100, elapsed/(total*.2)*80); const onTrack=task.progress>=expected-10;
    card.dataset.id=task.id; card.querySelector('.task-title').textContent=task.name;
    card.querySelector('.task-note').textContent=task.notes||'メモはありません';
    const priority=card.querySelector('.priority'); priority.textContent={high:'● HIGH PRIORITY',medium:'● STANDARD',low:'● LOW PRIORITY'}[task.priority];priority.classList.add(task.priority);
    card.querySelector('.phase-one-hours').textContent=`${(task.hours*.8).toFixed(1)} h`;
    card.querySelector('.phase-two-hours').textContent=`${(task.hours*.2).toFixed(1)} h`;
    card.querySelector('.start-label').textContent=dateFmt.format(asDate(task.startDate));card.querySelector('.checkpoint-label').textContent=`${dateFmt.format(cp)} / 80%`;
    card.querySelector('.deadline-label').textContent=fullDateFmt.format(asDate(task.deadline));
    card.querySelector('.bar-fill').style.width=`${task.progress}%`;
    card.querySelector('.phase-message').textContent=task.progress>=80?'✓ 8割ライン達成。ここからは磨き上げよう。':onTrack?'予定どおり。まずは完成形をつくろう。':'少し遅れ気味。完成度より全体像を優先しよう。';
    card.querySelector('.progress-button').onclick=()=>openProgress(task.id);
    card.querySelector('.menu-button').onclick=()=>{if(confirm(`「${task.name}」を削除しますか？`)){tasks=tasks.filter(t=>t.id!==task.id);save();render();}};
    taskGrid.append(node);
  });
  $('#emptyState').hidden=tasks.length>0; taskGrid.hidden=tasks.length===0;
  const done=tasks.filter(t=>t.progress>=100).length, achieved=tasks.filter(t=>t.progress>=80).length;
  $('#stats').innerHTML=`<span class="stat"><b>${tasks.length}</b> ACTIVE</span><span class="stat"><b><strong>${achieved}</strong></b> 80%達成</span><span class="stat"><b>${done}</b> DONE</span>`;
  renderCommandCenter();
  renderCalendar();
}

function renderCommandCenter(){
  const today=new Date();
  const active=tasks.filter(t=>t.progress<100&&asDate(t.deadline)>=today).map(task=>{
    const left=Math.max(1,daysBetween(toInputDate(today),task.deadline));
    const target=task.progress<80?80:100, remaining=Math.max(0,target-task.progress);
    const effort=task.hours*(remaining/100), urgency=(remaining/left)*(task.priority==='high'?1.5:task.priority==='low'?.75:1);
    return {...task,left,effort,urgency,target};
  }).sort((a,b)=>b.urgency-a.urgency);
  const focus=active[0];
  const todayHours=active.slice(0,3).reduce((sum,t)=>sum+Math.min(2.5,Math.max(.5,t.effort/Math.max(1,t.left*.2))),0);
  $('#todayLoad').textContent=`推奨フォーカス時間  ${todayHours.toFixed(1)} HOURS`;
  if(focus){
    $('#focusRecommendation').innerHTML=`<span class="focus-number">01</span><div class="focus-copy"><small>NEXT BEST ACTION</small><h3>${focus.name}</h3><p>${focus.progress<80?'全体を粗く最後まで通し、まず80%ラインへ。':'フィードバックを1つ反映し、完成状態へ。'}<br>今日の推奨：${Math.min(2.5,Math.max(.5,focus.effort/Math.max(1,focus.left*.2))).toFixed(1)}時間</p></div>`;
  }else $('#focusRecommendation').innerHTML='<div class="focus-copy"><h3>すべて完了しています</h3><p>新しいタスクを追加しましょう。</p></div>';
  const risks=active.filter(t=>t.left<=4&&t.progress<80).length;
  const forecast=active.filter(t=>t.progress>=80||t.urgency<8).length;
  $('#signalPanel').innerHTML=`<small>PACE SIGNAL</small><div class="signal-row"><span>締切リスク</span><b>${risks}</b><em class="${risks?'risk-high':'risk-ok'}">${risks?'ACTION':'ON TRACK'}</em></div><div class="signal-row"><span>80%到達見込み</span><b>${forecast}/${active.length}</b><em class="risk-ok">FORECAST</em></div>`;
}

const demoEvents=[{day:1,time:'10:00',name:'週次ミーティング'},{day:2,time:'14:00',name:'顧客定例'},{day:3,time:'12:00',name:'ランチ予定'},{day:4,time:'16:00',name:'1on1'},{day:5,time:'09:30',name:'全社会議'}];
function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
  $('#calendarMonth').textContent=`${year} / ${String(month+1).padStart(2,'0')}`;
  const first=new Date(year,month,1,12), mondayOffset=(first.getDay()+6)%7, gridStart=addDays(first,-mondayOffset), todayKey=toInputDate(new Date());
  $('#calendarGrid').innerHTML='';
  for(let i=0;i<42;i++){
    const date=addDays(gridStart,i),key=toInputDate(date),cell=document.createElement('div');cell.className='calendar-day';
    if(date.getMonth()!==month)cell.classList.add('outside');if(key===todayKey)cell.classList.add('today');
    const label=document.createElement('span');label.className='day-number';label.innerHTML=`${date.getDate()}${key===todayKey?'<b>TODAY</b>':''}`;cell.append(label);
    let items=[];
    tasks.forEach(task=>{const start=asDate(task.startDate),end=asDate(task.deadline),cp=checkpoint(task);if(date>=start&&date<=end){const focus=date<=cp;const totalHours=(task.hours*(focus?.8:.2));const phaseDays=Math.max(1,focus?Math.ceil(daysBetween(task.startDate,task.deadline)*.2):daysBetween(toInputDate(cp),task.deadline));const daily=Math.max(.5,totalHours/phaseDays);items.push({type:focus?'focus':'polish',time:focus?'09:00':'15:30',name:task.name,hours:daily});}});
    const weekday=date.getDay();demoEvents.filter(e=>e.day===weekday).forEach(e=>items.push({type:'event',...e}));
    items.slice(0,4).forEach(item=>{const el=document.createElement('span');el.className=`cal-item ${item.type}`;el.innerHTML=`<strong>${item.time}</strong>${item.name}${item.hours?` · ${item.hours.toFixed(1)}h`:''}`;cell.append(el);});
    if(items.length>4){const more=document.createElement('span');more.className='more-items';more.textContent=`+ ${items.length-4} MORE`;cell.append(more);}$('#calendarGrid').append(cell);
  }
}

function openTask(){
  const today=new Date(), week=addDays(today,7); $('#taskForm').reset();
  $('#startDate').value=toInputDate(today); $('#deadline').value=toInputDate(week); $('#hours').value=10; updatePreview(); taskModal.showModal();
}
function openProgress(id){editingId=id;const task=tasks.find(t=>t.id===id);$('#progressTitle').textContent=task.name;$('#progressRange').value=task.progress;$('#rangeValue').textContent=task.progress;progressModal.showModal();}

$('#today').textContent=fullDateFmt.format(new Date());
$('#openTaskModal').onclick=openTask; $('#emptyAdd').onclick=openTask; $('#closeModal').onclick=()=>taskModal.close(); $('#closeProgress').onclick=()=>progressModal.close();
['startDate','deadline','hours'].forEach(id=>$(`#${id}`).addEventListener('input',updatePreview));
$('#progressRange').oninput=(e)=>$('#rangeValue').textContent=e.target.value;
$('#taskForm').onsubmit=(e)=>{e.preventDefault();const data=new FormData(e.target);if(asDate(data.get('deadline'))<=asDate(data.get('startDate'))){alert('締切は開始日より後に設定してください。');return;}tasks.push({id:crypto.randomUUID(),name:data.get('name').trim(),startDate:data.get('startDate'),deadline:data.get('deadline'),hours:Number(data.get('hours')),priority:data.get('priority'),notes:data.get('notes').trim(),progress:0,createdAt:new Date().toISOString()});save();render();taskModal.close();};
$('#progressForm').onsubmit=(e)=>{e.preventDefault();const task=tasks.find(t=>t.id===editingId);task.progress=Number($('#progressRange').value);save();render();progressModal.close();};
[taskModal,progressModal].forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
$('.view-switch').onclick=(e)=>{const button=e.target.closest('.view-tab');if(!button)return;document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active',b===button));const calendar=button.dataset.view==='calendar';$('#calendarView').hidden=!calendar;$('#taskGrid').hidden=calendar||tasks.length===0;$('#emptyState').hidden=calendar||tasks.length>0;$('#dashboardHead').hidden=calendar;$('#commandCenter').hidden=calendar;};
$('#prevMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();};
$('#nextMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();};
render();
