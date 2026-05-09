
const VERSION='v24-privacy-onboarding';
const LOG_KEY='namilog.quick-check.logs.v1';
const SETTINGS_KEY='namilog.quick-check.settings.v1';
const PROFILE_KEY='namilog.profile.v1';
const TASK_KEY='namilog.tasks.v1';
const CALENDAR_KEY='namilog.calendar.events.v1';
const DB_KEY='namilog.db.settings.v1';
const AUTH_KEY='namilog.auth.settings.v1';
const emotions=[{id:'fun',emoji:'😄',label:'楽しい',score:2},{id:'good',emoji:'🙂',label:'いい感じ',score:1.5},{id:'calm',emoji:'😌',label:'穏やか',score:1},{id:'tired',emoji:'🥺',label:'少ししんどい',score:-1.5},{id:'cloudy',emoji:'☁️',label:'モヤモヤ',score:-1}];
const progresses=[{id:'great',emoji:'🚀',label:'進んだ',score:2},{id:'little',emoji:'🌱',label:'少し進んだ',score:1},{id:'scattered',emoji:'🌀',label:'散らかった',score:-1},{id:'stuck',emoji:'🧱',label:'詰まった',score:-2},{id:'pause',emoji:'⏸',label:'止まってる',score:-1.5}];
let state={logs:load(LOG_KEY,[]),settings:load(SETTINGS_KEY,{intervalMinutes:120,browserNotification:false,autoPopup:false,googleClientId:'',calendarConnected:false}),profile:load(PROFILE_KEY,{name:'',email:'',team:''}),tasks:load(TASK_KEY,['日報','定例','商談準備','資料作成','1on1','AI合宿']),calendarEvents:load(CALENDAR_KEY,[]),db:load(DB_KEY,{supabaseUrl:'',anonKey:'',table:'namilog_logs',status:'ローカル保存中'}),auth:load(AUTH_KEY,{status:'未ログイン',email:'',userId:'',syncOnSave:false,lastSync:''}),accessToken:'',tokenClient:null,supabaseClient:null,supabaseSession:null,quick:true,draft:{emotion:null,progress:null,task:'',memo:'',nextAction:''},view:'week',toast:'',modal:null,permission:getPerm(),sw:null};
function load(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function normalizeLog(log){const e=log.emotion||emotions.find(x=>x.id===log.emotionId)||null;const p=log.progress||progresses.find(x=>x.id===log.progressId)||null;return{...log,emotion:e,progress:p,emotionScore:Number.isFinite(log.emotionScore)?log.emotionScore:(e?.score??0),progressScore:Number.isFinite(log.progressScore)?log.progressScore:(p?.score??0),task:log.task||log.taskTitle||'',memo:log.memo||'',nextAction:log.nextAction||''}}
state.logs=state.logs.map(normalizeLog);save(LOG_KEY,state.logs);
function getPerm(){return !('Notification'in window)?'unsupported':Notification.permission}
function fmtTime(s){return new Date(s).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(s){return new Date(s).toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit',weekday:'short'})}
function dayKey(d){return new Date(d).toLocaleDateString('ja-JP')}
function daysAgo(n){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-n);return d}
function inDays(log,n){return new Date(log.createdAt)>=daysAgo(n-1)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function scoreLabel(x){return x>1?'高め':x>0?'やや高め':x< -1?'低め':x<0?'やや低め':'ふつう'}
function avg(arr,fn){const xs=arr.map(fn).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0}
function todayLogs(){const t=dayKey(new Date());return state.logs.filter(l=>dayKey(l.createdAt)===t)}
function periodLogs(){const n=state.view==='day'?1:state.view==='month'?30:7;return state.logs.filter(l=>inDays(l,n))}
function words(logs){const stop='これ それ あれ ため こと 今日 明日 する した です ます あり なし'.split(' ');const map={};logs.forEach(l=>(l.memo+' '+l.task+' '+l.nextAction).split(/[^\p{L}\p{N}一-龥ぁ-んァ-ヶー]+/u).filter(w=>w.length>1&&!stop.includes(w)).forEach(w=>map[w]=(map[w]||0)+1));return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8)}
function weather(logs){const s=avg(logs,l=>(l.emotionScore+l.progressScore)/2);if(!logs.length)return{icon:'🌙',text:'まだ観測前'};if(s>=1.2)return{icon:'☀️',text:'晴れ'};if(s>=.3)return{icon:'🌤️',text:'晴れときどき雲'};if(s>=-.5)return{icon:'☁️',text:'くもり'};return{icon:'🌧️',text:'雨まじり'}}
function taskStats(logs){const m={};logs.forEach(l=>{const k=l.task||'未分類';m[k]=m[k]||{n:0,e:0,p:0};m[k].n++;m[k].e+=l.emotionScore;m[k].p+=l.progressScore});return Object.entries(m).map(([task,v])=>({task,n:v.n,e:v.e/v.n,p:v.p/v.n,total:(v.e+v.p)/(2*v.n)})).sort((a,b)=>a.total-b.total)}
function calendarTaskLabel(ev){const st=ev.start?.dateTime||ev.start?.date||'';const en=ev.end?.dateTime||ev.end?.date||'';const s=st?new Date(st).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'';const e=en?new Date(en).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'';return `${s}${e?`-${e}`:''} ${ev.summary||'予定'}`.trim()}
function mergeCalendarTasks(events){const labels=events.map(calendarTaskLabel).filter(Boolean);labels.forEach(x=>{if(!state.tasks.includes(x))state.tasks.unshift(x)});state.tasks=[...new Set(state.tasks)].slice(0,40)}

function combinedScore(l){return ((Number.isFinite(l.emotionScore)?l.emotionScore:0)+(Number.isFinite(l.progressScore)?l.progressScore:0))/2}
function trendData(){
  if(state.view==='day'){
    return todayLogs().slice().reverse().map(l=>({label:fmtTime(l.createdAt),score:combinedScore(l),count:1}))
  }
  const n=state.view==='month'?30:7;
  return Array.from({length:n},(_,i)=>{const d=daysAgo(n-1-i);const key=dayKey(d);const ls=state.logs.filter(l=>dayKey(l.createdAt)===key);return{label:`${d.getMonth()+1}/${d.getDate()}`,score:ls.length?avg(ls,combinedScore):null,count:ls.length}})
}
function insightCards(logs){const w=weather(logs);const ts=taskStats(logs);const low=ts[0],high=ts[ts.length-1];const topWords=words(logs).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';const neg=logs.filter(l=>(l.emotionScore+l.progressScore)/2<-.7);return[
 {t:'こころ天気',b:`${w.icon} ${w.text}`,d:`直近の波は${scoreLabel(avg(logs,l=>(l.emotionScore+l.progressScore)/2))}。日報では「なぜその波だったか」を一言添えるとよさそう。`},
 {t:'上がりやすい要素',b:high?`${high.task}：${scoreLabel(high.total)}`:'まだ観測中',d:high?`このタスクでは波が上がりやすい傾向。得意・回復・集中のヒントとして面談で話せます。`:'もう少しログが増えると見えてきます。'},
 {t:'相談してよさそうな要素',b:low?`${low.task}：${scoreLabel(low.total)}`:'まだ観測中',d:low?`このタスクでは波が下がりやすい傾向。業務量・期待値・進め方の相談テーマにできます。`:'もう少しログが増えると見えてきます。'},
 {t:'よく出た言葉',b:topWords,d:'この週に頭を占めていたテーマ。週報の見出しや1on1の話題にできます。'},
 {t:'1on1で話せそうなこと',b:neg.length?`${neg.length}件の沈みログ`:'大きな沈みは少なめ',d:neg.length?'詰まりが続いた時間帯・タスク名・メモを見て、支援してほしいことを一つ選ぶと良さそう。':'良かった要因や再現したい進め方を話すと、次週の作戦にできます。'}
]}

function bucketLabel(dateString){const h=new Date(dateString).getHours();if(h<11)return '午前';if(h<14)return '昼前後';if(h<18)return '午後';return '夕方以降'}
function bucketStats(logs){const map={};logs.forEach(l=>{const k=bucketLabel(l.createdAt);(map[k] ||= []).push(l)});return Object.entries(map).map(([bucket,ls])=>({bucket,count:ls.length,score:avg(ls,combinedScore)})).sort((a,b)=>a.score-b.score)}
function weeklyReportCards(logs){const cards=insightCards(logs);const buckets=bucketStats(logs);const lowBucket=buckets[0],highBucket=buckets[buckets.length-1];const ts=taskStats(logs);const low=ts[0],high=ts[ts.length-1];const memoLogs=logs.filter(l=>l.memo||l.nextAction);const wordsText=words(logs).slice(0,6).map(([w,c])=>`${w}(${c})`).join('、')||'まだ少なめ';const lowLogs=logs.filter(l=>combinedScore(l)<-.5).slice(0,3);const goodLogs=logs.filter(l=>combinedScore(l)>.8).slice(0,3);return[
 {t:'今週の波の輪郭',b:cards[0]?.b||'観測中',d:`${logs.length}件のログから、感情平均${avg(logs,l=>l.emotionScore).toFixed(1)}、進捗平均${avg(logs,l=>l.progressScore).toFixed(1)}でした。`},
 {t:'上がりやすい時間帯',b:highBucket?`${highBucket.bucket}：${scoreLabel(highBucket.score)}`:'観測中',d:highBucket?'集中・回復・人との関わりなど、良かった条件を再現するヒントです。':'ログが増えると時間帯の傾向が見えます。'},
 {t:'下がりやすい時間帯',b:lowBucket?`${lowBucket.bucket}：${scoreLabel(lowBucket.score)}`:'観測中',d:lowBucket?'会議後・夕方・締切前など、負荷が高い時間帯の支援設計に使えます。':'ログが増えると時間帯の傾向が見えます。'},
 {t:'波が上がるタスク',b:high?`${high.task}：${scoreLabel(high.total)}`:'観測中',d:'得意・集中・回復につながる仕事の候補です。週報では「再現したい条件」として書けます。'},
 {t:'波が下がるタスク',b:low?`${low.task}：${scoreLabel(low.total)}`:'観測中',d:'期待値調整、相談、分解、同席依頼などの話題にしやすい要素です。'},
 {t:'今週よく出た言葉',b:wordsText,d:'その週に頭を占めていたテーマです。日報/週報の見出しや1on1の最初の一言にできます。'},
 {t:'来週の仮説',b:low?'支援条件を1つ試す':'良い条件を再現する',d:low?`「${low.task}」の進め方を小さく変えると、波が安定するかもしれません。`:'今週うまくいった時間帯やタスクを、来週も意図的につくると良さそうです。'},
 {t:'1on1で持っていくなら',b:lowLogs.length?'沈んだログを1つ選ぶ':'よかったログを1つ選ぶ',d:lowLogs.length?'原因探しより「次に必要な支援」を言語化すると話しやすいです。':'よかった要因を共有すると、任せ方・進め方の再現条件が見つかります。'}
]}
function weeklyReportText(){const logs=state.logs.filter(l=>inDays(l,7)).slice().reverse();const cards=weeklyReportCards(logs);return [`# NamiLog 週次ふりかえりレポート`, '', `対象ログ：${logs.length}件`, '', ...cards.map(c=>`## ${c.t}\n${c.b}\n${c.d}`), '', '## 代表ログ', ...(logs.length?logs.slice(-12).map(l=>`- ${fmtDate(l.createdAt)} ${fmtTime(l.createdAt)} ${l.emotion?.emoji||''}${l.emotion?.label||''} / ${l.progress?.emoji||''}${l.progress?.label||''}${l.task?`｜${l.task}`:''}${l.memo?`｜${l.memo}`:''}${l.nextAction?`｜次: ${l.nextAction}`:''}`):['- まだログがありません']), '', '## 来週試す小さな変更', '- ', '', '## 上長に相談したいこと', '- '].join('\n')}

function dailyText(){const logs=todayLogs().slice().reverse();const w=weather(logs);return [`# NamiLog 日報のたね ${new Date().toLocaleDateString('ja-JP')}`,'',`## 今日のこころ天気：${w.icon} ${w.text}`,'','## 今日の波',...(logs.length?logs.map(l=>`- ${fmtTime(l.createdAt)} ${l.emotion?.emoji||''} ${l.emotion?.label||''} / ${l.progress?.emoji||''} ${l.progress?.label||''}${l.task?`｜${l.task}`:''}${l.memo?`\n  - メモ：${l.memo}`:''}${l.nextAction?`\n  - 次：${l.nextAction}`:''}`):['- まだログがありません']),'','## 日報に書けそうなこと','- 進んだこと：','- 詰まったこと：','- 気づいた自分の状態：','- 明日の一手：'].join('\n')}
function weeklyText(){const logs=state.logs.filter(l=>inDays(l,7)).slice().reverse();const cards=insightCards(logs);return [`# NamiLog 週報・1on1のたね`,'',...cards.map(c=>`## ${c.t}\n${c.b}\n${c.d}`),'','## ログ抜粋',...(logs.length?logs.map(l=>`- ${fmtDate(l.createdAt)} ${fmtTime(l.createdAt)} ${l.emotion?.emoji||''}${l.emotion?.label||''} / ${l.progress?.emoji||''}${l.progress?.label||''} ${l.task?`｜${l.task}`:''}${l.memo?`｜${l.memo}`:''}`):['- まだログがありません']),'','## 上長に相談したいこと','- ','','## 来週ためしたいこと','- '].join('\n')}
function render(){save(LOG_KEY,state.logs);save(SETTINGS_KEY,state.settings);save(PROFILE_KEY,state.profile);save(TASK_KEY,state.tasks);save(CALENDAR_KEY,state.calendarEvents);save(DB_KEY,state.db);save(AUTH_KEY,state.auth);const logs=periodLogs();const tlogs=todayLogs();const w=weather(logs);const cards=insightCards(logs);document.getElementById('app').innerHTML=`<div class="app">
<header class="hero"><div><span class="badge">🌊 NamiLog ${VERSION}</span><h1>感情の波を、本人だけの記録として育てる。</h1><p class="lead">通知に数秒こたえるだけ。感情・進捗・Googleカレンダー予定を本人だけのログにして、日報・週報・1on1のたねまで育てます。v22では、全社展開前のパイロット運用に必要な説明・検証項目・導入手順を整理しました。</p></div><div class="heroActions"><button class="btn primary" data-act="openQuick">今の波を残す</button><button class="btn soft" data-act="copyDaily">日報コピー</button><button class="btn soft" data-act="copyWeekly">週報/1on1コピー</button></div></header>
<main class="grid"><section class="panel"><div class="sectionHead"><div><p class="eyebrow">Motivation Wave</p><h2><span class="weather">${w.icon}</span>${w.text}</h2></div><span class="count">${logs.length}件</span></div>${tabs()}${chart()}<div class="kpi"><div><b>${avg(logs,l=>l.emotionScore).toFixed(1)}</b><span class="muted">感情平均</span></div><div><b>${avg(logs,l=>l.progressScore).toFixed(1)}</b><span class="muted">進捗平均</span></div><div><b>${words(logs).length}</b><span class="muted">よく出た言葉</span></div></div><div class="sectionHead"><div><p class="eyebrow">Today</p><h2>今日のログ</h2></div><span class="count">${tlogs.length}件</span></div>${logList(tlogs)}</section>
<aside class="panel"><div class="sectionHead"><div><p class="eyebrow">Insights</p><h2>ふりかえりカード</h2></div></div><div class="insights">${cards.map(c=>`<div class="insight"><b>${esc(c.t)}｜${esc(c.b)}</b><span class="muted">${esc(c.d)}</span></div>`).join('')}</div><div class="sideActions"><button class="btn primary tiny" data-act="copyInsight">分析コピー</button><button class="btn soft tiny" data-act="copyOneonone">1on1準備コピー</button></div>${rightPanels()}</aside></main>${state.quick?quickHtml():''}${state.modal?modalHtml():''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}</div>`;bind()}
function tabs(){return`<div class="tabs">${[['day','日'],['week','週'],['month','月']].map(([id,l])=>`<button class="tab ${state.view===id?'on':''}" data-view="${id}">${l}</button>`).join('')}</div>`}
function chart(){
  const raw=trendData();
  const data=raw.filter(d=>Number.isFinite(d.score));
  if(!data.length)return`<div class="chart"><div class="emptyWave">まだ波形を描くログがありません。<br>今の波をひとつ残すと、ここに線が出ます。</div></div>`;
  const w=640,h=170,padX=42,padY=24,top=18,bottom=34;
  const innerW=w-padX*2,innerH=h-top-bottom;
  const y=s=>top+((2-Math.max(-2,Math.min(2,s)))/4)*innerH;
  const x=i=>data.length===1?w/2:padX+(innerW*i/(data.length-1));
  const pts=data.map((d,i)=>[x(i),y(d.score)]);
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area=`M${pts[0][0].toFixed(1)},${(top+innerH).toFixed(1)} ${pts.map(p=>`L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${pts[pts.length-1][0].toFixed(1)},${(top+innerH).toFixed(1)} Z`;
  const step=Math.max(1,Math.ceil(data.length/5));
  return`<div class="chart"><svg class="waveSvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="モチベーションの波グラフ">
    <defs><linearGradient id="waveStroke" x1="0" x2="1"><stop offset="0%" stop-color="#ff8a78"/><stop offset="55%" stop-color="#ef73a6"/><stop offset="100%" stop-color="#b9a7ff"/></linearGradient><linearGradient id="waveFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ef73a6" stop-opacity="0.24"/><stop offset="100%" stop-color="#fff7f0" stop-opacity="0.1"/></linearGradient></defs>
    <line class="waveGrid" x1="${padX}" x2="${w-padX}" y1="${y(2)}" y2="${y(2)}"/><line class="waveMid" x1="${padX}" x2="${w-padX}" y1="${y(0)}" y2="${y(0)}"/><line class="waveGrid" x1="${padX}" x2="${w-padX}" y1="${y(-2)}" y2="${y(-2)}"/>
    <text class="waveAxis" x="16" y="${y(2)+4}">高</text><text class="waveAxis" x="16" y="${y(0)+4}">中</text><text class="waveAxis" x="16" y="${y(-2)+4}">低</text>
    <path class="waveArea" d="${area}"/><path class="waveLine" d="${line}"/>${pts.map((p,i)=>`<circle class="wavePoint" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5"><title>${esc(data[i].label)}: ${data[i].score.toFixed(1)}</title></circle>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text class="waveLabel" x="${x(i).toFixed(1)}" y="${h-10}" text-anchor="middle">${esc(d.label)}</text>`:'').join('')}
  </svg></div>`
}
function logList(logs){if(!logs.length)return`<div class="empty"><div style="font-size:44px">🌱</div><b>まだ今日の波はありません</b><p>右下のQuick Checkから、今の状態をそっと残してみましょう。</p></div>`;return`<div class="logs">${logs.map(l=>`<article class="log"><div class="logTop"><span>${fmtTime(l.createdAt)} ${l.syncStatus==='synced'?'・DB同期済み':l.syncStatus==='error'?'・同期失敗':''}</span><button class="btn soft tiny" data-del="${l.id}">削除</button></div><div class="logMain"><span class="big">${l.emotion?.emoji||'🌊'}</span><div><h3>${esc(l.emotion?.label||'未選択')} / ${l.progress?.emoji||''} ${esc(l.progress?.label||'進捗未選択')}</h3>${l.task?`<p>タスク：${esc(l.task)}</p>`:''}${l.memo?`<p>メモ：${esc(l.memo)}</p>`:''}${l.nextAction?`<p>次：${esc(l.nextAction)}</p>`:''}</div></div></article>`).join('')}</div>`}
function rightPanels(){return`<div class="box"><h3>マイログ設定</h3><label class="setting"><span>名前</span><input data-prof="name" value="${esc(state.profile.name)}" placeholder="自分だけの表示名"></label><label class="setting"><span>メール</span><input data-prof="email" type="email" value="${esc(state.profile.email)}" placeholder="name@example.com"></label><label class="setting"><span>チーム</span><input data-prof="team" value="${esc(state.profile.team)}" placeholder="所属チーム"></label></div>
<div class="box"><h3>Googleカレンダーとつなぐ</h3><p class="muted">管理者がOAuth Client IDを1回だけ用意すれば、利用者はこのボタンから予定を取り込めます。保存するのは予定タイトルと時間だけ。</p><label class="setting"><span>OAuth Client ID</span><input data-set-text="googleClientId" value="${esc(state.settings.googleClientId||'')}" placeholder="xxxxx.apps.googleusercontent.com"></label><div class="row"><button class="btn primary tiny" data-act="connectCalendar">Googleカレンダーとつなぐ</button><button class="btn soft tiny" data-act="fetchCalendar">今日の予定を取得</button><span class="count">${state.settings.calendarConnected?'接続済み':'未接続'}</span></div>${state.calendarEvents?.length?`<div class="calendarList">${state.calendarEvents.slice(0,5).map(ev=>`<div class="calendarItem">📅 ${esc(calendarTaskLabel(ev))}</div>`).join('')}</div>`:`<p class="muted">予定を取得すると、Quick Checkのタスク候補に自動で入ります。</p>`}<div class="sideActions"><button class="btn soft tiny" data-act="copyGoogleSetup">管理者セットアップ手順コピー</button><button class="btn soft tiny" data-act="copyCalendarPolicy">保存方針コピー</button></div></div>

<div class="box"><h3>週次ふりかえりレポート</h3><p class="muted">muute風に、今週の波・時間帯・タスク・言葉の傾向を1枚のレポートにします。週報や1on1の下書きに使えます。</p><div class="insights">${weeklyReportCards(state.logs.filter(l=>inDays(l,7))).slice(0,4).map(c=>`<div class="insight"><b>${esc(c.t)}｜${esc(c.b)}</b><span class="muted">${esc(c.d)}</span></div>`).join('')}</div><div class="sideActions"><button class="btn primary tiny" data-act="copyWeeklyReport">週次レポートコピー</button><button class="btn soft tiny" data-act="copyInsight">分析カードコピー</button></div></div>

<div class="box"><h3>Googleログイン & DB同期スターター</h3><p class="muted">全社利用の本命導線です。Supabase URL / Anon Keyを入れたあと、Googleログインして本人ログだけをDBへ同期します。</p><div class="row"><button class="btn primary tiny" data-act="loginSupabase">Googleでログイン</button><button class="btn soft tiny" data-act="checkSupabaseSession">セッション確認</button><button class="btn soft tiny" data-act="logoutSupabase">ログアウト</button></div><p class="muted">状態：<span class="syncDot ${state.auth.status==='ログイン済み'?'syncOk':state.auth.status.includes('失敗')||state.auth.status.includes('未設定')?'syncNg':'syncWait'}">${esc(state.auth.status||'未ログイン')}</span></p>${state.auth.email?`<div class="codeNote">${esc(state.auth.email)} / ${esc(state.auth.userId||'')}</div>`:''}<label class="setting"><span>保存時にDBへ同期</span><input type="checkbox" data-auth="syncOnSave" ${state.auth.syncOnSave?'checked':''}></label><div class="sideActions"><button class="btn primary tiny" data-act="syncUnsyncedLogs">未同期ログをDBへ送る</button><button class="btn soft tiny" data-act="copyAuthSetup">ログイン設定メモコピー</button></div><p class="muted">DB同期にはRLS設定済みのSupabaseテーブルが必要です。まずはローカル保存を残しつつ、同期だけ試せる安全設計にしています。</p></div>
<div class="box"><h3>個別アカウントDB同期スターター</h3><p class="muted">全社利用に向けて、ローカルログをSupabaseへ移すための準備パネルです。今は本人だけが自分のログを見る前提のRLS設計をコピーできます。</p><label class="setting"><span>Supabase URL</span><input data-db="supabaseUrl" value="${esc(state.db.supabaseUrl||'')}" placeholder="https://xxxx.supabase.co"></label><label class="setting"><span>Anon Key</span><input data-db="anonKey" value="${esc(state.db.anonKey||'')}" placeholder="eyJ..." type="text"></label><label class="setting"><span>Table</span><input data-db="table" value="${esc(state.db.table||'namilog_logs')}" placeholder="namilog_logs"></label><div class="row"><button class="btn primary tiny" data-act="testDb">DB接続テスト</button><button class="btn soft tiny" data-act="copyMigrationJson">移行JSONコピー</button><span class="count">${esc(state.db.status||'ローカル保存中')}</span></div><div class="sideActions"><button class="btn soft tiny" data-act="copyDbSchema">DBスキーマコピー</button><button class="btn soft tiny" data-act="copyRlsPolicy">RLS方針コピー</button><button class="btn soft tiny" data-act="copyEnvSample">環境変数コピー</button></div><p class="muted">まずはSQLとRLSをコピーして管理者環境で作成。その後URL/Anon Keyを入れて接続確認する流れです。</p></div>

<div class="box"><h3>パイロット運用チェック</h3><p class="muted">次の段階は、少人数で「記録が続くか」「日報/週報/1on1に効くか」を検証するフェーズです。個人ログは本人のものとして扱い、共有はコピーした範囲だけにします。</p><div class="insights"><div class="insight"><b>検証1｜3秒で残せるか</b><span class="muted">通知から感情・進捗・タスクまで記録できるかを確認します。</span></div><div class="insight"><b>検証2｜日報が楽になるか</b><span class="muted">日報コピーの文章が、その日の振り返りに使えるかを確認します。</span></div><div class="insight"><b>検証3｜1on1の話題になるか</b><span class="muted">沈みやすいタスク、上がりやすい条件が面談で話せるかを見ます。</span></div></div><div class="sideActions"><button class="btn primary tiny" data-act="copyPilotPlan">パイロット計画コピー</button><button class="btn soft tiny" data-act="copyAdminGuide">管理者導入メモコピー</button></div></div>
<div class="box"><h3>やさしいリマインド</h3><div class="row"><button class="btn primary tiny" data-act="requestNotif">通知を許可</button><button class="btn soft tiny" data-act="testNotif">今ためす</button><span class="count">${state.permission==='granted'?'許可済み':state.permission==='denied'?'ブロック中':state.permission==='unsupported'?'非対応':'未許可'}</span></div><label class="setting"><span>定期的に声をかけてもらう</span><input type="checkbox" data-set="browserNotification" ${state.settings.browserNotification?'checked':''}></label><label class="setting"><span>間隔</span><select data-set="intervalMinutes"><option value="30" ${state.settings.intervalMinutes==30?'selected':''}>30分</option><option value="60" ${state.settings.intervalMinutes==60?'selected':''}>1時間</option><option value="120" ${state.settings.intervalMinutes==120?'selected':''}>2時間</option></select></label></div>
<div class="box"><h3>タスク候補</h3><div class="inputLine"><input id="taskAdd" placeholder="タスクを追加"><button class="btn soft tiny" data-act="addTask">追加</button></div><div class="taskChips">${state.tasks.map((x,i)=>`<button class="chip" data-remove-task="${i}">${esc(x)} ×</button>`).join('')}</div></div>
<div class="box"><h3>次の本番化メモ</h3><p class="muted">社員向けにはClient ID入力欄を隠し、環境変数で固定。Googleログイン + Supabase RLS + AI APIで、全社利用の個別ログ化へ進める想定。</p><button class="btn soft tiny" data-act="copySpec">v18要件コピー</button></div>`}
function quickHtml(){return`<div class="quick"><button class="close" data-act="closeQuick">×</button><p class="eyebrow">Quick Check</p><h2>今の波を残そう</h2><p>感情・進み具合・予定/タスクを選ぶと、日報と1on1のたねになります。</p><div class="choiceTitle">感情<span>いまの気持ち</span></div><div class="choices">${emotions.map(e=>`<button class="choice ${state.draft.emotion?.id===e.id?'selected':''}" data-emotion="${e.id}"><span class="emoji">${e.emoji}</span><b>${e.label}</b></button>`).join('')}</div><div class="choiceTitle">進捗<span>仕事の進み具合</span></div><div class="choices">${progresses.map(p=>`<button class="choice ${state.draft.progress?.id===p.id?'selected':''}" data-progress="${p.id}"><span class="emoji">${p.emoji}</span><b>${p.label}</b></button>`).join('')}</div><div class="inputLine"><select data-draft="task"><option value="">予定/タスクを選ぶ</option>${state.tasks.map(t=>`<option ${state.draft.task===t?'selected':''}>${esc(t)}</option>`).join('')}</select><input data-draft="memo" value="${esc(state.draft.memo)}" placeholder="30秒メモ：何が起きていた？"><input data-draft="nextAction" value="${esc(state.draft.nextAction)}" placeholder="次にやること"></div><div class="quickFooter"><button class="btn primary" data-act="saveLog">この波を残す</button><button class="btn soft" data-act="openDeep">深掘り</button></div></div>`}
function modalHtml(){return`<div class="modal"><div class="modalCard"><button class="close" data-act="closeModal">×</button><p class="eyebrow">Deep Reflection</p><h2>面談で話せる形に整える</h2><div class="inputLine"><textarea data-draft="memo" placeholder="今日の背景、感情の理由、気になっていること">${esc(state.draft.memo)}</textarea><textarea data-draft="nextAction" placeholder="相談したいこと、明日試したいこと">${esc(state.draft.nextAction)}</textarea></div><div class="sideActions"><button class="btn primary" data-act="saveLog">この波を残す</button><button class="btn soft" data-act="closeModal">閉じる</button></div></div></div>`}
function bind(){document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll('[data-emotion]').forEach(b=>b.onclick=()=>{state.draft.emotion=emotions.find(e=>e.id===b.dataset.emotion);render()});document.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>{state.draft.progress=progresses.find(p=>p.id===b.dataset.progress);render()});document.querySelectorAll('[data-draft]').forEach(i=>i.oninput=()=>{state.draft[i.dataset.draft]=i.value});document.querySelectorAll('[data-prof]').forEach(i=>i.oninput=()=>{state.profile[i.dataset.prof]=i.value;save(PROFILE_KEY,state.profile)});document.querySelectorAll('[data-set]').forEach(i=>i.onchange=()=>{const k=i.dataset.set;state.settings[k]=i.type==='checkbox'?i.checked:Number(i.value);render()});document.querySelectorAll('[data-set-text]').forEach(i=>i.oninput=()=>{state.settings[i.dataset.setText]=i.value;save(SETTINGS_KEY,state.settings)});document.querySelectorAll('[data-db]').forEach(i=>i.oninput=()=>{state.db[i.dataset.db]=i.value;save(DB_KEY,state.db)});document.querySelectorAll('[data-auth]').forEach(i=>i.onchange=()=>{state.auth[i.dataset.auth]=i.type==='checkbox'?i.checked:i.value;save(AUTH_KEY,state.auth);render()});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{state.logs=state.logs.filter(l=>l.id!==b.dataset.del);toast('削除しました')});document.querySelectorAll('[data-remove-task]').forEach(b=>b.onclick=()=>{state.tasks.splice(Number(b.dataset.removeTask),1);render()})}
function resetDraft(){state.draft={emotion:null,progress:null,task:'',memo:'',nextAction:''}}
function act(a){if(a==='openQuick'){resetDraft();state.quick=true;render()} if(a==='closeQuick'){state.quick=false;render()} if(a==='openDeep'){state.modal='deep';state.quick=false;render()} if(a==='closeModal'){state.modal=null;render()} if(a==='saveLog')saveLog(); if(a==='copyDaily')copy(dailyText(),'日報をコピーしました'); if(a==='copyWeekly'||a==='copyOneonone')copy(weeklyText(),'週報/1on1をコピーしました'); if(a==='copyInsight')copy(insightCards(periodLogs()).map(c=>`${c.t}: ${c.b}\n${c.d}`).join('\n\n'),'分析をコピーしました'); if(a==='copyWeeklyReport')copy(weeklyReportText(),'週次ふりかえりレポートをコピーしました'); if(a==='copySpec')copy(specText(),'要件メモをコピーしました'); if(a==='requestNotif')requestNotif(); if(a==='testNotif')showNotif('manual'); if(a==='connectCalendar')connectCalendar(); if(a==='fetchCalendar')fetchCalendarEvents(); if(a==='copyGoogleSetup')copy(googleSetupText(),'Google連携手順をコピーしました'); if(a==='copyCalendarPolicy')copy(calendarPolicyText(),'保存方針をコピーしました'); if(a==='testDb')testDb(); if(a==='copyDbSchema')copy(dbSchemaText(),'DBスキーマをコピーしました'); if(a==='copyRlsPolicy')copy(rlsPolicyText(),'RLS方針をコピーしました'); if(a==='copyEnvSample')copy(envSampleText(),'環境変数をコピーしました'); if(a==='copyMigrationJson')copy(migrationJson(),'移行JSONをコピーしました'); if(a==='loginSupabase')loginSupabase(); if(a==='checkSupabaseSession')checkSupabaseSession(); if(a==='logoutSupabase')logoutSupabase(); if(a==='syncUnsyncedLogs')syncUnsyncedLogs(); if(a==='copyAuthSetup')copy(authSetupText(),'ログイン設定メモをコピーしました'); if(a==='copyPilotPlan')copy(pilotPlanText(),'パイロット計画をコピーしました'); if(a==='copyAdminGuide')copy(adminGuideText(),'管理者向け導入メモをコピーしました'); if(a==='addTask'){const v=document.getElementById('taskAdd')?.value.trim();if(v&&!state.tasks.includes(v))state.tasks.push(v);render()}}
function saveLog(){const e=state.draft.emotion,p=state.draft.progress;if(!e&&!p&&!state.draft.memo.trim()){toast('感情か進捗をひとつ選んでね');return}const newLog={id:Date.now()+'-'+Math.random().toString(36).slice(2),createdAt:new Date().toISOString(),emotion:e,progress:p,emotionScore:e?.score??0,progressScore:p?.score??0,task:state.draft.task,memo:state.draft.memo.trim(),nextAction:state.draft.nextAction.trim(),profile:{...state.profile},version:VERSION,syncStatus:'local'};state.logs.unshift(newLog);resetDraft();state.quick=false;state.modal=null;toast('波を記録しました');render();if(state.auth.syncOnSave)syncLogToDb(newLog,true)}
function copy(t,msg){navigator.clipboard?.writeText(t).then(()=>toast(msg)).catch(()=>toast('コピーに失敗しました'))}
function toast(m){state.toast=m;render();setTimeout(()=>{state.toast='';render()},1800)}
async function setupSW(){if(!('serviceWorker'in navigator))return;try{state.sw=await navigator.serviceWorker.register('/Namilog/namilog-sw.js?v=24');navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OPEN_QUICK_CHECK'){resetDraft();state.quick=true;render()}})}catch(e){}}
async function requestNotif(){if(!('Notification'in window)){toast('通知非対応です');return}const p=await Notification.requestPermission();state.permission=p;if(p==='granted'){state.settings.browserNotification=true;await showNotif('manual');toast('通知を許可しました')}else toast('通知は未許可です');render()}
async function showNotif(reason){if(!('Notification'in window)||Notification.permission!=='granted'){toast('先に通知を許可してね');return}try{const reg=state.sw||await navigator.serviceWorker.ready;await reg.showNotification('NamiLog｜今の波をそっと残そう',{body:reason==='scheduled'?'感情・進み具合・いまの予定を、そっと記録する時間です。':'クリックするとQuick Checkを開きます。',tag:'namilog-v24',renotify:true,data:{url:'/Namilog/?quickCheck=1'},actions:[{action:'open',title:'記録する'},{action:'later',title:'あとで'}]});if(reason==='manual')toast('通知を出しました')}catch{new Notification('NamiLog｜今の波をそっと残そう',{body:'クリックするとQuick Checkを開きます。'});toast('通知を出しました')}}
function startTimers(){setInterval(()=>{if(state.settings.browserNotification)showNotif('scheduled');if(state.settings.autoPopup){resetDraft();state.quick=true;render()}},60000);}


function pilotPlanText(){return [`# NamiLog パイロット運用計画`, '', `## 目的`, `通知から数秒で感情・進捗・タスクを残し、日報/週報/1on1の材料化に効くかを検証する。`, '', `## 対象`, `- 5〜10名程度の小規模チーム`, `- まずは任意参加`, `- ログは本人だけが参照。共有は本人がコピーした範囲のみ`, '', `## 検証期間`, `- 1週間`, `- 朝/昼/夕方、または2時間ごとのリマインドで記録`, '', `## 見る指標`, `- 1日あたりのQuick Check記録数`, `- 日報コピーを使った回数`, `- 週報/1on1コピーを使った回数`, `- 面談で話題化できたログの有無`, `- 記録が負担にならなかったか`, '', `## 確認したい仮説`, `- 書く日報より、まず波を残すほうが継続しやすい`, `- 感情×進捗×タスクで、日報/週報の材料が自然に生まれる`, `- 1on1では「なぜ沈んだか」より「次に必要な支援」を話しやすくなる`, '', `## 注意`, `- 個人の評価用途には使わない`, `- 管理者が本人ログを自動閲覧しない`, `- 共有は本人の意思でコピーした範囲だけ`].join('\n')}
function adminGuideText(){return [`# NamiLog 管理者向け導入メモ`, '', `## 管理者が先にやること`, `1. Google CloudでOAuth Client IDを作る`, `2. Authorized JavaScript originsにNamiLogのURLを入れる`, `3. Google Calendar APIを有効化する`, `4. Supabaseを使う場合はテーブルとRLSを作る`, `5. 社員向けにはClient IDやDBキー入力を隠し、環境変数で固定する`, '', `## 社員の利用フロー`, `1. NamiLogを開く`, `2. Googleカレンダーとつなぐ`, `3. 通知を許可`, `4. 通知が来たらQuick Checkで感情・進捗・タスクを残す`, `5. 日報/週報/1on1のたねを必要に応じてコピーする`, '', `## 保存方針`, `- 予定はタイトル・開始時刻・終了時刻だけ`, `- メモと感情ログは本人の個人ログ`, `- 上長や管理者へ自動共有しない`, `- 必要な範囲だけ本人がコピーして共有`, '', `## 本番化の残タスク`, `- Google OAuthアプリの組織内公開`, `- Supabase AuthのGoogleログイン設定`, `- RLSで本人ログだけ読めることを確認`, `- AI分析APIをサーバー側で実装`, `- 管理者・上長に個人ログが見えないことを明文化`].join('\n')}

function loadGoogleScript(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const old=document.querySelector('script[data-google-identity]');if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.googleIdentity='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function ensureTokenClient(){if(!state.settings.googleClientId){toast('OAuth Client IDを入力してね');return null}await loadGoogleScript();if(!state.tokenClient){state.tokenClient=google.accounts.oauth2.initTokenClient({client_id:state.settings.googleClientId,scope:'https://www.googleapis.com/auth/calendar.readonly',callback:(res)=>{if(res?.access_token){state.accessToken=res.access_token;state.settings.calendarConnected=true;toast('Googleカレンダーとつながりました');fetchCalendarEvents(true)}else{toast('Google認可に失敗しました')}render()}})}return state.tokenClient}
async function connectCalendar(){try{const c=await ensureTokenClient();if(c)c.requestAccessToken({prompt:state.accessToken?'':'consent'})}catch(e){toast('Google連携の準備に失敗しました')}}
async function fetchCalendarEvents(silent=false){try{if(!state.accessToken){const c=await ensureTokenClient();if(c){c.requestAccessToken({prompt:''});if(!silent)toast('Google認可を確認しています');return}}const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);const params=new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'20'});const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,{headers:{Authorization:`Bearer ${state.accessToken}`}});if(res.status===401){state.accessToken='';state.settings.calendarConnected=false;toast('Google認可が切れました。もう一度つないでね');render();return}if(!res.ok)throw new Error('calendar api error');const data=await res.json();state.calendarEvents=(data.items||[]).map(ev=>({id:ev.id,summary:ev.summary||'予定',start:ev.start,end:ev.end,source:'google-calendar'}));mergeCalendarTasks(state.calendarEvents);toast(`${state.calendarEvents.length}件の予定を取り込みました`);render()}catch(e){toast('予定の取得に失敗しました')}}

