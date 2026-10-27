import scenario from '../content/scenario.json';
import type { GameState, Path, ScoreBreakdown } from './types';

export const TIME_LIMIT_MS = 20 * 60 * 1000;
export const STORE_KEY = 'bank-under-pressure-v8';
export const stages = ['intro', 'signals', 'first', 'second', 'analysis', 'decision', 'results'] as const;
export const evidenceIndex = new Map(scenario.evidence.map(x => [x.id, x]));
export const creditSignals = new Set(['loans']);
export const fundingSignals = new Set(['retail', 'financial', 'bonds', 'deposits', 'business', 'nsfr']);

export function initialState(): GameState {
  return {
    version: 8, stage: 'intro', startedAt: null, selectedSignals: [], evidence: [],
    recoveryChoice: null, hintCount: 0, secondTake: null, selectedRoots: [],
    causalChoice: null, cfoChoice: null, secondaryChoice: null, finalChoice: null,
    advancedReselected: false, overtime: false,
  };
}

export function pathForSignals(ids: readonly string[]): Path {
  if (ids.includes('loans') && ids.some(x => fundingSignals.has(x))) return 'advanced';
  if (ids.includes('loans')) return 'credit';
  if (ids.some(x => fundingSignals.has(x))) return 'funding';
  if (ids.length) return 'decoy';
  return 'general';
}

export function decoyDocument(ids: readonly string[]): string {
  // Every decoy selection opens the same combined credit-and-funding review.
  void ids;
  return 'decoy_general';
}

export function firstDocId(s: GameState): string {
  const path = pathForSignals(s.selectedSignals);
  if (path === 'advanced') return 'balance';
  if (path === 'credit') return 'credit';
  if (path === 'funding') return 'funding';
  return decoyDocument(s.selectedSignals);
}

// Changing the opening signals can swap the first document; evidence and the
// manager's answer that belonged to the old document must not carry over.
export function withSignals(s: GameState, selectedSignals: string[]): GameState {
  const next = {...s, selectedSignals};
  const nextDoc = firstDocId(next);
  if (nextDoc === firstDocId(s)) return next;
  const allowed = new Set<string>(scenario.documents[nextDoc as keyof typeof scenario.documents].evidenceIds);
  return {...next, evidence: s.evidence.filter(id => allowed.has(id)), recoveryChoice: null};
}

export function recognizedBoth(s: GameState): boolean {
  const credit = s.selectedSignals.includes('loans') || s.evidence.some(id => evidenceIndex.get(id)?.domain === 'credit');
  const funding = s.selectedSignals.some(id => fundingSignals.has(id)) || s.evidence.some(id => evidenceIndex.get(id)?.domain === 'funding');
  return credit && funding;
}

export function secondDocId(s: GameState): string | null {
  const path = pathForSignals(s.selectedSignals);
  if (path === 'advanced' || (path !== 'decoy' && recognizedBoth(s))) return 'advanced';
  if (path === 'credit') return 'alco';
  if (path === 'funding') return 'creditPlan';
  if (path === 'decoy' || path === 'general') {
    if (s.recoveryChoice === 'none') return null;
    if (s.recoveryChoice === 'credit') return 'credit';
    if (s.recoveryChoice === 'funding') return 'funding';
    return 'treasury';
  }
  return 'treasury';
}

export const rootCards = [
  {id:'credit_growth', text:'צמיחת האשראי המואצת מגדילה את צורכי המימון של הבנק.', points:8},
  {id:'funding_shift', text:'שחיקה בפיקדונות הקמעונאיים ומעבר למימון באמצעות גופים פיננסיים ואג״ח.', points:8},
  {id:'growth_gap', text:'פער מהותי בין קצב צמיחת האשראי לקצב גידול סך הפיקדונות.', points:6},
  {id:'sector', text:'העלייה בחשיפת הבינוי והנדל״ן היא בעיית השורש המרכזית.', points:-5},
  {id:'margin', text:'שחיקת המרווח על אשראי חדש עקב תחרות היא בעיית השורש המרכזית.', points:-5},
  {id:'impaired', text:'העלייה המתונה בשיעור האשראי הפגום היא בעיית השורש.', points:-4},
  {id:'roe', text:'הרווחיות הגבוהה היא ההסבר המרכזי לשינוי הסיכון.', points:-3},
  {id:'capital', text:'השיפור ביחסי ההון הוא בעיית השורש.', points:-3},
  {id:'liquidity', text:'LCR גבוה מוכיח שלא ייתכן שינוי בסיכון המימון.', points:-3},
  {id:'costs', text:'העלייה בהוצאות התפעול היא בעיית השורש.', points:-2},
  {id:'audit', text:'ממצא ביקורת תפעולי נקודתי מסביר את השינוי במימון.', points:-3},
  {id:'bond_crisis', text:'עצם גיוס האג״ח מוכיח מצוקת נזילות.', points:-5},
  {id:'credit_bad', text:'צמיחת אשראי לבדה מוכיחה כשל חיתום.', points:-5},
];

const clamp = (n:number, min:number, max:number) => Math.max(min, Math.min(max, n));

