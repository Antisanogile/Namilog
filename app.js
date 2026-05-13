const VERSION='v40-2-calendar-auto-sync';
const EMBEDDED_GOOGLE_CLIENT_ID='962194635793-8oepjpgi0hch239o8ie5cief8ccn2jrl.apps.googleusercontent.com';
const LOG_KEY='namilog.quick-check.logs.v1';
const SETTINGS_KEY='namilog.quick-check.settings.v1';
const PROFILE_KEY='namilog.profile.v1';
const TASK_KEY='namilog.tasks.v1';
const CALENDAR_KEY='namilog.calendar.events.v1';
const DB_KEY='namilog.db.settings.v1';
const AUTH_KEY='namilog.auth.settings.v1';
const ONBOARD_KEY='namilog.onboarding.done.v1';
const emotions=[{id:'fun',emoji:'😄',label:'楽しい',score:2},{id:'good',emoji:'🙂',label:'いい感じ',score:1.5},{id:'calm',emoji:'😌',label:'穏やか',score:1},{id:'tired',emoji:'🥺',label:'少ししんどい',score:-1.5},{id:'cloudy',emoji:'☁️',label:'モヤモヤ',score:-1}];
const progresses=[{id:'great',emoji:'🚀',label:'進んだ',score:2},{id:'little',emoji:'🌱',label:'少し進んだ',score:1},{id:'scattered',emoji:'🌀',label:'散らかった',score:-1},{id:'stuck',emoji:'🧱',label:'詰まった',score:-2},{id:'pause',emoji:'⏸',label:'止まってる',score:-1.5}];
let state={
  logs:load(LOG_KEY,[]),
  settings:load(SETTINGS_KEY,{intervalMinutes:120,browserNotification:false,autoPopup:false,googleClientId:'',calendarConnected:false}),
  profile:load(PROFILE_KEY,{name:'',email:'',team:''}),
  tasks:load(TASK_KEY,['日報','定例','商談準備','資料作成','1on1','AI合宿']),
  calendarEvents:load(CALENDAR_KEY,[]),
  db:load(DB_KEY,{supabaseUrl:'',anonKey:'',table:'namilog_logs',status:'ローカル保存中'}),
  auth:load(AUTH_KEY,{status:'未ログイン',email:'',userId:'',syncOnSave:false,lastSync:''}),
  onboardingDone:load(ONBOARD_KEY,false),
  quick:true,editId:null,draft:{emotion:null,progress:null,task:'',memo:'',nextAction:''},view:'week',toast:'',permission:getPerm(),sw:null,calendarPaste:''
};
state.settings={intervalMinutes:120,browserNotification:false,autoPopup:false,googleClientId:'',calendarConnected:false,calendarAutoSync:true,calendarAutoSyncHour:8,calendarLastSyncDay:'',calendarLastSyncAt:'',...state.settings};
if(!state.settings.googleClientId) state.settings.googleClientId=EMBEDDED_GOOGLE_CLIENT_ID;
function load(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function getPerm(){return !('Notification'in window)?'unsupported':Notification.permission}
function fmtTime(s){return new Date(s).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(s){return new Date(s).toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit',weekday:'short'})}
function dayKey(d){return new Date(d).toLocaleDateString('ja-JP')}
function daysAgo(n){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-n);return d}
function inDays(log,n){return new Date(log.createdAt)>=daysAgo(n-1)}
function scoreLabel(x){return x>1?'高め':x>0?'やや高め':x<-1?'低め':x<0?'やや低め':'ふつう'}
function avg(arr,fn){const xs=arr.map(fn).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0}
function normalizeLog(log){const e=log.emotion||emotions.find(x=>x.id===log.emotionId)||null;const p=log.progress||progresses.find(x=>x.id===log.progressId)||null;return{...log,emotion:e,progress:p,emotionScore:Number.isFinite(log.emotionScore)?log.emotionScore:(e?.score??0),progressScore:Number.isFinite(log.progressScore)?log.progressScore:(p?.score??0),task:log.task||log.taskTitle||'',memo:log.memo||'',nextAction:log.nextAction||'',syncStatus:log.syncStatus||'local',includeInReport:log.includeInReport!==false}}
state.logs=state.logs.map(normalizeLog);save(LOG_KEY,state.logs);
function todayLogs(){const t=dayKey(new Date());return state.logs.filter(l=>dayKey(l.createdAt)===t)}
function periodLogs(){const n=state.view==='day'?1:state.view==='month'?30:7;return state.logs.filter(l=>inDays(l,n))}
function combinedScore(l){return ((Number.isFinite(l.emotionScore)?l.emotionScore:0)+(Number.isFinite(l.progressScore)?l.progressScore:0))/2}
function words(logs){const stop='これ それ あれ ため こと 今日 明日 する した です ます あり なし 自分'.split(' ');const map={};logs.forEach(l=>(`${l.memo||''} ${l.task||''} ${l.nextAction||''}`).split(/[^\p{L}\p{N}一-龥ぁ-んァ-ヶー]+/u).filter(w=>w.length>1&&!stop.includes(w)).forEach(w=>map[w]=(map[w]||0)+1));return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8)}
function weather(logs){const s=avg(logs,l=>combinedScore(l));if(!logs.length)return{icon:'🌙',text:'まだ観測前',score:0};if(s>=1.2)return{icon:'☀️',text:'晴れ',score:s};if(s>=.3)return{icon:'🌤️',text:'晴れときどき雲',score:s};if(s>=-.5)return{icon:'☁️',text:'くもり',score:s};return{icon:'🌧️',text:'雨まじり',score:s}}
function taskStats(logs){const m={};logs.forEach(l=>{const k=l.task||'未分類';m[k]=m[k]||{n:0,e:0,p:0};m[k].n++;m[k].e+=l.emotionScore;m[k].p+=l.progressScore});return Object.entries(m).map(([task,v])=>({task,n:v.n,e:v.e/v.n,p:v.p/v.n,total:(v.e+v.p)/(2*v.n)})).sort((a,b)=>a.total-b.total)}
function isTimedTask(t){return /^\s*(?:\d{1,2}:\d{2}|\d{1,2}\/\d{1,2})/.test(String(t||''))}
function todayCalendarEvents(){const today=dayKey(new Date());return (state.calendarEvents||[]).filter(ev=>!ev.start||dayKey(ev.start)===today)}
function todayCalendarLabels(){return todayCalendarEvents().map(ev=>ev.label).filter(Boolean)}
function visibleTasks(){const labels=new Set(todayCalendarLabels());const base=(state.tasks||[]).filter(t=>!isTimedTask(t)||labels.has(t));return [...new Set([...labels,...base])].filter(Boolean).slice(0,50)}
function pruneStaleCalendarTasks(){const today=dayKey(new Date());state.calendarEvents=(state.calendarEvents||[]).filter(ev=>!ev.start||dayKey(ev.start)===today);const labels=new Set((state.calendarEvents||[]).map(ev=>ev.label).filter(Boolean));state.tasks=(state.tasks||[]).filter(t=>!isTimedTask(t)||labels.has(t))}
function parseCalendarLine(line){const cleaned=String(line||'').trim().replace(/^[-•]\s*/,'');const m=cleaned.match(/^(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?\s*(.+)$/);const today=new Date();today.setHours(0,0,0,0);if(m){const [h,mi]=m[1].split(':').map(Number);const start=new Date(today);start.setHours(h,mi,0,0);const summary=m[3].trim();return{label:`${m[1]} ${summary}`,summary,start:start.toISOString(),end:null,source:'manual-calendar'}}return cleaned?{label:cleaned,summary:cleaned,start:today.toISOString(),end:null,source:'manual-calendar'}:null}
function trendData(){if(state.view==='day')return todayLogs().slice().reverse().map(l=>({label:fmtTime(l.createdAt),score:combinedScore(l),count:1}));const n=state.view==='month'?30:7;return Array.from({length:n},(_,i)=>{const d=daysAgo(n-1-i);const key=dayKey(d);const ls=state.logs.filter(l=>dayKey(l.createdAt)===key);return{label:`${d.getMonth()+1}/${d.getDate()}`,score:ls.length?avg(ls,combinedScore):null,count:ls.length}})}
function insightCards(logs){const w=weather(logs);const ts=taskStats(logs);const low=ts[0],high=ts[ts.length-1];const top=words(logs).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';const neg=logs.filter(l=>combinedScore(l)<-.7);return[
 {t:'こころ天気',b:`${w.icon} ${w.text}`,d:`平均スコアは${w.score.toFixed(1)}。日報では「なぜその波だったか」を一言添えると使いやすいです。`},
 {t:'多かった感情と進捗',b:mostLabel(logs,'emotion')+' / '+mostLabel(logs,'progress'),d:'今日・今週の状態を短く説明する材料です。'},
 {t:'上がりやすいタスク',b:high?`${high.task}：${scoreLabel(high.total)}`:'まだ観測中',d:'良かった条件や再現したい進め方のヒントです。'},
 {t:'1on1で話せそうなこと',b:neg.length?`${neg.length}件の沈みログ`:'大きな沈みは少なめ',d:neg.length?'詰まりが続いたタスクを見て、次に必要な支援を一つ選ぶと話しやすいです。':'良かった条件を共有すると、任せ方や進め方の再現条件が見つかります。'},
 {t:'よく出た言葉',b:top,d:'その期間に頭を占めていたテーマ。週報の見出しや面談の最初の一言にできます。'},
 {t:'下がりやすいタスク',b:low?`${low.task}：${scoreLabel(low.total)}`:'まだ観測中',d:'期待値調整、相談、分解、同席依頼などの話題にできます。'}
]}
function mostLabel(logs,type){const m={};logs.forEach(l=>{const o=l[type];if(o?.label)m[o.label]=(m[o.label]||0)+1});const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];return top?top[0]:'観測中'}
function dailyText(){
  const logs=todayLogs().filter(l=>l.includeInReport!==false).slice().reverse();
  const w=weather(logs);
  const moved=logs.filter(l=>(l.progressScore||0)>0);
  const stuck=logs.filter(l=>(l.progressScore||0)<0||combinedScore(l)<-.6);
  const calmOrGood=logs.filter(l=>combinedScore(l)>.6);
  const nexts=logs.map(l=>l.nextAction).filter(Boolean);
  const topWords=words(logs).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';
  const mainTask=(taskStats(logs).slice().sort((a,b)=>b.n-a.n)[0]?.task)||'まだ観測中';
  const daySentence=logs.length
    ? `今日は「${w.text}」寄りの波でした。${moved[0]?.task?`特に「${moved[0].task}」では前進感がありました。`:''}${stuck[0]?.task?`一方で「${stuck[0].task}」では少し引っかかりがありました。`:''}`
    : '今日はまだログが少ないため、まずは一日の終わりに印象を一言だけ補足すると使いやすくなります。';
  const line=l=>`- ${fmtTime(l.createdAt)} ${l.emotion?.emoji||''} ${l.emotion?.label||'未選択'}${l.progress?` / ${l.progress.emoji} ${l.progress.label}`:''}${l.task?`｜${l.task}`:''}${l.memo?`\n  - メモ：${l.memo}`:''}${l.nextAction?`\n  - 次の一手：${l.nextAction}`:''}`;
  return [`# NamiLog 日報のたね ${new Date().toLocaleDateString('ja-JP')}`,'',
  '## 1. 今日のひとことで言うと',`- ${daySentence}`,'',
  `## 2. 今日のこころ天気：${w.icon} ${w.text}`,`- 波の平均：${w.score.toFixed(1)}` ,`- よく出た言葉：${topWords}` ,`- 頭に残っていたタスク：${mainTask}`,'',
  '## 3. 進んだこと',...(moved.length?moved.slice(0,4).map(l=>`- ${l.task||'未分類'}：${l.progress?.label||'進んだ'}${l.memo?`（${l.memo}）`:''}`):['- ']),'',
  '## 4. 詰まったこと / 気になったこと',...(stuck.length?stuck.slice(0,4).map(l=>`- ${l.task||'未分類'}：${l.emotion?.label||''}${l.progress?` / ${l.progress.label}`:''}${l.memo?`（${l.memo}）`:''}`):['- ']),'',
  '## 5. 明日の一手',...(nexts.length?nexts.slice(0,4).map(x=>`- ${x}`):['- ']),'',
  '## 6. 今日の波の記録',...(logs.length?logs.map(line):['- まだログがありません']),'',
  '## 補足メモ','- 日報に使わないログは、画面上で「日報から外す」にするとこの文章から除外されます。',''].join('\n')
}
function weeklyText(){
  const logs=state.logs.filter(l=>inDays(l,7)&&l.includeInReport!==false).slice().reverse();
  const cards=insightCards(logs);
  const ts=taskStats(logs);
  const low=ts[0],high=ts[ts.length-1];
  const neg=logs.filter(l=>combinedScore(l)<-.6);
  const pos=logs.filter(l=>combinedScore(l)>.6);
  const topWords=words(logs).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';
  const w=weather(logs);
  const weekSummary=logs.length
    ? `今週は「${w.text}」寄りの波でした。${high?`波が上がりやすかったのは「${high.task}」。`:''}${low&&low.task!==high?.task?`少し負荷が出やすかったのは「${low.task}」。`:''}`
    : '今週はまだログが少なめです。来週は1日1件だけでも残すと、傾向が見えやすくなります。';
  return [`# NamiLog 週報・1on1のたね`,'',
  '## 1. 今週のひとことで言うと',`- ${weekSummary}`,'',
  `## 2. 今週のこころ天気：${w.icon} ${w.text}` ,`- 平均スコア：${w.score.toFixed(1)}` ,`- ログ件数：${logs.length}件`,`- よく出た言葉：${topWords}`,'',
  '## 3. 今週よかった流れ',...(pos.length?pos.slice(0,5).map(l=>`- ${fmtDate(l.createdAt)} ${l.task||'未分類'}：${l.emotion?.label||''}${l.progress?` / ${l.progress.label}`:''}${l.memo?`（${l.memo}）`:''}`):['- ']),'',
  '## 4. 詰まりやすかった流れ',...(neg.length?neg.slice(0,5).map(l=>`- ${fmtDate(l.createdAt)} ${l.task||'未分類'}：${l.emotion?.label||''}${l.progress?` / ${l.progress.label}`:''}${l.memo?`（${l.memo}）`:''}`):['- ']),'',
  '## 5. タスク別の傾向',high?`- 波が上がりやすい：${high.task}（${scoreLabel(high.total)}）`:'- 波が上がりやすい：まだ観測中',low?`- 波が下がりやすい：${low.task}（${scoreLabel(low.total)}）`:'- 波が下がりやすい：まだ観測中','',
  '## 6. 1on1で相談・共有するとよさそうなこと',...(cards.slice(2,6).map(c=>`- ${c.t}：${c.b}。${c.d}`)),'',
  '## 7. 来週ためしたいこと','- 詰まったタスクを1つだけ分解する','- 波が上がりやすかった条件をもう一度つくる','- 相談したいことを1つだけ先に言語化する',''].join('\n')
}

