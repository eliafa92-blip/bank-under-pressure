import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, BrainCircuit, Check, ChevronLeft, ClipboardCopy, Compass, FileText, Flag, HelpCircle, Lightbulb, RefreshCcw, Scale, Share2, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import scenario from './content/scenario.json';
import config from './content/config.json';
import { debrief, evidenceIndex, finalFacts, firstDocId, initialState, pathForSignals, rootCards, scoreGame, secondDocId, stages, STORE_KEY, validSavedState, withSignals, TIME_LIMIT_MS } from './game/engine';
import type { DebriefStep, Verdict } from './game/engine';
import type { CausalChoice, CfoChoice, Path, FinalChoice, GameState, RecoveryChoice, SecondTake, SecondaryChoice, Stage } from './game/types';

const STEP_NAMES: Record<Stage, string> = {
  intro: 'פתיחה', signals: 'תמונת מצב', first: 'חקירה ראשונה', second: 'חקירה מעמיקה', analysis: 'גיבוש הערכה', decision: 'הכרעה פיקוחית', results: 'תוצאות',
};
const hints = [
  'אילו מגמות משני צדי המאזן עשויות להיות קשורות זו לזו, גם אם הן מופיעות בסעיפים שונים?',
  'השווה בין קצב צמיחת האשראי לבין היקף והרכב מקורות המימון. מה השתנה לאורך הזמן?',
];
const recoveryOptions: {value:RecoveryChoice;title:string;description:string}[] = [
  {value:'credit', title:'לבחון את התפתחות תיק האשראי', description:'הרחבת הפעילות, ענפים וצורכי אשראי'},
  {value:'funding', title:'לבחון את הרכב מקורות המימון', description:'פיקדונות קמעונאיים, גופים פיננסיים ואג״ח'},
  {value:'deepen', title:'להעמיק בממצא הנוכחי', description:'להמשיך בכיוון שבחרתי ולבחון את הנתונים הנלווים'},
  {value:'none', title:'לא נדרשת חקירה נוספת', description:'אעבור לשלב גיבוש ההערכה'},
];
const advancedCheckOptions: {value:'stay'|'reselect';title:string;description:string}[] = [
  {value:'reselect', title:'כן, הסיכון מנוהל', description:'אחזור לשלב הראשון ואבחר נתון חקירה אחר.'},
  {value:'stay', title:'אדבוק בבחירה הראשונה שלי', description:'אמשיך בחקירה בכיוון שבחרתי.'},
];
const advancedTakes: {value:SecondTake;title:string;description:string}[] = [
  {value:'resolved', title:'הסיכון טופל ולכן אינו עוד מוקד מרכזי', description:'המח״מ, הביקושים והיחסים הנאותים מפחיתים את הצורך בבירור נוסף.'},
  {value:'profit', title:'מוקד הסיכון הוא כעת הרווחיות והמודל העסקי', description:'ההתייקרות במימון והשחיקה במרווחי האשראי חשובות יותר משינוי המקורות.'},
  {value:'balanced', title:'אני משאיר את הערכת הסיכון המרכזית, עם הסתייגויות', description:'ההתפתחויות במימון לצד צמיחת האשראי נותרות מהותיות; נתוני החוסן ממתנים את חומרתן.'},
  {value:'crisis', title:'המסמך מחייב מסקנה על מצוקת נזילות חמורה', description:'התלות באג״ח מוכיחה כשל חמור המחייב התערבות מיידית.'},
];
const basicTakes: {value:SecondTake;title:string;description:string}[] = [
  {value:'resolved', title:'נתוני ההון והנזילות מבטלים כל צורך בבירור', description:'הבנק רווחי ומחזיק כריות נזילות.'},
  {value:'balanced', title:'יש לבחון את התמונה המשולבת בלי לקבוע מראש כשל', description:'מקורות ושימושים, מימון זמין ועלותו, לצד נתונים ממתנים.'},
  {value:'profit', title:'ממצאי התחרות והרווחיות מסבירים את עיקר התמונה', description:'מרווח האשראי העסקי החדש נשחק.'},
  {value:'crisis', title:'עצם השינוי במקורות מוכיח משבר נזילות', description:'היקף גיוס האג״ח משמעו קושי נוכחי.'},
];
const causalOptions: {value:CausalChoice;title:string}[] = [
  {value:'underwriting',title:'צמיחת האשראי מוכיחה שהבנק הפסיק להקפיד על חיתום נאות.'},
  {value:'lcr',title:'יחס LCR נאות שולל שינוי אפשרי בפרופיל סיכון המימון.'},
  {value:'bonds',title:'עצם הנפקת איגרות חוב מוכיח מצוקת נזילות חמורה.'},
  {value:'balanced',title:'גוברת הרגישות לזמינות, לעלות ולמחזור מימון התומך באשראי.'},
];
const cfoOptions: {value:CfoChoice;title:string}[] = [
  {value:'balanced',title:'אלה נתונים ממתנים חשובים. עדיין צריך לבדוק גמישות מימון, עלויות, מועדי פירעון והלימה לקצב האשראי.'},
  {value:'dismiss',title:'הנתונים הממתנים מוכיחים שלא נדרש בירור נוסף.'},
  {value:'breach',title:'היקף גיוס האג״ח מוכיח כשל ניהולי ומחייב התערבות מיידית.'},
  {value:'credit',title:'המימון אינו רלוונטי; כדאי להתמקד רק בעלייה המתונה בהפסדי האשראי.'},
];
const secondaryOptions: {value:SecondaryChoice;title:string}[] = [
  {value:'none',title:'אין שום סיכון משני שכדאי לבדוק.'},
  {value:'margin',title:'שחיקת מרווחי האשראי עקב תחרות היא מוקד מעקב משני אפשרי, לא הסבר יחיד לשינוי המימון.'},
  {value:'sector',title:'ריכוזיות האשראי בענף הבינוי והנדל״ן מצדיקה בירור נפרד, אך אינה מחליפה את בעיית השורש.'},
  {value:'everything',title:'כל שינוי במדדים מוכיח כשל מערכתי רחב.'},
];
const finalOptions: {value:FinalChoice;title:string;description:string}[] = [
  {value:'monitor',title:'המשך מעקב שוטף בלבד',description:'ההון והנזילות נאותים ולכן לא נדרש בירור נוסף.'},
  {value:'inquiry',title:'בירור פיקוחי ממוקד',description:'לבחון את תוכנית המימון מול המשך צמיחת האשראי, יציבות המקורות, מועדי מחזור, עלויות ותרחישי לחץ.'},
  {value:'remediation',title:'דרישה מיידית לתוכנית תיקון מחייבת',description:'לקבוע כבר כעת כי מבנה המימון מעיד על חולשת ניהול מהותית.'},
  {value:'emergency',title:'התערבות דחופה לעצירת האשראי החדש',description:'להניח כי הבנק ניצב בפני משבר נזילות מיידי.'},
];

