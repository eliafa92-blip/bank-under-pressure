import { describe, expect, it } from 'vitest';
import { firstDocId, initialState, pathForSignals, recognizedBoth, rootCards, scoreGame, secondDocId, validSavedState, withSignals } from './engine';

const s = initialState();
describe('game routes', () => {
  it('chooses all opening paths without forcing three metrics', () => {
    expect(pathForSignals([])).toBe('general');
    expect(pathForSignals(['roe'])).toBe('decoy');
    expect(pathForSignals(['loans'])).toBe('credit');
    expect(pathForSignals(['retail'])).toBe('funding');
    expect(pathForSignals(['loans','financial'])).toBe('advanced');
  });
  it('routes the skilled player to two distractors', () => {
    const x = {...s, selectedSignals:['loans','retail']};
    expect(firstDocId(x)).toBe('balance');
    expect(secondDocId(x)).toBe('advanced');
  });
  it('shows independent corroboration when only credit or funding identified', () => {
    expect(secondDocId({...s,selectedSignals:['loans']})).toBe('alco');
    expect(secondDocId({...s,selectedSignals:['bonds']})).toBe('creditPlan');
  });
  it('rewards linkage found from evidence and allows decoy recovery', () => {
    const c = {...s, selectedSignals:['loans'], evidence:['deposit_gap','wholesale_growth']};
    expect(recognizedBoth(c)).toBe(true);
    expect(secondDocId(c)).toBe('advanced');
    const d = {...s,selectedSignals:['concentration'],recoveryChoice:'funding' as const};
    expect(firstDocId(d)).toBe('decoy_general');
    expect(secondDocId(d)).toBe('funding');
    expect(secondDocId({...d,recoveryChoice:'none'})).toBeNull();
  });
});
describe('changing opening signals', () => {
  it('drops evidence and manager answer that belong to the previous first document', () => {
    const adv={...s,selectedSignals:['loans'],evidence:['sector','deposit_gap']};
    const decoy=withSignals(adv,['roe']);
    expect(firstDocId(decoy)).toBe('decoy_general');
    expect(decoy.evidence).toEqual(['deposit_gap']);
    expect(withSignals({...decoy,recoveryChoice:'funding'},['loans']).recoveryChoice).toBeNull();
  });
  it('keeps evidence when the first document is unchanged', () => {
    const x={...s,selectedSignals:['loans'],evidence:['sector','deposit_gap']};
    expect(withSignals(x,['loans','roe']).evidence).toEqual(['sector','deposit_gap']);
  });
});
describe('fair scoring', () => {
  it('keeps single-domain best within 10 points of the advanced best', () => {
    const common={selectedRoots:['credit_growth','funding_shift','growth_gap'],causalChoice:'balanced' as const,secondTake:'balanced' as const,cfoChoice:'balanced' as const,secondaryChoice:'sector' as const,finalChoice:'inquiry' as const};
    const adv=scoreGame({...s,...common,selectedSignals:['loans','retail']}).total;
    const credit=scoreGame({...s,...common,selectedSignals:['loans'],evidence:['deposit_gap','wholesale_growth']}).total;
    expect(adv-credit).toBe(10);
  });
  it('charges 3 points per missed opposite-domain key evidence', () => {
    const credit={...s,selectedSignals:['loans']};
    expect(scoreGame({...credit,evidence:['deposit_gap','wholesale_growth']}).independence).toBe(15);
    expect(scoreGame({...credit,evidence:['deposit_gap','sector']}).independence).toBe(5);
    expect(scoreGame(credit).independence).toBe(2);
    const funding={...s,selectedSignals:['retail']};
    expect(scoreGame({...funding,evidence:['credit_growth','credit_acceleration']}).independence).toBe(15);
    expect(scoreGame({...funding,evidence:['capital_buffers']}).independence).toBe(2);
  });
  it('does not penalize investigation of decoys', () => {
    const x={...s,selectedSignals:['loans','retail']};
    expect(scoreGame(x).independence).toBe(25);
    expect(scoreGame({...x,selectedSignals:['loans','retail','concentration']}).independence).toBe(25);
  });
  it('deducts 5 from the total after the 20-minute limit', () => {
    const x={...s,selectedSignals:['loans','retail'],finalChoice:'inquiry' as const};
    expect(scoreGame(x).total-scoreGame({...x,overtime:true}).total).toBe(5);
  });
  it('charges 3 points for backing off the advanced call', () => {
    const x={...s,selectedSignals:['loans','retail']};
    expect(scoreGame({...x,advancedReselected:true}).independence).toBe(22);
    const credit={...s,selectedSignals:['loans'],evidence:['deposit_gap','wholesale_growth'],advancedReselected:true};
    expect(scoreGame(credit).independence).toBe(12);
  });
  it('penalizes explicit help only in independence', () => {
    const x={...s,selectedSignals:['loans','retail']};
    const before=scoreGame(x); const after=scoreGame({...x,hintCount:2});
    expect(before.independence-after.independence).toBe(10);
    expect(before.understanding).toBe(after.understanding);
    expect(before.judgment).toBe(after.judgment);
    expect(before.supervisory).toBe(after.supervisory);
  });
  it('cannot game root question by selecting everything', () => {
    const x={...s,selectedRoots:rootCards.map(c=>c.id),causalChoice:'balanced' as const};
    expect(scoreGame(x).understanding).toBe(0);
  });
  it('awards full score for independent well-supported supervision', () => {
    const x={...s,selectedSignals:['loans','retail'],evidence:['credit_growth','retail_erosion'],selectedRoots:['credit_growth','funding_shift','growth_gap'],causalChoice:'balanced' as const,secondTake:'balanced' as const,cfoChoice:'balanced' as const,secondaryChoice:'sector' as const,finalChoice:'inquiry' as const};
    expect(scoreGame(x).total).toBe(100);
  });
  it('has one final decision key independent of path', () => {
    expect(scoreGame({...s,selectedSignals:['loans'],finalChoice:'inquiry'}).supervisory).toBe(25);
    expect(scoreGame({...s,selectedSignals:['newMargin'],finalChoice:'inquiry'}).supervisory).toBe(25);
  });
});
describe('persistence validation', () => {
  it('rejects other schemas and invalid selections', () => {
    expect(validSavedState({...s,version:7})).toBeNull();
    expect(validSavedState({...s, selectedSignals:['a','b','c','d']})).toBeNull();
    expect(validSavedState({...s, hintCount:3})).toBeNull();
    expect(validSavedState(s)?.version).toBe(8);
  });
});