function monthlyText(){
  const logs=state.logs.filter(l=>inDays(l,30)&&l.includeInReport!==false).slice().reverse();
  const w=weather(logs);
  const ts=taskStats(logs);
  const low=ts[0],high=ts[ts.length-1];
  const topWords=words(logs).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';
  const pos=logs.filter(l=>combinedScore(l)>.6);
  const neg=logs.filter(l=>combinedScore(l)<-.6);
  const activeDays=new Set(logs.map(l=>dayKey(l.createdAt))).size;
  const monthSentence=logs.length
    ? `この30日は「${w.text}」寄りの波でした。${high?`上がりやすかったのは「${high.task}」。`:''}${low&&low.task!==high?.task?`負荷が出やすかったのは「${low.task}」。`:''}`
    : 'この30日はまだログが少なめです。まずは週に数件の波を残すと、傾向が見えやすくなります。';
  return [`# NamiLog 月次ふりかえりのたね`,'',
  '## 1. この30日のひとことで言うと',`- ${monthSentence}`,'',
  `## 2. こころ天気：${w.icon} ${w.text}`,`- 平均スコア：${w.score.toFixed(1)}`,`- ログ件数：${logs.length}件`,`- 記録した日数：${activeDays}日`,`- よく出た言葉：${topWords}`,'',
  '## 3. 波が上がりやすかった条件',high?`- ${high.task}（${scoreLabel(high.total)} / ${high.n}件）`:'- まだ観測中',...(pos.slice(0,5).map(l=>`- ${fmtDate(l.createdAt)} ${l.task||'未分類'}：${l.emotion?.label||''}${l.progress?` / ${l.progress.label}`:''}${l.memo?`（${l.memo}）`:''}`)),'',
  '## 4. 波が下がりやすかった条件',low?`- ${low.task}（${scoreLabel(low.total)} / ${low.n}件）`:'- まだ観測中',...(neg.slice(0,5).map(l=>`- ${fmtDate(l.createdAt)} ${l.task||'未分類'}：${l.emotion?.label||''}${l.progress?` / ${l.progress.label}`:''}${l.memo?`（${l.memo}）`:''}`)),'',
  '## 5. 来月の仮説','- 波が上がりやすいタスクを、集中しやすい時間に置く','- 波が下がりやすいタスクは、前後に整理時間か相談時間を置く','- 1on1では「続けたい条件」と「詰まりやすい条件」を1つずつ話す',''].join('\n')
}
function monthlyPanel(){
  const logs=state.logs.filter(l=>inDays(l,30)&&l.includeInReport!==false);
  const w=weather(logs);
  const ts=taskStats(logs);
  const low=ts[0],high=ts[ts.length-1];
  const activeDays=new Set(logs.map(l=>dayKey(l.createdAt))).size;
  return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Monthly Reflection</p><h2>月次ふりかえり</h2></div><span class="count">${activeDays}日</span></div><p class="muted">日報・週報より少し大きく、今月の波のクセを見るためのたねです。</p><div class="insights"><div class="insight"><b>今月のこころ天気：${esc(w.icon)} ${esc(w.text)}</b><p>平均スコアは${w.score.toFixed(1)}。ログ件数は${logs.length}件です。</p></div><div class="insight"><b>上がりやすい条件</b><p>${high?`${esc(high.task)}（${scoreLabel(high.total)}）`:'まだ観測中'}</p></div><div class="insight"><b>下がりやすい条件</b><p>${low?`${esc(low.task)}（${scoreLabel(low.total)}）`:'まだ観測中'}</p></div><div class="insight"><b>来月の仮説</b><p>上がる条件を再現し、下がる条件には相談・分解・整理時間を置くとよさそうです。</p></div></div><div class="sideActions"><button class="btn soft" data-a="copyMonthly">月次ふりかえりコピー</button></div></section>`
}

function render(){pruneStaleCalendarTasks();save(LOG_KEY,state.logs);save(SETTINGS_KEY,state.settings);save(PROFILE_KEY,state.profile);save(TASK_KEY,state.tasks);save(CALENDAR_KEY,state.calendarEvents);save(DB_KEY,state.db);save(AUTH_KEY,state.auth);save(ONBOARD_KEY,state.onboardingDone);document.getElementById('app').innerHTML=html();bind()}
function html(){const logs=todayLogs();const plogs=periodLogs();return `<div class="app">
<header class="hero"><div><span class="badge">NAMILOG <span class="version">${VERSION}</span></span><h1>NamiLog</h1><p class="lead">感情の波と仕事の進み方を、やさしく見える化するログアプリです。まずは3秒で残す。あとから補足・修正して、日報・週報・1on1のたねに変えます。</p></div><div class="heroActions"><button class="btn primary" data-a="openQuick">今の波を残す</button><button class="btn soft" data-a="copyDaily">日報をコピー</button></div></header>
<div class="grid"><main>${wavePanel(plogs)}${logsPanel(logs)}</main><aside>${onboardingPanel()}${pilotCompletePanel()}${dailyPanel()}${weeklyPanel(plogs)}${monthlyPanel()}${adminPackagePanel()}${reminderPanel()}${settingsPanel()}${calendarTestPanel()}${qaPanel()}${devPanel()}</aside></div>${state.quick?quickHtml():''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}</div>`}
function wavePanel(logs){const w=weather(logs);return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Motivation Wave</p><h2>モチベーションの波</h2></div><span class="count">${logs.length}件</span></div><div class="tabs"><button class="tab ${state.view==='day'?'on':''}" data-view="day">日</button><button class="tab ${state.view==='week'?'on':''}" data-view="week">週</button><button class="tab ${state.view==='month'?'on':''}" data-view="month">月</button></div><div class="chart">${waveSvg(trendData())}</div><div class="kpi"><div><b>${avg(logs,l=>l.emotionScore).toFixed(1)}</b><span class="muted">感情平均</span></div><div><b>${avg(logs,l=>l.progressScore).toFixed(1)}</b><span class="muted">進捗平均</span></div><div><b>${words(logs).length}</b><span class="muted">よく出た言葉</span></div></div><div class="insights">${insightCards(logs).map(c=>`<div class="insight"><b>${esc(c.t)}：${esc(c.b)}</b><p>${esc(c.d)}</p></div>`).join('')}</div></section>`}
function waveSvg(data){const pts=data.map((d,i)=>({...d,i})).filter(d=>Number.isFinite(d.score));if(!pts.length)return `<div class="emptyWave">まだ波がありません。<br>「今の波を残す」から1件記録してみましょう。</div>`;const W=720,H=210,p=30;const min=-2,max=2;const x=(i)=>p+(W-p*2)*(data.length===1?0.5:i/(data.length-1));const y=(s)=>p+(H-p*2)*(1-(Math.max(min,Math.min(max,s))-min)/(max-min));const path=pts.map((d,j)=>`${j?'L':'M'}${x(d.i)},${y(d.score)}`).join(' ');const first=pts[0],last=pts[pts.length-1];const area=pts.length>1?`${path} L ${x(last.i)},${H-p} L ${x(first.i)},${H-p} Z`:'';return `<svg class="waveSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="waveStroke" x1="0" x2="1"><stop stop-color="#ff8b73"/><stop offset=".55" stop-color="#ef73a6"/><stop offset="1" stop-color="#b9a7ff"/></linearGradient><linearGradient id="waveFill" y1="0" y2="1"><stop stop-color="#ef73a6" stop-opacity=".28"/><stop offset="1" stop-color="#fffdf9" stop-opacity=".05"/></linearGradient></defs><line class="waveGrid" x1="${p}" y1="${p}" x2="${W-p}" y2="${p}"/><line class="waveMid" x1="${p}" y1="${y(0)}" x2="${W-p}" y2="${y(0)}"/><line class="waveGrid" x1="${p}" y1="${H-p}" x2="${W-p}" y2="${H-p}"/><text class="waveAxis" x="8" y="${p+4}">高</text><text class="waveAxis" x="8" y="${y(0)+4}">中</text><text class="waveAxis" x="8" y="${H-p+4}">低</text>${area?`<path class="waveArea" d="${area}"/>`:''}<path class="waveLine" d="${path}"/>${pts.map(d=>`<circle class="wavePoint" cx="${x(d.i)}" cy="${y(d.score)}" r="5"/>`).join('')}${data.map((d,i)=>i===0||i===data.length-1||i===Math.floor(data.length/2)?`<text class="waveLabel" x="${x(i)-12}" y="${H-6}">${esc(d.label)}</text>`:'').join('')}</svg>`}
function logsPanel(logs){const reportCount=logs.filter(l=>l.includeInReport!==false).length;return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Today</p><h2>今日のログ</h2></div><span class="count">${reportCount}/${logs.length}件を日報へ</span></div><p class="muted">波グラフには全部残しつつ、日報・週報に入れたくない細かなログは外せます。</p>${logs.length?`<div class="logs">${logs.map(logCard).join('')}</div>`:`<div class="empty">まだ今日のログはありません。<br>通知が来たら、今の波をひとつ残してみましょう。</div>`}</section>`}
function logCard(l){const off=l.includeInReport===false;return `<article class="log ${off?'reportOff':''}"><div class="logTop"><span>${fmtTime(l.createdAt)}${l.updatedAt?` <span class="muted">修正済み</span>`:''}${off?` <span class="muted">日報から外す</span>`:''}</span><span class="row"><button class="btn soft tiny" data-report="${esc(l.id)}">${off?'日報に戻す':'日報から外す'}</button><button class="btn soft tiny" data-edit="${esc(l.id)}">編集</button><button class="btn soft tiny" data-del="${esc(l.id)}">削除</button></span></div><div class="logMain"><span class="big">${l.emotion?.emoji||l.progress?.emoji||'〰️'}</span><div><h3>${esc(l.emotion?.label||'感情未選択')} / ${esc(l.progress?.emoji||'')} ${esc(l.progress?.label||'進捗未選択')}</h3>${l.task?`<p>タスク：${esc(l.task)}</p>`:''}${l.memo?`<p>メモ：${esc(l.memo)}</p>`:''}${l.nextAction?`<p>次：${esc(l.nextAction)}</p>`:''}<p class="muted">${l.syncStatus==='synced'?'DB同期済み':'ローカル保存'}${l.updatedAt?'・編集あり':''}${off?'・日報/週報には未反映':''}</p></div></div></article>`}
function dailyPanel(){return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Daily Reflection</p><h2>日報のたね</h2></div></div><textarea class="textarea" readonly>${esc(dailyText())}</textarea><div class="sideActions"><button class="btn primary" data-a="copyDaily">コピー</button><button class="btn soft" data-a="copyWeekly">週報/1on1コピー</button><button class="btn soft" data-a="exportJson">JSON出力</button><button class="btn danger" data-a="clearLogs">全削除</button></div></section>`}
function weeklyPanel(logs){return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Weekly / 1on1</p><h2>週報・面談のたね</h2></div></div><div class="insights">${insightCards(logs).slice(2,6).map(c=>`<div class="insight"><b>${esc(c.t)}</b><p>${esc(c.b)}。${esc(c.d)}</p></div>`).join('')}</div><div class="sideActions"><button class="btn soft" data-a="copyWeekly">週報/1on1コピー</button></div></section>`}
function onboardingPanel(){const checks=[
 ['マイログ設定',Boolean(state.profile.name||state.profile.email),'名前かメールを入れる'],
 ['最初の1件',state.logs.length>0,'Quick Checkで1件残す'],
 ['通知',state.permission==='granted','やさしいリマインドを許可する'],
 ['日報コピー',todayLogs().some(l=>l.includeInReport!==false),'日報のたねをコピーしてみる']
];const done=checks.filter(c=>c[1]).length;const guide=`<section class="panel onboarding"><div class="sectionHead"><div><p class="eyebrow">First 3 minutes</p><h2>はじめての3分セットアップ</h2></div><span class="count">${done}/4</span></div><p class="muted">NamiLogは、毎日がんばって書くアプリではありません。通知が来たら、今の感情・進み具合・タスクをひとつ残すだけでOKです。</p><div class="steps">${checks.map((c,i)=>`<div class="step ${c[1]?'done':''}"><span>${c[1]?'✓':i+1}</span><div><b>${c[0]}</b><p>${c[2]}</p></div></div>`).join('')}</div><div class="sideActions"><button class="btn primary tiny" data-a="openQuick">最初の波を残す</button><button class="btn soft tiny" data-a="requestNotif">通知オン</button><button class="btn soft tiny" data-a="copyFirstGuide">初回ガイドコピー</button><button class="btn soft tiny" data-a="completeOnboarding">${state.onboardingDone?'ガイド表示中':'このガイドを閉じる'}</button></div><p class="muted">個人ログは本人の振り返り用です。共有は、本人が日報・週報としてコピーした範囲だけ。</p></section>`;return state.onboardingDone?`<section class="panel"><details class="devDetails"><summary>はじめての3分セットアップを開く</summary>${guide}</details></section>`:guide}


function pilotCompletePanel(){const checks=[
 ['3秒Quick Check',state.logs.length>0,'感情・進捗・タスクを残せる'],
 ['波グラフ',periodLogs().length>0,'日/週/月でモチベーションの波を見られる'],
 ['日報のたね',todayLogs().some(l=>l.includeInReport!==false),'今日のログから日報に使える文章を作れる'],
 ['週報/1on1',state.logs.filter(l=>inDays(l,7)).length>0,'上長面談で話せそうな材料を拾える'],
 ['Googleカレンダー入口',Boolean(state.settings.googleClientId||EMBEDDED_GOOGLE_CLIENT_ID),'予定タイトルをタスク候補にできる準備がある'],
 ['個人ログ方針',true,'本人だけが参照し、共有はコピー範囲だけ']
];const done=checks.filter(c=>c[1]).length;return `<section class="panel onboarding"><div class="sectionHead"><div><p class="eyebrow">Pilot Complete</p><h2>v40 パイロット完成版</h2></div><span class="count">${done}/${checks.length}</span></div><p class="muted">ここまでで、NamiLogは小規模パイロットに出せる最小完成形です。主役は「記録する」「波を見る」「日報・週報・1on1に使う」の3つに絞っています。</p><div class="steps">${checks.map((c,i)=>`<div class="step ${c[1]?'done':''}"><span>${c[1]?'✓':i+1}</span><div><b>${c[0]}</b><p>${c[2]}</p></div></div>`).join('')}</div><div class="insights" style="margin-top:12px"><div class="insight"><b>入力</b><p>Quick Checkで感情・進捗・タスク・任意メモを残します。</p></div><div class="insight"><b>出力</b><p>日報、週報、1on1のたねに変換します。</p></div><div class="insight"><b>可視化</b><p>日・週・月のモチベーションの波として見返せます。</p></div><div class="insight"><b>安全利用</b><p>個人ログは本人のもの。共有は本人がコピーした範囲だけです。</p></div></div><div class="sideActions"><button class="btn primary tiny" data-a="copyPilotFinal">パイロット完成メモコピー</button><button class="btn soft tiny" data-a="copyPilotBrief">同僚向け説明コピー</button><button class="btn soft tiny" data-a="openQuick">今の波を残す</button></div></section>`}

function adminPackagePanel(){return `<section class="panel"><details class="devDetails"><summary>管理者導入パッケージを開く</summary><div class="sectionHead"><div><p class="eyebrow">Admin Package</p><h2>管理者導入パッケージ</h2></div><span class="count">v39</span></div><p class="muted">全社パイロット前に、管理者が共有・説明しやすい材料をここに集約します。社員の毎日画面には出しすぎず、必要な時だけ開く想定です。</p><div class="insights"><div class="insight"><b>導入説明</b><p>NamiLogの目的、利用者メリット、評価・監視に使わない前提を説明します。</p></div><div class="insight"><b>安全利用方針</b><p>個人ログは本人だけが参照し、共有は本人がコピーした範囲だけにする方針です。</p></div><div class="insight"><b>パイロット計画</b><p>小規模に使って、通知・日報・週報・1on1の価値を確認します。</p></div><div class="insight"><b>FAQ</b><p>Google連携、通知、ログ保存、共有範囲で出そうな質問を先回りします。</p></div></div><div class="sideActions"><button class="btn primary tiny" data-a="copyAdminIntro">導入説明コピー</button><button class="btn soft tiny" data-a="copySafetyPolicy">安全利用方針コピー</button><button class="btn soft tiny" data-a="copyPilotPlan">パイロット計画コピー</button><button class="btn soft tiny" data-a="copyFaq">FAQコピー</button></div></details></section>`}

function reminderPanel(){const ok=state.permission==='granted';return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Gentle Reminder</p><h2>やさしいリマインド</h2></div><span class="status ${ok?'ok':'warn'}">${ok?'許可済み':state.permission==='denied'?'ブロック中':'未許可'}</span></div><p class="muted">他の作業中でも、Windows右下からNamiLogがそっと声をかけます。</p><div class="sideActions"><button class="btn primary tiny" data-a="requestNotif">通知オン</button><button class="btn soft tiny" data-a="testNotif">テスト通知</button></div><label class="setting"><span>定期的に声をかけてもらう</span><input type="checkbox" data-set="browserNotification" ${state.settings.browserNotification?'checked':''}></label><label class="setting"><span>間隔</span><select data-set="intervalMinutes"><option value="30" ${state.settings.intervalMinutes==30?'selected':''}>30分</option><option value="60" ${state.settings.intervalMinutes==60?'selected':''}>1時間</option><option value="120" ${state.settings.intervalMinutes==120?'selected':''}>2時間</option><option value="180" ${state.settings.intervalMinutes==180?'selected':''}>3時間</option></select></label></section>`}
function settingsPanel(){const last=state.settings.calendarLastSyncAt?fmtTime(state.settings.calendarLastSyncAt):'未同期';return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Setup</p><h2>毎日使う設定</h2></div></div><div class="box"><h3>マイログ設定</h3><label class="setting"><span>名前</span><input type="text" data-profile="name" value="${esc(state.profile.name)}" placeholder="自分だけの表示名"></label><label class="setting"><span>メール</span><input type="email" data-profile="email" value="${esc(state.profile.email)}" placeholder="name@example.com"></label><label class="setting"><span>チーム</span><input type="text" data-profile="team" value="${esc(state.profile.team)}" placeholder="所属チーム"></label></div><div class="box"><h3>今日のタスク候補</h3><p class="muted">Googleカレンダーは、NamiLogを開いた日ごとに自動で今日の予定だけ同期します。閉じている間の完全自動起動は本番/PWA化で対応します。</p><div class="sideActions"><button class="btn primary tiny" data-a="connectGoogle">Googleカレンダーとつなぐ</button><button class="btn soft tiny" data-a="syncGoogleNow">今日の予定を今すぐ同期</button></div><label class="setting"><span>毎朝、自動で今日の予定を同期</span><input type="checkbox" data-set="calendarAutoSync" ${state.settings.calendarAutoSync?'checked':''}></label><label class="setting"><span>自動同期の目安時刻</span><select data-set="calendarAutoSyncHour"><option value="6" ${state.settings.calendarAutoSyncHour==6?'selected':''}>6時以降</option><option value="7" ${state.settings.calendarAutoSyncHour==7?'selected':''}>7時以降</option><option value="8" ${state.settings.calendarAutoSyncHour==8?'selected':''}>8時以降</option><option value="9" ${state.settings.calendarAutoSyncHour==9?'selected':''}>9時以降</option><option value="10" ${state.settings.calendarAutoSyncHour==10?'selected':''}>10時以降</option></select></label><p class="muted">最終同期：${last} / 同期対象：今日の予定タイトル・開始時刻・終了時刻のみ</p><textarea class="inputLine calendarPaste" id="calendarPaste" placeholder="手動で補足する場合：
09:30 朝会
10:00-11:00 顧客MTG">${esc(state.calendarPaste)}</textarea><div class="sideActions"><button class="btn soft tiny" data-a="importCalendar">手動予定を取り込む</button><button class="btn soft tiny" data-a="calendarSample">サンプル</button></div><div class="inputLine"><input id="taskAdd" placeholder="例：商談準備、週報、1on1"><button class="btn soft tiny" data-a="addTask">追加</button></div><div class="taskChips">${visibleTasks().slice(0,18).map(t=>`<button class="chip" data-taskpick="${esc(t)}">${esc(t)}</button>`).join('')}</div></div></section>`}
function calendarTestPanel(){const client=(state.settings.googleClientId||EMBEDDED_GOOGLE_CLIENT_ID||'').trim();return `<section class="panel"><div class="sectionHead"><div><p class="eyebrow">Calendar Pilot</p><h2>同僚テスト準備</h2></div><span class="status ${client?'ok':'warn'}">${client?'Client ID設定済み':'未設定'}</span></div><p class="muted">明日のテストは、同僚がClient IDを入力せずに「Googleカレンダーとつなぐ」を押すだけで進められる想定です。</p><div class="box"><h3>テストで見ること</h3><p>Google許可画面が出るか / 今日の予定がタスク候補に入るか / Quick Checkで予定つきログが保存できるか。</p><div class="sideActions"><button class="btn primary tiny" data-a="connectGoogle">自分で接続テスト</button><button class="btn soft tiny" data-a="copyColleagueTest">同僚テスト手順コピー</button><button class="btn soft tiny" data-a="copyGoogleTrouble">失敗時メモコピー</button></div></div></section>`}
function qaPanel(){const checks=[
 ['Quick Check保存',todayLogs().length>0,'今日のログが1件以上あります'],
 ['波グラフ',periodLogs().length>0,'グラフに使うログがあります'],
 ['日報対象',todayLogs().some(l=>l.includeInReport!==false),'日報に入るログがあります'],
 ['通知許可',state.permission==='granted','通知が許可されています'],
 ['プロフィール',Boolean(state.profile.name||state.profile.email),'マイログ設定が少し入っています']
];return `<section class="panel"><details class="devDetails"><summary>QAセルフチェックを開く</summary><div class="devGrid"><div class="box"><h3>v31 QA・バグ潰しチェック</h3><p class="muted">パイロット前に、主要導線が生きているかだけ軽く確認します。</p>${checks.map(c=>`<p><span class="status ${c[1]?'ok':'warn'}">${c[1]?'OK':'未'}</span> <b>${c[0]}</b><br><span class="muted">${c[2]}</span></p>`).join('')}<div class="sideActions"><button class="btn soft tiny" data-a="copyQa">QAメモコピー</button><button class="btn soft tiny" data-a="selfTest">テストログを1件追加</button></div></div></div></details></section>`}
function devPanel(){return `<section class="panel"><details class="devDetails"><summary>管理者・開発者メニューを開く</summary><div class="devGrid"><div class="box"><h3>Googleカレンダー / DB / AIは裏側へ</h3><p>OAuth Client IDはv36でアプリに埋め込み済み。社員は基本的に「Googleカレンダーとつなぐ」を押すだけで試せます。</p><div class="sideActions"><button class="btn soft tiny" data-a="copySpec">P0要件コピー</button><button class="btn soft tiny" data-a="copyAdminGuide">管理者メモコピー</button><button class="btn soft tiny" data-a="copyDbSchema">DBスキーマコピー</button></div></div><div class="box"><h3>Googleカレンダー設定</h3><p class="muted">OAuth Client IDは埋め込み済みです。社員はClient IDを入力せずに「Googleカレンダーとつなぐ」だけで試せます。</p><div class="sideActions"><button class="btn primary tiny" data-a="connectGoogle">Googleカレンダーとつなぐ</button><button class="btn soft tiny" data-a="copyGoogleSetup">Google手順コピー</button><button class="btn soft tiny" data-a="copyCalendarPolicy">保存方針コピー</button></div><details style="margin-top:10px"><summary class="muted">管理者向け：Client IDを差し替える</summary><label class="setting"><span>OAuth Client ID</span><input type="text" data-setting="googleClientId" value="${esc(state.settings.googleClientId || EMBEDDED_GOOGLE_CLIENT_ID)}" placeholder="xxxx.apps.googleusercontent.com"></label></details><p class="muted">取得するのは予定タイトル / 開始時刻 / 終了時刻のみです。</p></div><div class="box"><h3>Supabase準備</h3><label class="setting"><span>Supabase URL</span><input type="text" data-db="supabaseUrl" value="${esc(state.db.supabaseUrl)}"></label><label class="setting"><span>Anon Key</span><input type="text" data-db="anonKey" value="${esc(state.db.anonKey)}"></label><label class="setting"><span>Table</span><input type="text" data-db="table" value="${esc(state.db.table)}"></label><p class="muted">現在：${esc(state.auth.status)} / ${esc(state.db.status)}</p></div></div></details></section>`}
function quickHtml(){const taskOptions=[...new Set([state.draft.task,...visibleTasks()].filter(Boolean))];return `<div class="quick"><button class="close" data-a="closeQuick">×</button><p class="eyebrow">Quick Check</p><h2>${state.editId?'波を補足・修正する':'今の波を残す'}</h2><p>${state.editId?'あとから思い出したことを少し整えます。日報の材料がぐっと使いやすくなります。':'感情・進み具合・いまのタスクを、3秒だけ観測します。'}</p><div class="choiceTitle">感情 <span>ひとつ選ぶ</span></div><div class="choices">${emotions.map(e=>`<button class="choice ${state.draft.emotion?.id===e.id?'selected':''}" data-emotion="${e.id}"><span class="emoji">${e.emoji}</span><b>${e.label}</b></button>`).join('')}</div><div class="choiceTitle">進み具合 <span>任意</span></div><div class="choices">${progresses.map(p=>`<button class="choice ${state.draft.progress?.id===p.id?'selected':''}" data-progress="${p.id}"><span class="emoji">${p.emoji}</span><b>${p.label}</b></button>`).join('')}</div><div class="inputLine"><select id="draftTask"><option value="">タスクを選ぶ</option>${taskOptions.map(t=>`<option ${state.draft.task===t?'selected':''}>${esc(t)}</option>`).join('')}</select><input id="draftMemo" placeholder="30秒メモ 任意" value="${esc(state.draft.memo)}"><input id="draftNext" placeholder="次の一手 任意" value="${esc(state.draft.nextAction)}"></div><div class="quickFooter"><button class="btn primary" data-a="saveLog">${state.editId?'修正を保存':'この波を残す'}</button><button class="btn soft" data-a="closeQuick">${state.editId?'修正をやめる':'あとで'}</button></div></div>`}
function bind(){document.querySelectorAll('[data-a]').forEach(el=>el.onclick=()=>action(el.dataset.a));document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{state.view=el.dataset.view;render()});document.querySelectorAll('[data-emotion]').forEach(el=>el.onclick=()=>{state.draft.emotion=emotions.find(e=>e.id===el.dataset.emotion);render()});document.querySelectorAll('[data-progress]').forEach(el=>el.onclick=()=>{state.draft.progress=progresses.find(p=>p.id===el.dataset.progress);render()});document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>startEdit(el.dataset.edit));document.querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{state.logs=state.logs.filter(l=>l.id!==el.dataset.del);toast('削除しました')});document.querySelectorAll('[data-report]').forEach(el=>el.onclick=()=>{state.logs=state.logs.map(l=>l.id===el.dataset.report?{...l,includeInReport:l.includeInReport===false}:l);toast(state.logs.find(l=>l.id===el.dataset.report)?.includeInReport===false?'日報から外しました':'日報に戻しました')});document.querySelectorAll('[data-set]').forEach(el=>el.onchange=()=>{const k=el.dataset.set;state.settings[k]=el.type==='checkbox'?el.checked:Number(el.value)||el.value;render()});document.querySelectorAll('[data-setting]').forEach(el=>el.oninput=()=>{state.settings[el.dataset.setting]=el.value;save(SETTINGS_KEY,state.settings)});document.querySelectorAll('[data-profile]').forEach(el=>el.oninput=()=>{state.profile[el.dataset.profile]=el.value;save(PROFILE_KEY,state.profile)});document.querySelectorAll('[data-db]').forEach(el=>el.oninput=()=>{state.db[el.dataset.db]=el.value;save(DB_KEY,state.db)});document.querySelectorAll('[data-taskpick]').forEach(el=>el.onclick=()=>{state.draft.task=el.dataset.taskpick;state.quick=true;render()})}
function action(a){if(a==='openQuick'){resetDraft();state.quick=true;render()}if(a==='closeQuick'){resetDraft();state.quick=false;render()}if(a==='saveLog')saveLog();if(a==='copyDaily')copy(dailyText(),'日報のたねをコピーしました');if(a==='copyWeekly')copy(weeklyText(),'週報/1on1のたねをコピーしました');if(a==='copyMonthly')copy(monthlyText(),'月次ふりかえりをコピーしました');if(a==='exportJson')exportJson();if(a==='clearLogs')clearLogs();if(a==='requestNotif')requestNotif();if(a==='testNotif')showNotif('manual');if(a==='importCalendar')importCalendar();if(a==='calendarSample'){document.getElementById('calendarPaste').value='09:30 朝会\n10:00-11:00 顧客MTG\n15:00 1on1';importCalendar(true)}if(a==='connectGoogle')connectGoogleCalendar();if(a==='syncGoogleNow')syncGoogleCalendarNow();if(a==='addTask'){const v=document.getElementById('taskAdd')?.value.trim();if(v&&!state.tasks.includes(v))state.tasks.unshift(v);render()}if(a==='copySpec')copy(specText(),'P0要件をコピーしました');if(a==='copyAdminGuide')copy(adminGuideText(),'管理者メモをコピーしました');if(a==='copyDbSchema')copy(dbSchemaText(),'DBスキーマをコピーしました');if(a==='copyGoogleSetup')copy(googleSetupText(),'Google手順をコピーしました');if(a==='copyCalendarPolicy')copy(calendarPolicyText(),'保存方針をコピーしました');if(a==='copyQa')copy(qaText(),'QAメモをコピーしました');if(a==='copyColleagueTest')copy(colleagueTestText(),'同僚テスト手順をコピーしました');if(a==='copyGoogleTrouble')copy(googleTroubleText(),'Google連携トラブルメモをコピーしました');if(a==='copyAdminIntro')copy(adminIntroText(),'導入説明をコピーしました');if(a==='copySafetyPolicy')copy(safetyPolicyText(),'安全利用方針をコピーしました');if(a==='copyPilotPlan')copy(pilotPlanText(),'パイロット計画をコピーしました');if(a==='copyFaq')copy(faqText(),'FAQをコピーしました');if(a==='copyPilotFinal')copy(pilotFinalText(),'パイロット完成メモをコピーしました');if(a==='copyPilotBrief')copy(pilotBriefText(),'同僚向け説明をコピーしました');if(a==='selfTest')addSelfTestLog();if(a==='copyFirstGuide')copy(firstGuideText(),'初回ガイドをコピーしました');if(a==='completeOnboarding'){state.onboardingDone=!state.onboardingDone;toast(state.onboardingDone?'ガイドを閉じました':'ガイドを再表示します')}}
function resetDraft(){state.editId=null;state.draft={emotion:null,progress:null,task:'',memo:'',nextAction:''}}
function startEdit(id){const l=state.logs.find(x=>x.id===id);if(!l){toast('ログが見つかりません');return}state.editId=id;state.draft={emotion:l.emotion||null,progress:l.progress||null,task:l.task||'',memo:l.memo||'',nextAction:l.nextAction||''};state.quick=true;render()}
function saveLog(){state.draft.task=document.getElementById('draftTask')?.value||state.draft.task;state.draft.memo=document.getElementById('draftMemo')?.value||'';state.draft.nextAction=document.getElementById('draftNext')?.value||'';const e=state.draft.emotion,p=state.draft.progress;if(!e&&!p&&!state.draft.memo.trim()){toast('感情か進捗をひとつ選んでね');return}if(state.editId){state.logs=state.logs.map(l=>l.id===state.editId?normalizeLog({...l,emotion:e,progress:p,emotionScore:e?.score??0,progressScore:p?.score??0,task:state.draft.task,memo:state.draft.memo.trim(),nextAction:state.draft.nextAction.trim(),updatedAt:new Date().toISOString(),version:VERSION,syncStatus:l.syncStatus==='synced'?'local':l.syncStatus,includeInReport:l.includeInReport!==false}):l);resetDraft();state.quick=false;toast('ログを修正しました');return}const log={id:Date.now()+'-'+Math.random().toString(36).slice(2),createdAt:new Date().toISOString(),emotion:e,progress:p,emotionScore:e?.score??0,progressScore:p?.score??0,task:state.draft.task,memo:state.draft.memo.trim(),nextAction:state.draft.nextAction.trim(),profile:{...state.profile},version:VERSION,syncStatus:'local',includeInReport:true};state.logs.unshift(log);resetDraft();state.quick=false;toast('波を記録しました')}
function importCalendar(useExisting=false){const text=useExisting?document.getElementById('calendarPaste').value:(document.getElementById('calendarPaste')?.value||'');state.calendarPaste=text;const events=text.split('\n').map(parseCalendarLine).filter(Boolean).slice(0,20);const today=dayKey(new Date());const keep=(state.calendarEvents||[]).filter(ev=>ev.source!=='manual-calendar'&&(!ev.start||dayKey(ev.start)===today));state.calendarEvents=[...keep,...events];pruneStaleCalendarTasks();events.forEach(ev=>{if(!state.tasks.includes(ev.label))state.tasks.unshift(ev.label)});state.tasks=[...new Set(state.tasks)].slice(0,50);toast(`${events.length}件を今日のタスク候補にしました`);render()}
function loadGoogleIdentity(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const existing=document.querySelector('script[data-google-identity]');if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('google identity load failed')),{once:true});return}const sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;sc.defer=true;sc.dataset.googleIdentity='1';sc.onload=()=>resolve();sc.onerror=()=>reject(new Error('google identity load failed'));document.head.appendChild(sc)})}
function todayRangeForCalendar(){const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);return{timeMin:start.toISOString(),timeMax:end.toISOString()}}
async function fetchTodayCalendarEvents(accessToken){const {timeMin,timeMax}=todayRangeForCalendar();const params=new URLSearchParams({timeMin,timeMax,singleEvents:'true',orderBy:'startTime',maxResults:'20'});const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,{headers:{Authorization:`Bearer ${accessToken}`}});if(!res.ok){let detail='';try{const j=await res.json();detail=j.error?.message||j.error_description||''}catch{}throw new Error(`calendar fetch failed: ${res.status} ${detail}`)}const data=await res.json();return (data.items||[]).filter(ev=>ev.summary).map(ev=>{const start=ev.start?.dateTime||ev.start?.date||'';const end=ev.end?.dateTime||ev.end?.date||'';const t=start?fmtTime(start):'終日';const label=`${t} ${ev.summary}`;return{label,summary:ev.summary,start,end,source:'google-calendar'}})}
function applyGoogleCalendarEvents(events,{silent=false}={}){const today=dayKey(new Date());const manualToday=(state.calendarEvents||[]).filter(ev=>ev.source==='manual-calendar'&&(!ev.start||dayKey(ev.start)===today));state.calendarEvents=[...manualToday,...events];pruneStaleCalendarTasks();events.forEach(ev=>{if(!state.tasks.includes(ev.label))state.tasks.unshift(ev.label)});state.tasks=[...new Set(state.tasks)].slice(0,50);state.settings.calendarConnected=true;state.settings.calendarLastSyncDay=today;state.settings.calendarLastSyncAt=new Date().toISOString();if(!silent)toast(events.length?`${events.length}件の今日の予定を候補にしました`:'今日の予定は見つかりませんでした');render()}
async function syncGoogleCalendar({silent=false,prompt=''}={}){const clientId=(state.settings.googleClientId||EMBEDDED_GOOGLE_CLIENT_ID||'').trim();if(!clientId){if(!silent)toast('OAuth Client IDが未設定です');return false}try{if(!silent)toast('Googleカレンダーを確認しています');await loadGoogleIdentity();return await new Promise(resolve=>{const tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/calendar.readonly',prompt,callback:async(resp)=>{if(resp.error){console.warn(resp);if(!silent)toast(resp.error==='access_denied'?'Google認可がキャンセルされました':'Google認可でエラーが出ました');resolve(false);return}try{const events=await fetchTodayCalendarEvents(resp.access_token);applyGoogleCalendarEvents(events,{silent});if(silent&&events.length)toast(`${events.length}件の今日の予定を自動同期しました`);resolve(true)}catch(e){console.error(e);if(!silent)toast(String(e.message||e).includes('403')?'予定取得権限を確認してください':'予定取得に失敗しました');resolve(false)}}});try{tokenClient.requestAccessToken({prompt})}catch(e){console.error(e);if(!silent)toast('Google認可を開始できませんでした');resolve(false)}})}catch(e){console.error(e);if(!silent)toast(String(e.message||e).includes('origin')?'Google CloudのOrigin設定を確認してください':'Google連携の準備に失敗しました');return false}}
function connectGoogleCalendar(){return syncGoogleCalendar({silent:false,prompt:'consent'})}
function syncGoogleCalendarNow(){return syncGoogleCalendar({silent:false,prompt:''})}
function maybeAutoCalendarSync(reason='startup'){if(!state.settings.calendarAutoSync)return;const today=dayKey(new Date());const hour=new Date().getHours();const target=Number(state.settings.calendarAutoSyncHour)||8;if(hour<target&&reason!=='startup')return;if(state.settings.calendarLastSyncDay===today)return;if(!state.settings.calendarConnected)return;syncGoogleCalendar({silent:true,prompt:''})}
function copy(t,msg){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(t).then(()=>toast(msg)).catch(()=>fallbackCopy(t,msg));return}fallbackCopy(t,msg)}
function fallbackCopy(t,msg){try{const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');document.body.removeChild(ta);toast(msg)}catch{toast('コピーに失敗しました')}}
function toast(m){state.toast=m;render();setTimeout(()=>{state.toast='';render()},1800)}
function exportJson(){const blob=new Blob([JSON.stringify({profile:state.profile,logs:state.logs,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`namilog-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
function clearLogs(){if(confirm('すべてのログを削除しますか？')){state.logs=[];toast('削除しました')}}
async function setupSW(){if(!('serviceWorker'in navigator))return;try{state.sw=await navigator.serviceWorker.register('/Namilog/namilog-sw.js?v=40.2');state.sw.update?.();navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OPEN_QUICK_CHECK'){resetDraft();state.quick=true;render()}})}catch(e){}}
async function requestNotif(){if(!('Notification'in window)){toast('通知非対応です');return}const p=await Notification.requestPermission();state.permission=p;if(p==='granted'){state.settings.browserNotification=true;await showNotif('manual');toast('通知を許可しました')}else toast('通知は未許可です');render()}
async function showNotif(reason){if(!('Notification'in window)||Notification.permission!=='granted'){toast('先に通知を許可してね');return}try{const reg=state.sw||await navigator.serviceWorker.ready;await reg.showNotification('NamiLog｜今の波をそっと残そう',{body:reason==='scheduled'?'感情・進み具合・いまのタスクを、そっと記録する時間です。':'クリックするとQuick Checkを開きます。',tag:'namilog-v40-2',renotify:true,data:{url:'/Namilog/?quickCheck=1'},actions:[{action:'open',title:'記録する'},{action:'later',title:'あとで'}]});if(reason==='manual')toast('通知を出しました')}catch{new Notification('NamiLog｜今の波をそっと残そう',{body:'クリックするとQuick Checkを開きます。'});toast('通知を出しました')}}
function startTimers(){setInterval(()=>{maybeAutoCalendarSync('timer');const due=Date.now()-(state.lastReminderAt||0)>=((Number(state.settings.intervalMinutes)||120)*60000);if(!due)return;state.lastReminderAt=Date.now();if(state.settings.browserNotification)showNotif('scheduled');if(state.settings.autoPopup){resetDraft();state.quick=true;render()}},60000)}
function addSelfTestLog(){const e=emotions.find(x=>x.id==='calm'),p=progresses.find(x=>x.id==='little');state.logs.unshift(normalizeLog({id:Date.now()+'-qa',createdAt:new Date().toISOString(),emotion:e,progress:p,emotionScore:e.score,progressScore:p.score,task:'QAチェック',memo:'v38の動作確認用ログ',nextAction:'日報コピーと波グラフを確認する',profile:{...state.profile},version:VERSION,syncStatus:'local',includeInReport:true}));toast('テストログを追加しました')}
function qaText(){return `NamiLog v32 QAメモ

確認項目
- Quick Checkで保存できる
- 保存後、今日のログに出る
- Ctrl+F5後もログが残る
- 波グラフが折れ線で表示される
- 日報コピーができる
- 週報/1on1コピーができる
- 日報から外す/戻すが効く
- 編集が効く
- 通知テストが出る

結果メモ
- `}
function firstGuideText(){return `NamiLog 初回利用ガイド

1. まず「今の波を残す」を押す
2. 感情をひとつ選ぶ
3. 余裕があれば進み具合とタスクも選ぶ
4. 「この波を残す」で保存
5. 夕方に「日報をコピー」を押す
6. 週末や1on1前に「週報/1on1コピー」を押す

使い方の原則
- きれいに書かなくていい
- 感情だけでもログとして成立
- 後から編集して補足できる
- 日報に入れたくないログは外せる
- 共有は本人がコピーした範囲だけ
`}
function specText(){return `NamiLog P0 要件\n\n毎日使う画面に残すもの\n1. Quick Check入力: 感情 / 進捗 / タスク / 任意メモ\n2. やさしいリマインド通知: 通知クリックでQuick Check\n3. 今日のログ一覧\n4. モチベーションの波グラフ: 日 / 週 / 月\n5. 日報のたね\n6. 週報 / 1on1のたね\n7. 個人ログ・安全利用の明記\n\n裏側に隠すもの\n- Google OAuth Client ID\n- Supabase DB設定\n- RLS / スキーマ / 環境変数\n- 管理者導入メモ\n\n原則\n個人ログは本人だけが参照。共有は本人がコピーした範囲だけ。評価・監視用途にしない。`}
function adminGuideText(){return `NamiLog 管理者メモ\n\n管理者がやること\n1. Google OAuthアプリを1回だけ作成\n2. Calendar APIを有効化\n3. Supabaseを使う場合はAuthとRLSを設定\n4. 社員画面から技術設定を隠す\n5. 個人ログは本人だけ参照という運用を明文化\n\n社員の利用フロー\n1. NamiLogを開く\n2. 通知を許可\n3. 通知が来たらQuick Check\n4. 日報/週報/1on1のたねを必要に応じてコピー`}
function dbSchemaText(){return `create table if not exists public.namilog_logs (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null references auth.users(id) on delete cascade,\n  created_at timestamptz not null,\n  emotion_label text,\n  emotion_score numeric default 0,\n  progress_label text,\n  progress_score numeric default 0,\n  task text,\n  memo text,\n  next_action text,\n  inserted_at timestamptz default now()\n);\n\nalter table public.namilog_logs enable row level security;`}

function colleagueTestText(){return `NamiLog Googleカレンダー連携テストお願い

URL
https://antisanogile.github.io/Namilog/

目的
Googleカレンダー予定を取得して、Quick Checkのタスク候補として使えるか確認したいです。

手順
1. ChromeかEdgeでNamiLogを開く
2. 「Googleカレンダーとつなぐ」または「Google予定を取得」を押す
3. Googleの許可画面が出たら許可する
4. 今日の予定が取得されるか確認する
5. 「今の波を残す」を押す
6. Quick Checkのタスク候補に予定が出ているか確認する
7. 予定を選び、感情と進捗を選ぶ
8. 「この波を残す」で保存する
9. 今日のログに予定名つきで反映されるか確認する
10. ページ更新後もログが残るか確認する
11. 日報コピー / 週報・1on1コピーに反映されるか確認する

扱う予定情報
- 予定タイトル
- 開始時刻
- 終了時刻

扱わない情報
- 予定本文
- 参加者
- Meet URL
- 添付
- 場所

うまくいかなかったら教えてほしいこと
- どの手順で止まったか
- 表示されたエラー
- ブラウザ
- Google許可画面が出たか
- 予定取得できないのか、取得後にタスク候補へ出ないのか
`}
function googleTroubleText(){return `NamiLog Google連携 失敗時チェック

1. 許可画面が出ない
- ブラウザのポップアップブロックを確認
- Chrome/Edgeで試す
- シークレットウィンドウで再試行

2. Googleの画面でアプリがブロックされる
- OAuth同意画面がExternal Testingの場合、同僚のメールをテストユーザーに追加
- Google CloudのOAuth consent screen設定を確認

3. origin_mismatch / redirect_uri_mismatch 系
- Google CloudのAuthorized JavaScript originsに https://antisanogile.github.io が入っているか確認
- https://antisanogile.github.io/Namilog/ ではなく Origin は https://antisanogile.github.io

4. 予定取得に失敗する
- Google Calendar APIが有効化されているか確認
- スコープ calendar.readonly の許可が出ているか確認
- 今日のカレンダーに予定があるか確認

5. 予定は取得できたがタスク候補に出ない
- Ctrl + F5で最新版に更新
- 「今の波を残す」を開き直す
- 今日のタスク候補に予定が追加されているか確認
`}

function googleSetupText(){return `Googleカレンダー連携セットアップ\n1. Google Cloud ConsoleでCalendar APIを有効化\n2. OAuth Client IDを作成\n3. Authorized JavaScript originsに https://antisanogile.github.io を追加\n4. 管理者がClient IDをアプリに設定\n5. 社員は「Googleカレンダーとつなぐ」だけにする`}
function calendarPolicyText(){return `カレンダー保存方針\n保存する: 予定タイトル / 開始時刻 / 終了時刻\n保存しない: 本文 / 参加者 / Meet URL / 添付 / 場所\n目的: Quick Check時のタスク候補化。本人の振り返り補助にだけ使う。`}
const urlp=new URLSearchParams(location.search);if(urlp.get('quickCheck')==='1'){state.quick=true;history.replaceState({},'',location.pathname)}
setupSW();startTimers();render();setTimeout(()=>maybeAutoCalendarSync('startup'),900);


function adminIntroText(){return `NamiLog 導入説明メモ

NamiLogは、社員一人ひとりが自分だけの感情・進捗・タスクログを短時間で残し、日報・週報・1on1のたねに変換するセルフリフレクションツールです。

目的
- 日報を書くために一日を思い出す負担を減らす
- 仕事中のモチベーションの波を見える化する
- 週報や1on1で相談しやすい材料をつくる
- 感情を評価するのではなく、働き方の再現条件や詰まりのサインを本人が見つける

利用者の基本フロー
1. 通知または「今の波を残す」からQuick Checkを開く
2. 感情・進捗・タスクを選ぶ
3. 必要なら一言メモを足す
4. 夕方に日報のたねをコピーする
5. 週末や1on1前に週報/1on1のたねをコピーする

大事な前提
- 個人ログは本人の振り返り用
- 共有は本人がコピーした範囲だけ
- 評価・監視・査定用途には使わない
- 管理者は導入支援と環境整備を行い、個人ログを直接閲覧しない設計を守る
`}

function safetyPolicyText(){return `NamiLog 安全利用方針

1. 個人ログの扱い
NamiLogのログは、本人が自分の状態を振り返るためのものです。感情・進捗・タスク・メモは本人の内省データとして扱います。

2. 共有範囲
上長や同僚に共有されるのは、本人が日報・週報・1on1のたねとしてコピーした範囲だけです。自動共有はしません。

3. 利用禁止
以下の用途には使いません。
- 社員の感情監視
- 人事評価や査定の直接材料
- 個人ごとの稼働監視
- 本人の同意がないログ閲覧

4. Googleカレンダー連携
取得対象は予定タイトル・開始時刻・終了時刻に限定します。予定本文、参加者、Meet URL、添付、場所は原則保存しません。

5. パイロットで確認すること
- 利用者が心理的に安心して記録できるか
- 日報・週報が書きやすくなるか
- 1on1で相談材料として使えるか
- 通知頻度が負担にならないか
`}

function pilotPlanText(){return `NamiLog パイロット計画案

目的
日報・週報・1on1の準備負担を減らし、感情・進捗・タスクの波から本人が振り返りやすくなるかを検証する。

対象
- 5〜10人程度から開始
- 日報や週報を書く機会があるメンバー
- 1on1で話す材料を増やしたいメンバー

期間
- 1週間：基本動作確認
- 2〜4週間：週報・1on1での有用性確認

検証項目
1. Quick Checkは3秒〜30秒で記録できるか
2. 通知は邪魔にならないか
3. 日報コピーがそのまま使えるか
4. 週報/1on1のたねが相談材料になるか
5. Googleカレンダー予定がタスク候補として役立つか
6. 個人ログ・安全利用方針に不安がないか

成功条件
- 週3回以上ログが残る人がいる
- 日報/週報コピーを実際に使える
- 1on1で話しやすくなったという声が出る
- 評価・監視への不安が小さい

次の判断
- 通知頻度の調整
- 文面の改善
- Google連携の本格化
- 個別アカウント/DB保存への移行
`}

function faqText(){return `NamiLog FAQ

Q. 自分の感情ログは上長に見えますか？
A. 見えません。共有されるのは、本人が日報・週報・1on1のたねとしてコピーした範囲だけです。

Q. 評価に使われますか？
A. 使いません。NamiLogは評価・監視ツールではなく、本人の振り返りと日報/面談準備を助けるツールです。

Q. Googleカレンダーの何を取得しますか？
A. 予定タイトル・開始時刻・終了時刻だけを扱う方針です。予定本文、参加者、Meet URLなどは扱いません。

Q. 何を記録すればいいですか？
A. 感情、進捗、タスクを選ぶだけでOKです。余裕があれば一言メモや次の一手を足します。

Q. ネガティブなログを残しても大丈夫ですか？
A. 大丈夫です。NamiLogではネガティブな状態も「失敗」ではなく、波として扱います。日報に入れたくないログは外せます。

Q. 通知が多いときはどうすればいいですか？
A. リマインド設定で間隔を変えるか、通知をオフにできます。

Q. ログを消したり直したりできますか？
A. できます。ログは編集・削除できます。日報に入れる/外すも選べます。
`}


function pilotFinalText(){return `NamiLog v40 パイロット完成メモ

目的
NamiLogは、社員本人が自分だけの感情・進捗・タスクログを残し、日報・週報・1on1の材料に変換するセルフリフレクションアプリです。

パイロットで確認する価値
1. Quick Checkで3秒記録できるか
2. 感情・進捗・タスクが日報の材料になるか
3. モチベーションの波グラフが振り返りのきっかけになるか
4. 週報/1on1のたねが上長との対話を助けるか
5. Googleカレンダー予定がタスク候補として使えるか

安全利用の前提
- 個人ログは本人の振り返り用
- 管理者や上長が自動閲覧するものではない
- 共有は本人が日報・週報としてコピーした範囲だけ
- 評価・監視ではなく、自己理解と相談のために使う

パイロット推奨
- 期間: 1〜2週間
- 人数: 5〜20名
- 見る指標: 1日1件以上残せたか、日報/週報コピーを使えたか、1on1の話題作りに役立ったか
`}
function pilotBriefText(){return `NamiLogを試してほしいです。

NamiLogは、仕事中の感情・進捗・タスクを軽く残して、日報・週報・1on1の材料にするアプリです。

使い方はシンプルです。
1. 「今の波を残す」を押す
2. 感情と進み具合を選ぶ
3. 余裕があればタスクや一言メモを残す
4. 夕方に「日報をコピー」
5. 週末や1on1前に「週報/1on1コピー」

個人ログは本人の振り返り用です。共有されるのは、自分でコピーして貼った内容だけです。
`}