const VERDICT_LABEL: Record<Verdict, string> = {match:'תואם להכרעה המועדפת', partial:'תואם בחלקו', miss:'שונה מההכרעה המועדפת'};
const titleOf = <T extends string>(options:{value:T;title:string}[], value:T|null) => options.find(o=>o.value===value)?.title ?? 'לא נבחר';

// What the player actually chose at each step, in the words they saw on screen.
function debriefChoice(step:DebriefStep, game:GameState, path:Path, secondId:string|null):string {
  switch (step) {
    case 'signals': return game.selectedSignals.map(id=>scenario.metrics.find(m=>m.id===id)?.label).join('; ');
    case 'first':
      if (path==='advanced') return game.advancedReselected?'הסיכון מנוהל — חזרה לבחירת נתונים':'דבקתי בבחירה הראשונה';
      if (path==='credit'||path==='funding') return game.evidence.map(id=>evidenceIndex.get(id)?.text).join(' · ')||'לא נבחרו ראיות';
      return titleOf(recoveryOptions, game.recoveryChoice);
    case 'second': return titleOf(secondId==='advanced'?advancedTakes:basicTakes, game.secondTake);
    case 'roots': return rootCards.filter(c=>game.selectedRoots.includes(c.id)).map(c=>c.text).join(' · ')||'לא סומנו כרטיסיות';
    case 'causal': return titleOf(causalOptions, game.causalChoice);
    case 'cfo': return titleOf(cfoOptions, game.cfoChoice);
    case 'secondary': return titleOf(secondaryOptions, game.secondaryChoice);
    case 'final': return titleOf(finalOptions, game.finalChoice);
  }
}

function hydrate():GameState {
  try { const value = localStorage.getItem(STORE_KEY); return value ? validSavedState(JSON.parse(value)) ?? initialState() : initialState(); }
  catch { return initialState(); }
}