async function testDb(){
  const url=(state.db.supabaseUrl||'').replace(/\/$/,'');
  const key=state.db.anonKey||'';
  const table=(state.db.table||'namilog_logs').trim();
  if(!url||!key){state.db.status='未設定';toast('Supabase URLとAnon Keyを入れてね');render();return}
  try{
    const res=await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=id&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if(res.ok){state.db.status='接続OK';toast('DB接続できました')}
    else{state.db.status=`接続NG ${res.status}`;toast('DB接続に失敗しました')}
  }catch(e){state.db.status='接続NG';toast('DB接続に失敗しました')}
  render();
}
function migrationRows(){return state.logs.map(l=>({
  created_at:l.createdAt,
  user_email:state.profile.email||l.profile?.email||'',
  user_name:state.profile.name||l.profile?.name||'',
  team:state.profile.team||l.profile?.team||'',
  emotion_id:l.emotion?.id||'',emotion_label:l.emotion?.label||'',emotion_score:l.emotionScore??0,
  progress_id:l.progress?.id||'',progress_label:l.progress?.label||'',progress_score:l.progressScore??0,
  task:l.task||'',memo:l.memo||'',next_action:l.nextAction||'',source_version:l.version||VERSION
}))}
function migrationJson(){return JSON.stringify({profile:state.profile,exportedAt:new Date().toISOString(),targetTable:state.db.table||'namilog_logs',logs:migrationRows()},null,2)}
function dbSchemaText(){return `-- NamiLog v20 Supabase schema starter
-- 目的: 社員それぞれが本人ログだけを保存・参照できる土台

create table if not exists public.namilog_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  user_email text,
  user_name text,
  team text,
  emotion_id text,
  emotion_label text,
  emotion_score numeric default 0,
  progress_id text,
  progress_label text,
  progress_score numeric default 0,
  task text,
  memo text,
  next_action text,
  source_version text,
  inserted_at timestamptz default now()
);

create index if not exists namilog_logs_user_created_idx
on public.namilog_logs (user_id, created_at desc);

alter table public.namilog_logs enable row level security;
`}
function rlsPolicyText(){return `-- NamiLog RLS policy starter
-- 本人だけが自分のログを読める/書ける設計

create policy "read own namilog logs"
on public.namilog_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "insert own namilog logs"
on public.namilog_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "update own namilog logs"
on public.namilog_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own namilog logs"
on public.namilog_logs
for delete
to authenticated
using (auth.uid() = user_id);

-- 運用原則:
-- 管理者・上長に自動共有しない。
-- 共有は本人が日報/週報/1on1のたねをコピーして必要範囲だけ渡す。
`}
function envSampleText(){return `# NamiLog production env sample
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# 社員向け画面では、これらをコード/環境変数に固定し、個人に入力させない設計を推奨。
`}


