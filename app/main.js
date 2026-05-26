const VERSION='v40.8-five-choice-mvp';
const LOG_KEY='namilog.quick-check.logs.v1';
const SETTINGS_KEY='namilog.quick-check.settings.v1';
const TASK_KEY='namilog.tasks.v1';
const PROFILE_KEY='namilog.profile.v1';
const GOOGLE_CLIENT_ID='962194635793-8oepjpgi0hch239o8ie5cief8ccn2jrl.apps.googleusercontent.com';
let tokenClient=null;
const $=s=>document.querySelector(s);
const app=$('#app');
const todayKey=()=>new Date().toLocaleDateString('ja-JP');
const iso=d=>new Date(d).toISOString();
const fmtTime=d=>new Date(d).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
const fmtDate=d=>new Date(d).toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
const safeParse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const load=(k,f)=>safeParse(localStorage.getItem(k),f);
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const uid=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dayStart=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const daysAgo=n=>{const x=dayStart(new Date());x.setDate(x.getDate()-n);return x};
const primaryChoices=[
  {id:'fun',emoji:'😄',label:'楽しい',score:2,detail:'楽しい'},
  {id:'good',emoji:'🙂',label:'いい感じ',score:1,detail:'いい感じ'},
  {id:'calm',emoji:'😌',label:'穏やか',score:0,detail:'穏やか'},
  {id:'tired',emoji:'🥺',label:'少ししんどい',score:-1,detail:'少ししんどい'},
  {id:'cloudy',emoji:'☁️',label:'モヤモヤ',score:-2,detail:'モヤモヤ'}
];
const progressChoices=[
  {id:'go',emoji:'🚀',label:'進んだ',score:2,detail:'進んだ'},
  {id:'steady',emoji:'🌱',label:'少し進んだ',score:1,detail:'少し進んだ'},
  {id:'busy',emoji:'🏃',label:'バタつき',score:0,detail:'バタつき'},
  {id:'stuck',emoji:'🧱',label:'詰まった',score:-1,detail:'詰まった'},
  {id:'stop',emoji:'⏸️',label:'止まった',score:-2,detail:'止まった'}
];
const detailEmotions=primaryChoices;
const defaultTasks=['日報','定例','商談準備','資料作成','1on1','AI合宿'];
let state={
  logs: migrateLogs(load(LOG_KEY,[])),
  settings:{reminder:false,interval:120,autoCalendar:true,calendarSyncHour:8, ...load(SETTINGS_KEY,{})},
  profile:{name:'',email:'',team:'',...load(PROFILE_KEY,{})},
  tasks: load(TASK_KEY,defaultTasks),
  tab:'day', quick:false, toast:'', onboarding:localStorage.getItem('namilog.onboarding.closed.v1')!=='1',
  draft:{mood:null,progress:null,task:'',memo:'',next:''}
};
function migrateLogs(logs){return (Array.isArray(logs)?logs:[]).map(l=>{
 const emotion=l.emotion||{}; const progress=l.progress||{};
 const eScore=Number.isFinite(l.emotionScore)?l.emotionScore:(Number.isFinite(emotion.score)?emotion.score:scoreByLabel(emotion.label||l.moodLabel));
 const pScore=Number.isFinite(l.progressScore)?l.progressScore:(Number.isFinite(progress.score)?progress.score:progressByLabel(progress.label||l.progressLabel));
 return {...l,id:l.id||uid(),createdAt:l.createdAt||new Date().toISOString(),emotion:{emoji:emotion.emoji||l.moodEmoji||emojiByScore(eScore),label:emotion.label||l.moodLabel||labelByScore(eScore),score:eScore},progress: progress.label||l.progressLabel?{emoji:progress.emoji||progressEmojiByScore(pScore),label:progress.label||l.progressLabel||progressByScore(pScore),score:pScore}:null,emotionScore:eScore,progressScore:pScore,includeInReport:l.includeInReport!==false, task:l.task||l.taskTitle||''};
});}
function scoreByLabel(s=''){if(/楽|上/.test(s))return 2;if(/いい/.test(s))return 1;if(/穏|ふつう|まあ/.test(s))return 0;if(/しんど/.test(s))return -1;if(/モヤ|下/.test(s))return -2;return 0}
function progressByLabel(s=''){if(/進んだ|順調/.test(s))return 2;if(/少し|ぼち/.test(s))return 1;if(/バタ|散/.test(s))return 0;if(/詰/.test(s))return -1;if(/止/.test(s))return -2;return 0}
function emojiByScore(s){return s>=2?'😄':s>=1?'🙂':s<=-2?'☁️':s<=-1?'🥺':'😌'}function labelByScore(s){return s>=2?'楽しい':s>=1?'いい感じ':s<=-2?'モヤモヤ':s<=-1?'少ししんどい':'穏やか'}function progressEmojiByScore(s){return s>=2?'🚀':s>=1?'🌱':s<=-2?'⏸️':s<=-1?'🧱':'🏃'}function progressByScore(s){return s>=2?'進んだ':s>=1?'少し進んだ':s<=-2?'止まった':s<=-1?'詰まった':'バタつき'}
function persist(){save(LOG_KEY,state.logs);save(SETTINGS_KEY,state.settings);save(TASK_KEY,state.tasks);save(PROFILE_KEY,state.profile)}
function toast(msg){state.toast=msg;render();setTimeout(()=>{state.toast='';render()},2100)}
function openQuick(){state.draft={mood:null,progress:null,task:'',memo:'',next:''};state.quick=true;render()}
function logsInRange(){const now=dayStart(new Date());let start=now;if(state.tab==='week')start=daysAgo(6);if(state.tab==='month')start=daysAgo(29);return state.logs.filter(l=>dayStart(l.createdAt)>=start).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));}
function todayLogs(){return state.logs.filter(l=>new Date(l.createdAt).toLocaleDateString('ja-JP')===todayKey()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}
function reportLogs(){return todayLogs().filter(l=>l.includeInReport!==false)}
function avg(arr,k){const vals=arr.map(x=>Number(x[k])).filter(Number.isFinite);return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length):0}
function topWord(logs){const counts={};logs.forEach(l=>`${l.task||''} ${l.memo||''} ${l.nextAction||l.next||''}`.split(/[\s、。・\/]+/).forEach(w=>{if(w&&w.length>1)counts[w]=(counts[w]||0)+1}));return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.join('(')+')'||'まだ少なめ'}
function weather(logs){const a=avg(logs,'emotionScore');return a>=1?'☀️ 晴れ':a<=-1?'☁️ くもり':'🌤️ 晴れときどき雲'}
function taskTendency(logs,dir='up'){const map={};logs.forEach(l=>{if(!l.task)return;(map[l.task]??=[]).push((l.emotionScore||0)+(l.progressScore||0)/2)});let list=Object.entries(map).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]);list.sort((a,b)=>dir==='up'?b[1]-a[1]:a[1]-b[1]);return list[0]?.[0]||'まだ未分類'}
function dailyReport(){const logs=reportLogs();if(!logs.length)return '# NamiLog 日報のたね\n\n今日はまだ日報対象のログがありません。';const up=logs.filter(l=>(l.emotionScore||0)+(l.progressScore||0)>1);const stuck=logs.filter(l=>(l.progressScore||0)<0 || (l.emotionScore||0)<0);return `# NamiLog 日報のたね ${fmtDate(new Date())}\n\n## 今日のこころ天気\n- ${weather(logs)}\n\n## 今日の波\n${logs.slice().reverse().map(l=>`- ${fmtTime(l.createdAt)} ${l.emotion?.emoji||''} ${l.emotion?.label||''}${l.progress?` / ${l.progress.emoji} ${l.progress.label}`:''}${l.task?`｜${l.task}`:''}${l.memo?`｜${l.memo}`:''}`).join('\n')}\n\n## 今日進んだこと\n${up.length?up.map(l=>`- ${l.task||'未分類'}：${l.memo||l.progress?.label||'前進ログあり'}`).join('\n'):'- まだ短い記録です。進んだ瞬間を1つ残せると書きやすくなります。'}\n\n## 詰まったこと・気になったこと\n${stuck.length?stuck.map(l=>`- ${l.task||'未分類'}：${l.memo||l.emotion?.label||'少し負荷が出ていました'}`).join('\n'):'- 大きな詰まりは目立ちませんでした。'}\n\n## 明日の一手\n${logs.find(l=>l.nextAction||l.next)?.nextAction||logs.find(l=>l.nextAction||l.next)?.next||'- 今日波が上がったタスクを、明日も最初に少し進める。'}\n`}
function weeklyReport(){const logs=state.logs.filter(l=>dayStart(l.createdAt)>=daysAgo(6)&&l.includeInReport!==false);if(!logs.length)return 'まだ週報に使えるログがありません。';return `# NamiLog 週報/1on1のたね\n\n## 今週の波\n- こころ天気：${weather(logs)}\n- 感情平均：${avg(logs,'emotionScore').toFixed(1)}\n- 進捗平均：${avg(logs,'progressScore').toFixed(1)}\n\n## 進みやすかった条件\n- ${taskTendency(logs,'up')} のとき、比較的よい波が出ていました。\n\n## 詰まりやすかった条件\n- ${taskTendency(logs,'down')} のとき、少し負荷が出やすい可能性があります。\n\n## 1on1で話せそうなこと\n- 詰まりが出たタスクについて、何があると進みやすいか相談できそうです。\n- 波が上がった条件を、来週も再現できるか確認するとよさそうです。\n\n## 来週の仮説\n- 予定の前後に5分だけ整理時間を置く。\n- タスクの完了条件を先に確認する。`}
function buildWave(){const logs=logsInRange(); const w=620,h=190,p=26; if(!logs.length)return `<svg viewBox="0 0 ${w} ${h}"><text x="36" y="100" fill="#9b817d">まだログがありません</text></svg>`; const groups=[]; if(state.tab==='day'){logs.forEach(l=>groups.push({label:fmtTime(l.createdAt),score:(l.emotionScore||0)+(l.progressScore||0)/2}))}else{const map={};logs.forEach(l=>{const k=new Date(l.createdAt).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'});(map[k]??=[]).push((l.emotionScore||0)+(l.progressScore||0)/2)});Object.entries(map).forEach(([k,v])=>groups.push({label:k,score:v.reduce((a,b)=>a+b,0)/v.length}))} const min=-3,max=3; const x=i=>p+(groups.length===1?(w-2*p)/2:i*(w-2*p)/(groups.length-1)); const y=s=>h-p-((s-min)/(max-min))*(h-2*p); let path=groups.map((g,i)=>`${i?'L':'M'} ${x(i)} ${y(g.score)}`).join(' '); let pts=groups.map((g,i)=>`<circle cx="${x(i)}" cy="${y(g.score)}" r="5" fill="#fff" stroke="#ef6aa8" stroke-width="4"/>`).join(''); let labels=groups.map((g,i)=>`<text x="${x(i)}" y="${h-6}" text-anchor="middle" fill="#a08b88" font-size="11">${g.label}</text>`).join('');return `<svg viewBox="0 0 ${w} ${h}" width="100%"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ff8673"/><stop offset=".6" stop-color="#ef6aa8"/><stop offset="1" stop-color="#a68cff"/></linearGradient></defs><line x1="${p}" x2="${w-p}" y1="${y(2)}" y2="${y(2)}" stroke="#f1ded7"/><line x1="${p}" x2="${w-p}" y1="${y(0)}" y2="${y(0)}" stroke="#edd8df" stroke-dasharray="6 8"/><line x1="${p}" x2="${w-p}" y1="${y(-2)}" y2="${y(-2)}" stroke="#f1ded7"/><text x="${p}" y="${y(2)-8}" fill="#b69c99" font-size="11">高</text><text x="${p}" y="${y(0)-8}" fill="#b69c99" font-size="11">中</text><text x="${p}" y="${y(-2)-8}" fill="#b69c99" font-size="11">低</text><path d="${path}" fill="none" stroke="url(#g)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${pts}${labels}</svg>`}
function render(){persist();const tl=todayLogs();const range=logsInRange();app.innerHTML=`<div class="app"><section class="hero"><div><span class="tag">NAMILOG ${VERSION}</span><h1>NamiLog</h1><p>仕事の波を3秒で残し、日報のたねに変える。まずは1日1回、1件だけでOK。</p></div><div class="actions"><button class="primary" data-act="quick">今の波を残す</button><button class="secondary" data-act="copyDaily">日報をコピー</button></div></section>${state.onboarding?onboardingHtml():''}<main class="grid"><section><div class="panel"><div class="head"><div><p class="eyebrow">Motivation Wave</p><h2>モチベーションの波</h2></div><span class="pill">${range.length}件</span></div><div class="tabs"><button class="tab ${state.tab==='day'?'active':''}" data-tab="day">日</button><button class="tab ${state.tab==='week'?'active':''}" data-tab="week">週</button><button class="tab ${state.tab==='month'?'active':''}" data-tab="month">月</button></div><div class="wavebox">${buildWave()}</div><div class="stats"><div class="stat"><b>${avg(range,'emotionScore').toFixed(1)}</b><span>感情平均</span></div><div class="stat"><b>${avg(range,'progressScore').toFixed(1)}</b><span>進捗平均</span></div><div class="stat"><b>${topWord(range)}</b><span>よく出た言葉</span></div></div><div class="insightgrid"><div class="mini"><b>こころ天気：${weather(range)}</b>日報では「なぜその波だったか」を一言添えると使いやすいです。</div><div class="mini"><b>上がりやすいタスク：${taskTendency(range,'up')}</b>良かった条件や再現したい進め方のヒントです。</div><div class="mini"><b>下がりやすいタスク：${taskTendency(range,'down')}</b>支援や相談のきっかけにできます。</div><div class="mini"><b>1on1で話せそうなこと</b>詰まりが続いたタスクを1つ選ぶと話しやすいです。</div></div></div><div class="panel" style="margin-top:18px"><div class="head"><div><p class="eyebrow">Today</p><h2>今日のログ</h2></div><span class="pill">${tl.filter(l=>l.includeInReport!==false).length}/${tl.length}件を日報へ</span></div><div class="logs">${tl.length?tl.map(logHtml).join(''):'<div class="empty">まだ今日のログはありません。まずは「今の波を残す」から1件だけ。</div>'}</div></div></section><aside><div class="panel"><p class="eyebrow">Daily Reflection</p><h2>日報のたね</h2><textarea class="report" readonly>${dailyReport()}</textarea><div class="actions" style="margin-top:10px;justify-content:flex-start"><button class="primary" data-act="copyDaily">コピー</button><button class="secondary" data-act="copyWeekly">週報/1on1コピー</button><button class="secondary" data-act="export">JSON出力</button></div></div><div class="panel" style="margin-top:18px"><p class="eyebrow">Gentle Reminder</p><h2>やさしいリマインド</h2><div class="settings"><div class="row"><label>定期的に声をかけてもらう</label><input type="checkbox" data-set="reminder" ${state.settings.reminder?'checked':''}></div><div class="row"><label>間隔</label><select data-set="interval"><option value="60" ${state.settings.interval==60?'selected':''}>1時間</option><option value="120" ${state.settings.interval==120?'selected':''}>2時間</option><option value="180" ${state.settings.interval==180?'selected':''}>3時間</option></select></div><button class="secondary" data-act="notify">テスト通知</button></div></div><div class="panel" style="margin-top:18px"><p class="eyebrow">Setup</p><h2>毎日使う設定</h2><div class="settings"><div class="row"><label>名前</label><input data-profile="name" value="${escapeHtml(state.profile.name)}" placeholder="自分だけの表示名"></div><div class="row"><label>チーム</label><input data-profile="team" value="${escapeHtml(state.profile.team)}" placeholder="所属チーム"></div><div class="row"><label>毎朝予定を自動同期</label><input type="checkbox" data-set="autoCalendar" ${state.settings.autoCalendar?'checked':''}></div><button class="secondary" data-act="google">Google予定を取得</button></div><details class="details admin"><summary>管理者・開発者メニューを開く</summary><div class="mini" style="margin-top:12px">MVPでは通常ユーザーに見せない領域です。日報を義務ではなく、本人の振り返りと上長の支援につなげるための運用メモを置いています。</div><div class="actions" style="justify-content:flex-start"><button class="secondary" data-act="survey">ユーザーアンケートコピー</button><button class="secondary" data-act="culture">日報文化メモコピー</button><button class="secondary" data-act="manager">上長向け読む作法コピー</button><button class="secondary" data-act="employee">社員向け説明コピー</button><button class="secondary" data-act="reportTemplate">日報/週報テンプレコピー</button><button class="secondary" data-act="pilotCulture">日報文化パイロット案コピー</button><button class="secondary" data-act="qaMemo">MVP QA手順コピー</button><button class="primary" data-act="userTest">ユーザーテスト案内コピー</button><button class="secondary" data-act="feedback">アンケート項目コピー</button><button class="secondary" data-act="limits">既知の制約コピー</button></div><div class="qaBox"><h3>MVP最終QA</h3><ol><li>今の波を残す → 3択で保存できる</li><li>今日のログに反映される</li><li>編集 / 削除 / 日報から外す が動く</li><li>日報コピーに反映される</li><li>週報/1on1コピーに反映される</li><li>日/週/月の波グラフが崩れない</li><li>通知テストが出る</li><li>ページ更新後もログが残る</li></ol></div><div class="qaBox"><h3>v40.7 ユーザーテスト配布版</h3><p>明日以降は新機能追加ではなく、ユーザーの声をもとに改善します。まずは「1件記録できるか」「日報のたねが使えるか」「Gカレ候補が便利か」を確認します。</p><ul><li>試してほしいこと：今の波を1件残す</li><li>見たいこと：日報のたねが役に立つか</li><li>集めたい声：追加/削除/変更したい機能</li></ul></div></details></div></aside></main>${state.quick?quickHtml():''}${state.toast?`<div class="toast">${state.toast}</div>`:''}</div>`;bind();}
function onboardingHtml(){return `<section class="panel" style="margin-top:18px"><div class="head"><div><p class="eyebrow">First 3 minutes</p><h2>はじめての3分セットアップ</h2></div><button class="tiny" data-act="closeGuide">このガイドを閉じる</button></div><div class="insightgrid"><div class="mini"><b>1. 今の波を残す</b>5段階の感情から選ぶだけでOK。</div><div class="mini"><b>2. 日報をコピー</b>今日のログが日報のたねになります。</div><div class="mini"><b>3. 通知を許可</b>余裕があれば、やさしいリマインドを使えます。</div><div class="mini"><b>4. 予定をつなぐ</b>Google予定はタスク候補としてだけ使います。</div></div><p style="color:#7e6264;line-height:1.8">個人ログは本人の振り返り用です。共有は、本人が日報・週報としてコピーした範囲だけ。</p></section>`}
function logHtml(l){return `<article class="log"><div class="emoji">${l.emotion?.emoji||'🙂'}</div><div class="logmain"><div class="time">${fmtTime(l.createdAt)}</div><h3>${l.emotion?.label||'ふつう'}${l.progress?` / ${l.progress.emoji} ${l.progress.label}`:''}</h3>${l.task?`<p>タスク：${escapeHtml(l.task)}</p>`:''}${l.memo?`<p>${escapeHtml(l.memo)}</p>`:''}${l.nextAction?`<p>次：${escapeHtml(l.nextAction)}</p>`:''}<p style="font-size:12px;color:#9b817d">${l.includeInReport===false?'日報から外しています':'日報対象'} / ローカル保存</p></div><div class="logactions"><button class="tiny" data-toggle-report="${l.id}">${l.includeInReport===false?'日報に戻す':'日報から外す'}</button><button class="tiny" data-edit="${l.id}">編集</button><button class="tiny" data-del="${l.id}">削除</button></div></article>`}
function quickHtml(){const d=state.draft;return `<div class="quick"><button class="close" data-act="closeQuick">×</button><p class="eyebrow">Quick Check</p><h2>今の波を残す</h2><p>5段階で記録できます。余裕があればタスクやメモも。</p><div class="choicegroup"><h3>今の気分は？</h3><div class="choices">${primaryChoices.map(c=>`<button class="choice ${d.mood?.id===c.id?'active':''}" data-mood="${c.id}"><span>${c.emoji}</span>${c.label}</button>`).join('')}</div></div><div class="choicegroup"><h3>進み具合は？</h3><div class="choices">${progressChoices.map(c=>`<button class="choice ${d.progress?.id===c.id?'active':''}" data-progress="${c.id}"><span>${c.emoji}</span>${c.label}</button>`).join('')}</div></div><select data-draft="task"><option value="">タスクを選ぶ</option>${state.tasks.map(t=>`<option ${d.task===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select><input data-draft="memo" value="${escapeHtml(d.memo)}" placeholder="30秒メモ 任意"><input data-draft="next" value="${escapeHtml(d.next)}" placeholder="次の一手 任意"><details class="details"><summary>補足して記録する</summary><div class="choices" style="margin-top:10px">${detailEmotions.map(c=>`<button class="choice" data-detail-mood="${c.id}"><span>${c.emoji}</span>${c.label}</button>`).join('')}</div></details><div class="quickfooter"><button class="primary" data-act="saveQuick">この波を残す</button><button class="secondary" data-act="closeQuick">あとで</button></div></div>`}
function bind(){document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});document.querySelectorAll('[data-mood]').forEach(b=>b.onclick=()=>{state.draft.mood=primaryChoices.find(c=>c.id===b.dataset.mood);render()});document.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>{state.draft.progress=progressChoices.find(c=>c.id===b.dataset.progress);render()});document.querySelectorAll('[data-detail-mood]').forEach(b=>b.onclick=()=>{const c=detailEmotions.find(x=>x.id===b.dataset.detailMood);state.draft.mood={id:c.id,emoji:c.emoji,label:c.label,score:c.score,detail:c.label};render()});document.querySelectorAll('[data-draft]').forEach(i=>i.oninput=()=>{state.draft[i.dataset.draft]=i.value});document.querySelectorAll('[data-set]').forEach(i=>i.onchange=()=>{state.settings[i.dataset.set]=i.type==='checkbox'?i.checked:Number(i.value)||i.value;render()});document.querySelectorAll('[data-profile]').forEach(i=>i.oninput=()=>{state.profile[i.dataset.profile]=i.value;persist()});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{state.logs=state.logs.filter(l=>l.id!==b.dataset.del);render()});document.querySelectorAll('[data-toggle-report]').forEach(b=>b.onclick=()=>{const l=state.logs.find(x=>x.id===b.dataset.toggleReport);if(l)l.includeInReport=l.includeInReport===false;render()});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editLog(b.dataset.edit));}
function act(a){if(a==='quick')openQuick();if(a==='closeQuick'){state.quick=false;render()}if(a==='saveQuick')saveQuick();if(a==='copyDaily')copy(dailyReport(),'日報をコピーしました');if(a==='copyWeekly')copy(weeklyReport(),'週報/1on1をコピーしました');if(a==='export')exportJson();if(a==='notify')notify();if(a==='google')fetchCalendar();if(a==='closeGuide'){localStorage.setItem('namilog.onboarding.closed.v1','1');state.onboarding=false;render()}if(a==='survey')copy(surveyMemo(),'アンケートをコピーしました');if(a==='culture')copy(cultureMemo(),'日報文化メモをコピーしました');if(a==='manager')copy(managerMemo(),'上長向け読む作法をコピーしました');if(a==='employee')copy(employeeMemo(),'社員向け説明をコピーしました');if(a==='reportTemplate')copy(reportTemplateMemo(),'日報/週報テンプレをコピーしました');if(a==='pilotCulture')copy(pilotCultureMemo(),'パイロット案をコピーしました');if(a==='qaMemo')copy(qaMemo(),'MVP QA手順をコピーしました');if(a==='userTest')copy(userTestMemo(),'ユーザーテスト案内をコピーしました');if(a==='feedback')copy(feedbackMemo(),'アンケート項目をコピーしました');if(a==='limits')copy(limitsMemo(),'既知の制約をコピーしました')}
function saveQuick(){const d=state.draft;if(!d.mood && !d.progress){toast('まず今の波か進み具合を選んでください');return}const m=d.mood||primaryChoices[1];const p=d.progress||null;const log={id:uid(),createdAt:new Date().toISOString(),emotion:{emoji:m.emoji,label:m.label,score:m.score},progress:p?{emoji:p.emoji,label:p.label,score:p.score}:null,emotionScore:m.score,progressScore:p?p.score:0,task:d.task.trim(),memo:d.memo.trim(),nextAction:d.next.trim(),includeInReport:true};state.logs=[log,...state.logs];state.quick=false;render();toast('この波を残しました')}
function editLog(id){const l=state.logs.find(x=>x.id===id);if(!l)return;const memo=prompt('メモを編集',l.memo||'');if(memo===null)return;l.memo=memo;const next=prompt('次の一手を編集',l.nextAction||'');if(next!==null)l.nextAction=next;l.updatedAt=new Date().toISOString();render();}
function copy(text,msg){navigator.clipboard?.writeText(text).then(()=>toast(msg)).catch(()=>{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(msg)})}
function exportJson(){const blob=new Blob([JSON.stringify({version:VERSION,profile:state.profile,logs:state.logs},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`namilog-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
async function notify(){if(!('Notification'in window)){toast('このブラウザは通知に非対応です');return}const perm=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(perm!=='granted'){toast('通知が許可されていません');return}if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.register('./namilog-sw.js?v=40.8');await reg.showNotification('NamiLog Quick Check',{body:'今の波を3秒で残しませんか？',tag:'namilog-reminder',data:{url:location.pathname+'?quick=1'},actions:[{action:'open',title:'記録する'},{action:'later',title:'あとで'}]});toast('テスト通知を出しました')}else{new Notification('NamiLog Quick Check',{body:'今の波を残しませんか？'});}}
function fetchCalendar(){toast('Google予定取得は接続済み環境で動作します。今日は手動タスク候補も使えます。');}

function surveyMemo(){return `NamiLog ミニテスト後アンケート

1. 最初の1件は迷わず記録できましたか？
- できた / 少し迷った / できなかった

2. Quick Checkの5段階はちょうどよかったですか？
- 軽くてよい / もう少し細かく選びたい / わかりにくい

3. 日報のたねは、そのまま日報を書く助けになりそうですか？
- なりそう / 少しなりそう / あまりならない

4. Googleカレンダーの予定候補は便利そうですか？
- 便利 / なくてもよい / まだ判断できない

5. 日報・週報を書くモチベーションは少し上がりそうですか？
- 上がりそう / 変わらない / むしろ負担に感じる

6. 追加してほしい機能・消してほしい機能があれば教えてください。

7. 気になった文言、UI、操作のわかりにくさがあれば教えてください。`;}

function cultureMemo(){return `NamiLogは、日報を監視ではなく本人の振り返りと上長との対話に変える補助アプリです。\n\n最小運用：\n- 社員は1日1回、今の波を残す\n- 夕方に日報のたねをコピーする\n- 週1回、週報/1on1のたねを使う\n\n日報は完璧な文章でなくてOK。今日進んだこと、詰まったこと、明日の一手が1つずつあれば十分です。`}
function managerMemo(){return `上長向け：NamiLog日報の読む作法\n\n- 評価材料としてではなく、支援のきっかけとして読む\n- 毎日すべてに返信しなくてよい\n- 詰まりが続くテーマには週1回でも反応する\n- 「なぜできていない？」ではなく「何があると進みそう？」と聞く\n- 本人がコピーした範囲だけを扱い、個人ログそのものを要求しない`}

function employeeMemo(){return `NamiLog 社員向け説明

NamiLogは、日報を増やすための監視ツールではありません。
仕事中の「今の波」を短く残して、夕方の日報や週末の1on1で思い出す負担を減らすための補助アプリです。

使い方は最小でOKです。
1. 1日1回「今の波を残す」
2. 楽しい/いい感じ/穏やか/少ししんどい/モヤモヤ、進んだ/少し進んだ/バタつき/詰まった/止まったを選ぶ
3. 夕方に「日報をコピー」する

完璧な文章にする必要はありません。
今日進んだこと、詰まったこと、明日の一手が1つずつ見えれば十分です。

個人ログは本人の振り返り用です。
共有するのは、本人が日報・週報としてコピーした範囲だけです。`;}
function reportTemplateMemo(){return `NamiLog 日報/週報テンプレ

【日報テンプレ】
今日進んだこと：
- 

詰まったこと・気になったこと：
- 

明日の一手：
- 

必要なら相談したいこと：
- 

【週報/1on1テンプレ】
今週の成果：
- 

今週の詰まり：
- 

来週試したいこと：
- 

1on1で相談したいこと：
- 

上長に見てほしい観点：
- 何があると進みやすいか
- どのタスクで詰まりやすいか
- 再現したい良い進め方は何か`;}
function pilotCultureMemo(){return `NamiLog 日報文化パイロット案

目的：
日報を義務ではなく、本人の振り返りと上長の支援につなげる。

期間：
まずは1〜2週間。

社員側の最小運用：
- 1日1回、NamiLogで今の波を残す
- 夕方に日報のたねを見て、必要ならコピーする
- 週末または1on1前に、週報/1on1のたねを確認する

上長側の最小運用：
- 毎日すべてに返信しなくてよい
- 週1回、詰まりや相談テーマを拾う
- 「なぜできていない？」ではなく「何があると進みそう？」と聞く

検証したいこと：
- 日報を書く負担が減るか
- 日報の内容が具体化するか
- 1on1で話す材料が増えるか
- 本人が記録するメリットを感じるか
- 監視感や心理的抵抗がないか`;}

function qaMemo(){return `NamiLog MVP 最終QA手順

目的：
明日ユーザーに触ってもらう前に、最低限の機能が壊れていないか確認する。

確認手順：
1. 「今の波を残す」を押す
2. 感情5段階から1つ選ぶ
3. 進み具合5段階から1つ選ぶ
4. 必要ならタスクを選ぶ
5. 「この波を残す」を押す
6. 今日のログに反映されるか確認
7. ログの編集ができるか確認
8. 日報から外す/日報に戻す が動くか確認
9. 日報コピーに反映されるか確認
10. 週報/1on1コピーに反映されるか確認
11. 日/週/月の波グラフが崩れていないか確認
12. 通知テストが出るか確認
13. ページ更新後もログが残るか確認

合格ライン：
- 1分以内に1件記録できる
- 日報のたねに反映される
- グラフが表示される
- 既存ログが消えない

不具合が出たら記録すること：
- どの手順で止まったか
- 表示されたエラーメッセージ
- ブラウザ
- スクショ
- 再現できるかどうか`; }


function userTestMemo(){return `NamiLog MVP ユーザーテストのお願い

目的：
仕事中の「今の波」を3秒で残し、夕方の日報や1on1の材料にできるかを確認したいです。

テストURL：
https://antisanogile.github.io/Namilog/

まず試してほしいこと：
1. NamiLogを開く
2. 「今の波を残す」を押す
3. 感情5段階から選ぶ
4. 進み具合5段階から選ぶ
5. 可能ならタスクを選ぶ
6. 「この波を残す」を押す
7. 今日のログに反映されるか見る
8. 日報のたねを見て、日報を書く助けになりそうか確認する

余裕があれば試してほしいこと：
- ログの編集
- 日報から外す / 日報に戻す
- 日報コピー
- 週報/1on1コピー
- Googleカレンダー予定の取得
- 通知テスト

見たい観点：
- 1分以内に1件記録できるか
- 5段階はわかりやすいか
- 日報のたねは役に立ちそうか
- 仕事の波グラフは見たいと思えるか
- 抵抗感や監視感がないか

補足：
個人ログは本人の振り返り用です。上長や管理者へ自動共有されるものではありません。共有する場合は、本人が日報や週報としてコピーした範囲だけです。`;}

function feedbackMemo(){return `NamiLog MVP フィードバック項目

1. 最初の1件は迷わず記録できましたか？
- できた / 少し迷った / できなかった

2. 5段階Quick Checkは軽く感じましたか？
- ちょうどよい / 少し物足りない / まだ重い / わかりにくい

3. 日報のたねは、日報を書く助けになりそうですか？
- なりそう / 少しなりそう / あまりならない

4. 週報/1on1のたねは使えそうですか？
- 使えそう / まだ判断できない / 使いにくい

5. モチベーションの波グラフは見たいと思えましたか？
- 見たい / たまに見たい / あまり見ないと思う

6. Googleカレンダーの予定候補は便利そうですか？
- 便利 / 任意でよい / 不要 / まだ試せていない

7. 通知は必要そうですか？
- 必要 / あれば便利 / 不要 / まだ判断できない

8. 抵抗感や監視感はありましたか？
- ない / 少しある / かなりある

9. 追加してほしい機能はありますか？

10. 消してほしい、または隠してほしい機能はありますか？

11. 文言・色・画面で違和感があるところはありますか？`;}

function limitsMemo(){return `NamiLog MVP 既知の制約

現時点でできること：
- 5段階Quick Checkで今の波を記録
- 感情/進捗/タスク/メモ/次の一手を保存
- 今日のログを確認
- 日/週/月の波グラフを見る
- 日報/週報/1on1のたねをコピー
- Googleカレンダー予定をタスク候補として使う
- 通知テストを出す

現時点の制約：
- データ保存は基本的に同じブラウザ内のlocalStorage
- 別PC/別ブラウザとは同期しない
- NamiLogを完全に閉じた状態から毎朝自動起動するわけではない
- Google予定はタイトル/開始時刻/終了時刻のみ扱う
- 予定本文・参加者・Meet URLは扱わない
- AI分析はまだ本格接続ではない
- FFS連携はまだ設計段階
- 全社本番利用にはログイン/DB/RLSの本実装が必要

明日以降の改善方針：
ユーザーアンケートをもとに、追加/変更/削除する機能を決める。MVP段階では機能追加より、迷わず使えることを優先する。`;}

function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
if('serviceWorker'in navigator){navigator.serviceWorker.register('./namilog-sw.js?v=40.8').catch(()=>{});navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OPEN_QUICK_CHECK')openQuick()})}
if(new URLSearchParams(location.search).get('quick')==='1')setTimeout(openQuick,200);
render();