function ChoiceGroup<T extends string>({label, options, value, onChange}: {
  label?:string;options:{value:T;title:string;description?:string}[];value:T|null;onChange:(v:T)=>void
}) {
  return <fieldset className="choice-group"><legend className="sr-only">{label ?? 'בחר אפשרות'}</legend>
    {options.map(option => <label className={`choice-card ${value === option.value ? 'is-selected' : ''}`} key={option.value}>
      <input type="radio" name={label ?? 'options'} checked={value === option.value} onChange={()=>onChange(option.value)} />
      <span className="radio-view" aria-hidden="true">{value === option.value ? <Check size={13}/> : null}</span>
      <span><strong>{option.title}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>)}
  </fieldset>;
}

function DocumentView({id}:{id:string}) {
  const doc = scenario.documents[id as keyof typeof scenario.documents];
  if (!doc) return null;
  return <article className="bank-document" aria-label={doc.title}>
    <div className="doc-top"><div className="doc-id"><FileText size={18}/> {doc.type}</div><span className="doc-stamp">בנק מצפן | חומר פנימי בתרחיש</span></div>
    <h3>{doc.title}</h3><p className="doc-subtitle">{doc.subtitle}</p>
    <div className="document-body">{doc.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</div>
    <div className="doc-bottom">מסמך בדיוני לצורכי משחק • הנתונים מוצגים כפי שדווחו בדיון, לא כהכרעה פיקוחית</div>
  </article>;
}

function App() {
  const [game, setGame] = useState<GameState>(hydrate);
  const [shareStatus, setShareStatus] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [advancedAnswer, setAdvancedAnswer] = useState<'stay'|'reselect'|null>(null);
  const [now, setNow] = useState(()=>Date.now());
  const firstStageRender = useRef(true);
  const timerRunning = game.startedAt!==null && game.stage!=='intro' && game.stage!=='results';
  useEffect(()=>{if(!timerRunning)return;const id=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(id);},[timerRunning]);
  const remainingMs = game.startedAt===null ? TIME_LIMIT_MS : Math.max(0, TIME_LIMIT_MS-(now-game.startedAt));
  useEffect(()=>{if(timerRunning&&remainingMs===0&&!game.overtime)setGame(s=>({...s,overtime:true}));},[timerRunning,remainingMs,game.overtime]);
  const timeNotice=remainingMs===0?'הזמן הסתיים. אפשר להמשיך במשחק.':remainingMs<=5*60000?'נותרו פחות מחמש דקות.':'';
  const clock=`${String(Math.floor(remainingMs/60000)).padStart(2,'0')}:${String(Math.floor(remainingMs/1000)%60).padStart(2,'0')}`;
  useEffect(()=>{try {localStorage.setItem(STORE_KEY,JSON.stringify(game));} catch {/* private mode */}},[game]);
  useEffect(()=>{window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    // Move focus to the new stage's heading so screen readers announce the change.
    if(!firstStageRender.current){const h=document.querySelector<HTMLElement>('main h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
    firstStageRender.current=false;
  },[game.stage]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setConfirmReset(false);setShowEvidence(false);}};
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  },[]);
  const update = (change:Partial<GameState>)=>setGame(s=>({...s,...change}));
  const goto=(stage:Stage)=>update({stage});
  const path = pathForSignals(game.selectedSignals);
  const firstId = firstDocId(game);
  const secondId = secondDocId(game);
  const stagePosition = stages.indexOf(game.stage);
  const score = scoreGame(game);
  const activeDoc = scenario.documents[firstId as keyof typeof scenario.documents];
  const evidenceItems = activeDoc.evidenceIds.map(id=>evidenceIndex.get(id)).filter((x): x is NonNullable<typeof x>=>Boolean(x));
  const chosenRoot=(id:string)=>update({selectedRoots:game.selectedRoots.includes(id)?game.selectedRoots.filter(x=>x!==id):[...game.selectedRoots,id]});
  const chosenEvidence=(id:string)=>update({evidence:game.evidence.includes(id)?game.evidence.filter(x=>x!==id):game.evidence.length>=config.maxEvidence?game.evidence:[...game.evidence,id]});
  const chosenSignal=(id:string)=>setGame(s=>withSignals(s,s.selectedSignals.includes(id)?s.selectedSignals.filter(x=>x!==id):s.selectedSignals.length>=config.maxInitialSignals?s.selectedSignals:[...s.selectedSignals,id]));
  const reset=()=>{try{localStorage.removeItem(STORE_KEY)}catch{/* ignore */}setGame(initialState());setConfirmReset(false);setShareStatus('');};
  const start=()=>setGame({...initialState(),stage:'signals',startedAt:Date.now()});
  const share=async()=>{
    const text=`סיימתי את BANK UNDER PRESSURE — אתגר שיקול דעת פיקוחי. הפרופיל שלי: ${score.profile} (${score.total}/100). מה הייתם מחליטים במקומי?`;
    const url=config.publicSiteUrl || window.location.origin + window.location.pathname;
    try{
      if(navigator.share){await navigator.share({title:'BANK UNDER PRESSURE',text,url});setShareStatus('שיתוף נפתח בהצלחה.');return;}
      if(navigator.clipboard){await navigator.clipboard.writeText(`${text}\n${url}`);setShareStatus('הטקסט הועתק. אפשר לשתף בלינקדאין.');return;}
      setShareStatus('אפשר להעתיק את הכתובת מסרגל הדפדפן ולשתף.');
    }catch {setShareStatus('השיתוף בוטל או אינו זמין בדפדפן.');}
  };
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand"><div className="brand-mark"><Compass size={21}/></div><div><span className="brand-en" dir="ltr">BANK UNDER PRESSURE</span><span className="brand-he">הסיכון שאף אחד לא רואה</span></div></div>
      {game.stage !== 'intro' && <button className="reset-mini" onClick={()=>setConfirmReset(true)}><RefreshCcw size={15}/> התחלה מחדש</button>}
    </div></header>
    <main className="container">
      {game.stage!=='intro' && game.stage!=='results' && <div className="progress-wrap">
        <div className="progress-meta"><span>שלב {stagePosition} מתוך 5</span><strong>{STEP_NAMES[game.stage]}</strong><span className={`timer ${remainingMs===0?'timer-over':remainingMs<120000?'timer-low':''}`} role="timer" aria-label="זמן שנותר" aria-live="off">{remainingMs===0?'הזמן הסתיים — אפשר להמשיך':<>זמן שנותר: <b dir="ltr">{clock}</b></>}</span>
        <span className="sr-only" aria-live="polite">{timeNotice}</span></div>
        <div className="progress" role="progressbar" aria-valuenow={Math.min(stagePosition,5)} aria-valuemin={0} aria-valuemax={5} aria-label="התקדמות המשחק"><span style={{width:`${Math.min(stagePosition,5)/5*100}%`}}/></div>
      </div>}

      {game.stage==='intro' && <section className="hero-card">
        <div className="orb orb-one"/><div className="orb orb-two"/>
        <div className="hero-inner"><div className="eyebrow"><span className="eyebrow-line"/> משימת הערכה מוסדית <span className="eyebrow-line"/></div>
          <div className="hero-icon"><BrainCircuit size={30}/></div>
          <h1 dir="ltr">BANK UNDER PRESSURE</h1>
          <p className="hero-subtitle">הסיכון שאף אחד לא רואה</p>
          <p className="hero-lead">בנק מצפן מציג רווחיות גבוהה, הון נאות והפסדי אשראי מתונים. בעוד זמן קצר תידרש לגבש המלצה פיקוחית. האם תזהה מה דורש בירור?</p>
          <div className="hero-facts"><span><Target size={17}/> 5 שלבי החלטה</span><span><Scale size={17}/> נתונים בדיוניים</span><span><Compass size={17}/> 20 דקות</span></div>
          <button className="primary-button hero-cta" onClick={start}>מתחילים במשימה <ArrowLeft size={18}/></button>
          <p className="hero-disclaimer">לא נדרש ידע מוקדם בפיקוח על הבנקים. אין מגבלת זמן קשיחה.</p>
        </div>
      </section>}

      {game.stage==='signals' && <section className="section-flow">
        <div className="heading-block"><span className="chapter-label">פרק ראשון · תמונת מצב</span><h1>מה מסתתר מאחורי התוצאות?</h1>
          <p>לפניך נתוני הבנק לשלוש שנים. סמן <b>בין מדד אחד לשלושה מדדים</b> שהיית בוחר לבדוק לעומק. הבחירות שלך יקבעו מה ייפתח בחקירה.</p></div>
        <div className="panel data-panel"><div className="panel-heading"><h2>לוח נתונים — בנק מצפן</h2><span className="counter">נבחרו {game.selectedSignals.length} / {config.maxInitialSignals}</span></div>
          <div className="table-scroll"><table className="metrics-table" role="table"><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">מדד</th>{scenario.columns.map(col=><th scope="col" role="columnheader" key={col} dir="ltr">{col}</th>)}<th scope="col" role="columnheader" className="check-col">בדיקה</th></tr></thead>
          <tbody role="rowgroup">{scenario.metrics.map(metric=><tr role="row" key={metric.id} className={game.selectedSignals.includes(metric.id)?'selected-row':''} onClick={e=>{if(!(e.target as HTMLElement).closest('button'))chosenSignal(metric.id);}}>
            <th scope="row" role="rowheader">{metric.label}</th>{metric.values.map((v,i)=><td role="cell" className="numeric" dir="ltr" data-year={scenario.columns[i]} key={i}>{v}</td>)}<td role="cell" className="check-col"><button className={`row-check ${game.selectedSignals.includes(metric.id)?'checked':''}`} aria-label={`${game.selectedSignals.includes(metric.id)?'בטל בדיקה של':'בחר לבדיקה'} ${metric.label}`} aria-pressed={game.selectedSignals.includes(metric.id)} onClick={()=>chosenSignal(metric.id)} disabled={!game.selectedSignals.includes(metric.id)&&game.selectedSignals.length>=config.maxInitialSignals}>{game.selectedSignals.includes(metric.id)&&<Check size={14}/>}</button></td></tr>)}</tbody></table></div>
          <p className="table-note">הנתונים בדיוניים. מדד חשיפת הבינוי והנדל״ן מוצג לצורך התרחיש; אין להסיק ממנו לבדו עמידה או חריגה מהוראה רגולטורית.</p></div>
        <div className="actions"><span className="hint-small">{game.selectedSignals.length<1?'יש לבחור לפחות מדד אחד כדי להמשיך.':'אין משוב על נכונות הבחירות במהלך המשחק.'}</span><button className="primary-button" disabled={game.selectedSignals.length<1} onClick={()=>goto('first')}>להמשך החקירה <ArrowLeft size={17}/></button></div>
      </section>}

      {game.stage==='first' && <section className="section-flow">
        <div className="heading-block"><span className="chapter-label">פרק שני · חקירה ראשונה</span><h1>נתון הוא תחילת הסיפור.</h1><p>{path==='advanced'?'קרא את המסמך שהתקבל וענה על השאלה.':'קרא את המסמך שהתקבל. סמן עד שתי ראיות שהיית מצמיד ללוח העבודה שלך. הבחירה אינה חובה.'}</p></div>
        <DocumentView id={firstId}/>
        {path==='advanced' ? <div className="manager-card"><div className="manager-label"><ShieldCheck size={19}/> שאלה לפני המשך החקירה</div><blockquote>בהינתן המידע שמסרה ההנהלה, המשקף יחסי הון ונזילות נאותים, ובהינתן שהדירקטוריון אישר את התפתחות המאזן — האם הסיכון מנוהל בצורה נאותה?</blockquote>
          <ChoiceGroup label="האם הסיכון מנוהל" options={advancedCheckOptions} value={advancedAnswer} onChange={setAdvancedAnswer}/>
        </div> : <div className="panel"><div className="panel-heading"><h2><BookOpen size={18}/> לוח הראיות</h2><span className="counter">{game.evidence.length} / {config.maxEvidence}</span></div><p className="muted">איזה מידע מתוך המסמך היית שומר להמשך? אין חובה לבחור.</p>
          <div className="evidence-grid">{evidenceItems.map(e=><button className={`evidence-chip ${game.evidence.includes(e.id)?'active':''}`} key={e.id} aria-pressed={game.evidence.includes(e.id)} onClick={()=>chosenEvidence(e.id)} disabled={game.evidence.length>=config.maxEvidence&&!game.evidence.includes(e.id)}><span className="box-check">{game.evidence.includes(e.id)&&<Check size={13}/>}</span>{e.text}</button>)}</div>
        </div>}
        {(path==='decoy'||path==='general') && <div className="manager-card"><div className="manager-label"><ShieldCheck size={19}/> הודעה ממנהל האגף</div><blockquote>הממצא שבחרת בהחלט ראוי לבדיקה. אבל לפני שנקבע שהוא מוקד הסיכון המרכזי, חשוב לוודא שאיננו מפספסים שינוי רחב יותר במאזן. איזה תחום נוסף היית בוחן?</blockquote>
          <ChoiceGroup label="כיוון חקירה נוסף" options={recoveryOptions} value={game.recoveryChoice} onChange={v=>update({recoveryChoice:v})}/>
          <p className="muted small">זו נקודת החלטה מובנית במשחק, ולא שימוש בעזרה בתשלום.</p>
        </div>}
        <div className="actions"><button className="primary-button" disabled={((path==='decoy'||path==='general')&&!game.recoveryChoice)||(path==='advanced'&&!advancedAnswer)} onClick={()=>{
          if(path==='advanced'&&advancedAnswer==='reselect'){setAdvancedAnswer(null);update({advancedReselected:true,stage:'signals',selectedSignals:[],evidence:[]});return;}
          goto('second');
        }}>{path==='advanced'&&advancedAnswer==='reselect'?'חזרה לבחירת נתונים':'למסמך הבא'} <ArrowLeft size={17}/></button></div>
      </section>}

      {game.stage==='second' && <section className="section-flow">
        <div className="heading-block"><span className="chapter-label">פרק שלישי · מידע חדש</span><h1>{secondId==='advanced'?'האם הנתונים החדשים משנים את התמונה?':'נקודת מבט נוספת על הבנק'}</h1><p>{secondId==='advanced'?'המסמך כולל ראיות שעשויות לתמוך ביותר מפרשנות אחת. אין חובה לשנות עמדה בעקבות כל נתון חדש.':'המשך החקירה מאפשר לך לקרוא חומר ממקור נוסף ולהחליט כיצד לפרש אותו.'}</p></div>
        {secondId?<DocumentView id={secondId}/>:<div className="panel"><h2>סיום החקירה</h2><p>בחרת לעבור לגיבוש תמונת הסיכון ללא עיון במסמך נוסף. בהכרעה הסופית יעמוד לרשותך סיכום העובדות המרכזיות כמו לכל יתר השחקנים.</p></div>}
        <div className="panel"><h2>{secondId==='advanced'?'האם תשנה את ההערכה הראשונית?':'כיצד תפרש את המידע שנאסף?'}</h2><p className="muted">בחר תשובה אחת. לא יוצג כעת חיווי לגבי בחירתך.</p><ChoiceGroup label="פירוש המסמך השני" options={secondId==='advanced'?advancedTakes:basicTakes} value={game.secondTake} onChange={v=>update({secondTake:v})}/></div>
        {game.hintCount>0&&<div className="hint-panel">{hints.slice(0,game.hintCount).map((t,i)=><p key={i}><Lightbulb size={17}/> <b>רמז {i+1}:</b> {t}</p>)}</div>}
        <div className="help-row"><div><strong>זקוק לעזרה?</strong><small>רמז מפורש הוא בחירה שלך בלבד. 5 נקודות לכל רמז מתוך רכיב העצמאות (עד 10).</small></div><button className="outline-button" disabled={game.hintCount>=2} onClick={()=>update({hintCount:game.hintCount+1})}><HelpCircle size={17}/> {game.hintCount===0?'בקשת רמז (5− נק׳)':game.hintCount===1?'רמז נוסף (5− נק׳)':'כל הרמזים נחשפו'}</button></div>
        <div className="actions"><button className="primary-button" disabled={!game.secondTake} onClick={()=>goto('analysis')}>לגיבוש ההערכה <ArrowLeft size={17}/></button></div>
      </section>}

      {game.stage==='analysis'&&<section className="section-flow">
        <div className="heading-block"><span className="chapter-label">פרק רביעי · שיקול דעת</span><h1>מהי בעיית השורש?</h1><p>כעת עליך להבחין בין עובדות רלוונטיות, מסיחים ומידע ממתן. אין הכרח לבחור בכל הממצאים, ואין ציון גלוי בשלב זה.</p></div>
        <div className="panel"><div className="panel-heading"><h2><Target size={19}/> א. הגדרת בעיית השורש</h2><span className="counter">{game.selectedRoots.length} נבחרו</span></div><p className="muted">סמן כל טענה שלדעתך מסבירה את <b>בעיית השורש המרכזית</b>. ניתן לבחור ללא הגבלה; אל תסמן סיכון משני רק משום שכדאי לבדוק אותו.</p>
          <div className="root-grid">{rootCards.map(card=><label className={`root-card ${game.selectedRoots.includes(card.id)?'picked':''}`} key={card.id}><input type="checkbox" checked={game.selectedRoots.includes(card.id)} onChange={()=>chosenRoot(card.id)}/><span className="box-check">{game.selectedRoots.includes(card.id)&&<Check size={14}/>}</span><span>{card.text}</span></label>)}</div></div>
        <div className="panel"><h2><TrendingUp size={19}/> ב. מהי המשמעות האפשרית של השילוב?</h2><ChoiceGroup label="השפעה סיבתית" options={causalOptions} value={game.causalChoice} onChange={v=>update({causalChoice:v})}/></div>
        <div className="manager-card"><div className="manager-label"><ShieldCheck size={19}/> ג. אתגור מצד סמנכ״ל הכספים</div><blockquote>״סך הפיקדונות שלנו גדל. ה־LCR עומד על 145%, חלק מהאג״ח ארוכות ומפוזרות בין משקיעים והדירקטוריון אישר תוכנית מימון. אין ראיות למצוקת נזילות.״</blockquote><p><strong>מה תשיב?</strong></p><ChoiceGroup label="תשובה לסמנכ״ל הכספים" options={cfoOptions} value={game.cfoChoice} onChange={v=>update({cfoChoice:v})}/></div>
        <div className="panel"><h2><Scale size={19}/> ד. האם זיהית סיכון נוסף ששווה מעקב?</h2><p className="muted">אפשר לזהות סיכונים נוספים בלי לקבוע שהם בעיית השורש.</p><ChoiceGroup label="סיכון משני" options={secondaryOptions} value={game.secondaryChoice} onChange={v=>update({secondaryChoice:v})}/></div>
        <div className="actions"><button className="primary-button" disabled={!game.causalChoice||!game.cfoChoice||!game.secondaryChoice} onClick={()=>goto('decision')}>להכרעה פיקוחית <ArrowLeft size={17}/></button></div>
      </section>}

      {game.stage==='decision'&&<section className="section-flow">
        <div className="heading-block"><span className="chapter-label">פרק חמישי · החלטה משותפת</span><h1>מה היית ממליץ למנהל האגף?</h1><p>לכל השחקנים מוצגות כעת אותן עובדות. בחר פעולה פיקוחית מידתית על סמך הנתונים והמגבלות הידועות.</p></div>
        <div className="final-facts"><div className="facts-header"><ClipboardCopy size={18}/> תזכיר עובדתי — משותף לכל המסלולים</div><ul>{finalFacts().map((fact,i)=><li key={i}>{fact}</li>)}</ul><p>הנתונים בדיוניים; אין כאן קביעה מוקדמת על כשל ניהולי או על מצוקת נזילות.</p></div>
        <div className="panel final-choice"><h2>איזו פעולה פיקוחית היית בוחר?</h2><ChoiceGroup label="החלטה פיקוחית סופית" options={finalOptions} value={game.finalChoice} onChange={v=>update({finalChoice:v})}/></div>
        <div className="actions"><button className="primary-button" disabled={!game.finalChoice} onClick={()=>goto('results')}>לחשיפת התוצאה <ArrowLeft size={17}/></button></div>
      </section>}

      {game.stage==='results'&&<section className="section-flow results-flow">
        <div className="results-hero"><div className="results-eyebrow"><Flag size={17}/> המשימה הושלמה</div><div className="score-circle"><strong>{score.total}</strong><span>מתוך 100</span></div><h1>{score.profile}</h1><p>{score.profileDescription}</p><span className="score-caveat">ציון משחקי בלבד — אינו מנבא התאמה מקצועית או תעסוקתית.</span></div>
        <div className="panel"><h2>איך בנית את ההערכה?</h2><div className="score-bars">{[
          {l:'זיהוי עצמאי',v:score.independence,max:25},
          {l:'בעיית השורש והקשר הסיבתי',v:score.understanding,max:30},
          {l:'שקלול מסיחים וממתנים',v:score.judgment,max:20},
          {l:'החלטה פיקוחית',v:score.supervisory,max:25},
        ].map(row=><div className="score-row" key={row.l}><div><span>{row.l}</span><b dir="ltr">{row.v}/{row.max}</b></div><div className="bar-track"><div style={{width:`${row.v/row.max*100}%`}}/></div></div>)}{score.timePenalty>0&&<p className="muted small">חריגה ממגבלת 20 הדקות: <b dir="ltr">−{score.timePenalty}</b> מהציון הכולל.</p>}</div></div>
        <div className="insight-card"><span className="chapter-label">המפתח המקצועי</span><h2>הסיפור היה בשילוב, לא בנתון בודד.</h2><p>האשראי לציבור גדל מ־100 ל־145 מיליארד ₪, בזמן שהפיקדונות הקמעונאיים ירדו מ־90 ל־80 מיליארד ₪. הפער נתמך יותר באמצעות אג״ח ופיקדונות מגופים פיננסיים. זה עשוי לשנות את רגישות הבנק לעלות ולזמינות המימון, גם כשהנזילות הנוכחית גבוהה.</p><p>נתוני המח״מ, ביקושי ההנפקות, פיזור מחזיקי האג״ח ותוכנית המימון <strong>ממתנים</strong> את עוצמת החשש; הם אינם מוכיחים שהשינוי המבני לא התרחש. התייקרות מקורות ושחיקת מרווחים הן השלכות אפשריות, אך אינן מחליפות את בעיית השורש. ריכוזיות נדל״ן ראויה לבדיקה נפרדת.</p><p><strong>המהלך המועדף במשחק:</strong> בירור פיקוחי ממוקד של תוכנית המימון, תנאי לחץ, מועדי מחזור, יציבות המקורות והתאמתם לקצב האשראי — לא הכרזה מוקדמת על משבר.</p></div>
        <div className="panel debrief"><h2><ClipboardCopy size={19}/> תחקיר ההחלטות שלך</h2>
          <p className="muted"><b>מסלול חקירה:</b> {path==='advanced'?'זיהוי שני התחומים כבר בשלב הפתיחה':path==='credit'?'חקירת אשראי':path==='funding'?'חקירת מימון':'חקירה שהחלה בנושא משני'} · <b>רמזים:</b> {game.hintCount}{game.hintCount>0&&<> (הפחתה של {Math.min(10,game.hintCount*5)} נקודות מעצמאות)</>}</p>
          <ol className="debrief-list">{debrief(game).map(({step,verdict})=>{const text=scenario.debrief[step];return <li className={`debrief-item is-${verdict}`} key={step}>
            <div className="debrief-head"><h3>{text.title}</h3><span className="verdict">{VERDICT_LABEL[verdict]}</span></div>
            <p><b>בחרת:</b> {debriefChoice(step,game,path,secondId)}</p>
            {verdict!=='match'&&<p><b>ההכרעה המועדפת:</b> {typeof text.preferred==='string'?text.preferred:text.preferred[path==='general'?'decoy':path]}</p>}
            <p className="debrief-why">{text.why}</p>
          </li>;})}</ol>
        </div>
        <div className="share-panel"><h2>לשתף את האתגר?</h2><p>אפשר לפרסם את פרופיל המשחק בלי לחשוף את התשובה המקצועית, ולהזמין חברים לנסות.</p><div className="share-buttons"><button className="primary-button" onClick={share}><Share2 size={18}/> שיתוף / העתקת תוצאה</button><button className="outline-button" onClick={reset}><RefreshCcw size={17}/> לשחק שוב</button>{config.recruitmentUrl&&<a className="outline-button" href={config.recruitmentUrl} target="_blank" rel="noopener noreferrer">למשרות הפתוחות <ChevronLeft size={16}/></a>}</div>{shareStatus&&<p className="status-msg" role="status">{shareStatus}</p>}</div>
      </section>}

      {game.stage!=='intro'&&game.stage!=='signals'&&game.stage!=='results'&&path!=='advanced'&&<button className="evidence-fab" onClick={()=>setShowEvidence(v=>!v)} aria-expanded={showEvidence}><BookOpen size={17}/> הראיות שלי <span>{game.evidence.length}</span></button>}
      {showEvidence&&game.stage!=='results'&&game.stage!=='intro'&&<aside className="drawer" aria-label="הראיות שלי"><div className="drawer-header"><h3>הראיות שלי</h3><button onClick={()=>setShowEvidence(false)} aria-label="סגור">×</button></div>{game.evidence.length===0?<p>עדיין לא שמרת ראיות במסמכי החקירה.</p>:game.evidence.map(id=><p key={id} className="drawer-point">{evidenceIndex.get(id)?.text}</p>)}<small>אפשר לחזור למסמך הראשון ולעדכן את הבחירה.</small></aside>}
      {confirmReset&&<div className="modal-shade" role="presentation" onClick={()=>setConfirmReset(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={e=>e.stopPropagation()}><h2 id="reset-title">להתחיל מחדש?</h2><p>הפעולה תמחק את התקדמות המשחק השמורה בדפדפן.</p><div className="modal-actions"><button className="ghost-button" autoFocus onClick={()=>setConfirmReset(false)}>ביטול</button><button className="primary-button" onClick={reset}>כן, מתחילים מחדש</button></div></div></div>}
      <footer className="footer"><div className="footer-inner"><span dir="ltr">BANK UNDER PRESSURE</span><span>{scenario.disclaimer}</span></div></footer>
    </main>
  </div>;
}

export default App;