function loadSupabaseScript(){return new Promise((resolve,reject)=>{if(window.supabase)return resolve();const old=document.querySelector('script[data-supabase]');if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.async=true;s.dataset.supabase='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function getSupabaseClient(){const url=(state.db.supabaseUrl||'').replace(/\/$/,'');const key=state.db.anonKey||'';if(!url||!key){state.auth.status='Supabase未設定';toast('Supabase URLとAnon Keyを先に入れてね');render();return null}await loadSupabaseScript();if(!state.supabaseClient){state.supabaseClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}return state.supabaseClient}
async function checkSupabaseSession(){try{const client=await getSupabaseClient();if(!client)return;const {data,error}=await client.auth.getSession();if(error)throw error;state.supabaseSession=data.session||null;if(state.supabaseSession){state.auth.status='ログイン済み';state.auth.email=state.supabaseSession.user?.email||'';state.auth.userId=state.supabaseSession.user?.id||'';toast('ログイン確認できました')}else{state.auth.status='未ログイン';state.auth.email='';state.auth.userId='';toast('まだログインしていません')}render()}catch(e){state.auth.status='セッション確認失敗';toast('セッション確認に失敗しました');render()}}
async function loginSupabase(){try{const client=await getSupabaseClient();if(!client)return;const redirectTo=window.location.origin+window.location.pathname;const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error}catch(e){state.auth.status='ログイン開始失敗';toast('Googleログインを開始できませんでした');render()}}
async function logoutSupabase(){try{const client=await getSupabaseClient();if(client)await client.auth.signOut();state.supabaseSession=null;state.auth={...state.auth,status:'未ログイン',email:'',userId:''};toast('ログアウトしました');render()}catch(e){toast('ログアウトに失敗しました')}}
function logPayload(log,session){return{user_id:session.user.id,created_at:log.createdAt,user_email:state.profile.email||session.user.email||log.profile?.email||'',user_name:state.profile.name||log.profile?.name||'',team:state.profile.team||log.profile?.team||'',emotion_id:log.emotion?.id||'',emotion_label:log.emotion?.label||'',emotion_score:log.emotionScore??0,progress_id:log.progress?.id||'',progress_label:log.progress?.label||'',progress_score:log.progressScore??0,task:log.task||'',memo:log.memo||'',next_action:log.nextAction||'',source_version:log.version||VERSION}}
async function syncLogToDb(log,quiet=false){try{const client=await getSupabaseClient();if(!client)return false;let {data,error}=await client.auth.getSession();if(error)throw error;const session=data.session;if(!session){state.auth.status='未ログイン';if(!quiet)toast('先にGoogleログインしてね');render();return false}state.supabaseSession=session;state.auth.status='ログイン済み';state.auth.email=session.user?.email||'';state.auth.userId=session.user?.id||'';const table=(state.db.table||'namilog_logs').trim();const url=(state.db.supabaseUrl||'').replace(/\/$/,'');const res=await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`,{method:'POST',headers:{apikey:state.db.anonKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(logPayload(log,session))});if(!res.ok)throw new Error(`DB insert ${res.status}`);const rows=await res.json().catch(()=>[]);log.syncStatus='synced';log.remoteId=Array.isArray(rows)?rows[0]?.id:rows?.id;state.auth.lastSync=new Date().toISOString();save(LOG_KEY,state.logs);save(AUTH_KEY,state.auth);if(!quiet)toast('DBへ同期しました');render();return true}catch(e){log.syncStatus='error';state.auth.status='同期失敗';save(LOG_KEY,state.logs);if(!quiet)toast('DB同期に失敗しました');render();return false}}
async function syncUnsyncedLogs(){const targets=state.logs.filter(l=>l.syncStatus!=='synced');if(!targets.length){toast('未同期ログはありません');return}let ok=0;for(const log of targets){const done=await syncLogToDb(log,true);if(done)ok++}state.auth.status=ok?`同期 ${ok}/${targets.length} 件完了`:'同期失敗';toast(`${ok}/${targets.length}件をDBへ同期しました`);render()}
function authSetupText(){return`NamiLog v20 Googleログイン & DB同期メモ

目的:
社員ごとにGoogleログインし、本人ログだけをSupabaseへ保存・参照する。

管理者の準備:
1. Supabaseプロジェクトを作成
2. Authentication > Providers でGoogleを有効化
3. Google Cloud側でOAuth Client ID/Secretを作成し、SupabaseのCallback URLを登録
4. NamiLogのSupabase URL / Anon Keyを設定
5. DBスキーマとRLS方針を適用
6. 社員はGoogleでログインして、保存時DB同期をONにする

運用原則:
- 個人ログは本人だけ参照
- 上長/管理者へ自動共有しない
- 日報/週報/1on1のたねは本人が必要分だけコピーして共有

次の実装候補:
- 起動時にDBから本人ログを取得
- ローカルとDBの重複排除
- 管理者がURL/Anon Keyを環境変数で固定して入力欄を隠す
`}

function googleSetupText(){return`NamiLog Googleカレンダー連携 管理者セットアップ

1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. Google Auth PlatformでOAuth同意画面を設定
   - 全社利用ならAudienceはInternalを推奨
4. ClientsでWeb applicationのOAuth Client IDを作成
5. Authorized JavaScript originsに以下を追加
   - https://antisanogile.github.io
   - http://localhost:5173（ローカル開発用）
6. 発行されたClient IDをNamiLogに設定
7. 社員は「Googleカレンダーとつなぐ」を押すだけ

取得・保存する情報:
- 予定タイトル
- 開始時刻
- 終了時刻

保存しない情報:
- 予定本文
- 参加者
- Meet URL
- 添付ファイル
`}

function calendarPolicyText(){return`NamiLog カレンダー保存方針

目的:
Quick Check時に「何をしていたか」を選びやすくし、感情・進捗・タスクの関係を日報/週報/1on1に使える形にする。

保存対象:
- 予定タイトル
- 開始時刻
- 終了時刻
- Google Calendar由来であること

保存しない:
- 予定本文
- 参加者
- Google Meet URL
- 場所
- 添付ファイル
- 外部共有用の内容

運用思想:
予定は本人の振り返り補助にだけ使う。上長や管理者へ自動共有しない。共有が必要な場合は、本人が日報/週報/1on1のたねをコピーして必要分だけ渡す。
`}
function specText(){return`NamiLog v20 要件
- 入力: 感情 / 進捗 / Googleカレンダー予定 / タスク / 30秒メモ / 次アクション
- 出力: 日報のたね / 週報のたね / 1on1準備 / モチベーショングラフ
- Google連携: 管理者がOAuth Client IDを1回発行し、社員は「Googleカレンダーとつなぐ」だけにする
- 保存方針: 予定タイトル・開始時刻・終了時刻だけを扱い、本文/参加者/Meet URLは保存しない
- 分析: こころ天気、よく出た言葉、タスク別の波、相談テーマ
- 本番化: Googleログイン、Supabase RLS、AI API接続
- v19追加: Supabase URL/Anon Key/Tableの接続テスト、DBスキーマ/RLS/移行JSONコピー
- v20追加: Supabase Googleログイン、セッション確認、保存時DB同期、未同期ログ送信
- 原則: 個人ログは本人だけ閲覧。共有は本人が必要な内容だけコピー。`}
const urlp=new URLSearchParams(location.search);if(urlp.get('quickCheck')==='1'){state.quick=true;history.replaceState({},'',location.pathname)}setupSW();startTimers();render();checkSupabaseSession();
