import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync(new URL('../src/content/scenario.json',import.meta.url),'utf8'));
const metric=Object.fromEntries(data.metrics.map(v=>[v.id,v.values]));
const n=(key,i)=>Number(metric[key][i].replace('%',''));
for(let i=0;i<3;i++){
  assert.equal(n('retail',i)+n('business',i)+n('financial',i),n('deposits',i),'Deposits components');
  assert.equal(n('loans',i)+n('otherAssets',i),n('assets',i),'Assets components');
  assert.equal(n('deposits',i)+n('bonds',i)+n('equity',i),n('totalBalance',i),'Funding balance');
  assert.equal(n('assets',i),n('totalBalance',i),'Total balance');
}
assert.equal(data.metrics.length,21);
for(const [key,doc] of Object.entries(data.documents)){
  assert(doc.title&&doc.paragraphs.length>0,key);
  for(const e of doc.evidenceIds) assert(data.evidence.some(x=>x.id===e),`Unknown evidence ${e} in ${key}`);
  if(doc.keyEvidenceIds){
    assert.equal(doc.keyEvidenceIds.length,2,`${key} needs exactly 2 key evidence items`);
    for(const e of doc.keyEvidenceIds) assert(doc.evidenceIds.includes(e),`Key evidence ${e} not on ${key} board`);
  }
}
console.log(`Data validated: ${data.metrics.length} financial measures, ${Object.keys(data.documents).length} documents, ${data.evidence.length} evidence items; balance reconciles in all years.`);