export function scoreGame(s: GameState): ScoreBreakdown {
  const hasCredit = s.selectedSignals.includes('loans');
  const hasFunding = s.selectedSignals.some(id => fundingSignals.has(id));
  const early = (hasCredit ? 8 : 0) + (hasFunding ? 8 : 0) + (hasCredit && hasFunding ? 4 : 0);
  const selectedDomains = new Set(s.evidence.map(id => evidenceIndex.get(id)?.domain));
  const evidenceBonus = selectedDomains.has('credit') && selectedDomains.has('funding') ? 5 :
    (selectedDomains.has('credit') || selectedDomains.has('funding') ? 2 : 0);
  // Single-domain paths must spot the two key items from the opposite domain:
  // both found earns 7 (keeping these paths within 10 points of the advanced
  // maximum); each one missed costs 3 instead.
  const path = pathForSignals(s.selectedSignals);
  const firstDoc = scenario.documents[firstDocId(s) as keyof typeof scenario.documents] as {keyEvidenceIds?: string[]};
  const keys = (path === 'credit' || path === 'funding') ? firstDoc.keyEvidenceIds ?? [] : [];
  // The advanced path has no evidence board: holding the opening call earns the
  // same 5 points, and backing off it after management's reassurance costs 3.
  const evidencePart = path === 'advanced' ? 5 :
    keys.length ? (keys.every(id => s.evidence.includes(id)) ? 7 : -3 * keys.filter(id => !s.evidence.includes(id)).length) : evidenceBonus;
  const reselectPenalty = s.advancedReselected ? 3 : 0;
  const independence = clamp(early + evidencePart - reselectPenalty - s.hintCount * 5, 0, 25);

  const rootPoints = rootCards.filter(x => s.selectedRoots.includes(x.id)).reduce((a,b) => a+b.points,0);
  const understanding = clamp(rootPoints + (s.causalChoice === 'balanced' ? 8 : 0), 0, 30);

  // The same maximum (20) is available in every path; the advanced-path trap is
  // intentionally graded within, not on top of, the common judgment component.
  const secondTake = s.secondTake === 'balanced' ? 5 : 0;
  const cfo = s.cfoChoice === 'balanced' ? 10 : s.cfoChoice === 'dismiss' ? 2 : 0;
  const secondary = s.secondaryChoice === 'sector' || s.secondaryChoice === 'margin' ? 5 : 0;
  const judgment = secondTake + cfo + secondary;

  const supervisory = s.finalChoice === 'inquiry' ? 25 : s.finalChoice === 'monitor' ? 10 :
    s.finalChoice === 'remediation' ? 7 : 0;
  // Running past the 20-minute countdown never ends the game; it costs 5 points.
  const timePenalty = s.overtime ? 5 : 0;
  const total = Math.max(0, independence + understanding + judgment + supervisory - timePenalty);
  const profile = total >= 85 ? 'מצפן חד' : total >= 70 ? 'מחבר נקודות' : total >= 50 ? 'חוקר זהיר' : 'מאתר כיוונים';
  const profileDescription = total >= 85 ? 'זיהית קשרים מהותיים, בחנת ראיות ממתנות והגעת להחלטה מידתית.' :
    total >= 70 ? 'חיברת חלק גדול מהתמונה והפעלת שיקול דעת מול מידע מתחרה.' :
    total >= 50 ? 'בחנת כמה כיוונים רלוונטיים. האתגר הבא הוא להבחין בין שורש הבעיה לסיכון משני.' :
    'התנסית בסינון מידע מורכב. נסה שוב והתמקד בשינויים המשותפים לשני צדי המאזן.';
  return {independence, understanding, judgment, supervisory, timePenalty, total, profile, profileDescription};
}

export function validSavedState(raw:unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Partial<GameState>;
  const base = initialState();
  if (x.version !== 8 || !x.stage || !stages.includes(x.stage)) return null;
  if (!Array.isArray(x.selectedSignals) || !Array.isArray(x.evidence) || !Array.isArray(x.selectedRoots)) return null;
  if (x.selectedSignals.length > 3 || x.evidence.length > 2) return null;
  if (typeof x.hintCount !== 'number' || x.hintCount < 0 || x.hintCount > 2) return null;
  if (!x.selectedSignals.every(v => typeof v === 'string') || !x.evidence.every(v => typeof v === 'string')) return null;
  return {...base, ...x};
}

export function finalFacts() {
  return [
    'אשראי לציבור עלה מ־100 ל־145 מיליארד ₪ (2023–2025).',
    'סך הפיקדונות עלה מ־105 ל־115 מיליארד ₪; פיקדונות קמעונאיים ירדו מ־90 ל־80 מיליארד ₪.',
    'פיקדונות מגופים פיננסיים עלו מ־0 ל־16 מיליארד ₪; יתרת האג״ח עלתה מ־5 ל־32 מיליארד ₪.',
    'LCR: 145%; NSFR: 116%; CET1: 13.1%; תשואה להון: 16.0%.',
    '60% מהאג״ח לפירעון בטווח שיורי מעל שלוש שנים; פיזור משקיעים, ביקושים בהנפקות ותוכנית מימון מאושרת.',
    'המרווח על אשראי חדש נשחק עקב תחרות; חלק ממקורות המימון החדשים יקרים יותר.',
    'קיימת אי־ודאות לגבי זמינות ועלות מקורות מימון חדשים בעת לחץ אם צמיחת האשראי תימשך.'
  ];
}
