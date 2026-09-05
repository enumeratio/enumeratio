import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const R = '/Users/dlandolt/Playground/ideas/enumeratio'
const db = new PGlite()
await db.exec(readFileSync(`${R}/db/meta.sql`, 'utf8'))
await db.exec(readFileSync(`${R}/db/base.sql`, 'utf8'))
await db.exec(readFileSync(`${R}/db/window.sql`, 'utf8'))
await db.exec(readFileSync(`${R}/src/seed/permutations.sql`, 'utf8'))
const q = async (s, p) => (await db.query(s, p)).rows
const counts = []
for (let n=0;n<=8;n++) counts.push(Number((await q('SELECT permutation_count($1) c',[n]))[0].c))
console.log('count 0..8:', counts.join(','), '| A000142:', JSON.stringify(counts)===JSON.stringify([1,1,2,6,24,120,720,5040,40320]))
for (const n of [4,5,6]) {
  const rows=await q(`SELECT row_kind,sub_count FROM enum_window('permutations','by_inversions',$1)`,[n])
  const leaves=rows.filter(r=>r.row_kind==='leaf').length
  const subs=rows.filter(r=>r.row_kind==='subtotal').reduce((a,r)=>a+Number(r.sub_count),0)
  console.log(`n=${n}: leaves=${leaves} subSum=${subs} count=${counts[n]}`, leaves===counts[n]&&subs===counts[n]?'OK':'FAIL')
}
{
  const rows=await q(`SELECT grade_address,representation FROM enum_window('permutations','by_inversions',6) WHERE row_kind='leaf'`,[])
  const byK={}; let mism=false
  for(const r of rows){const k=r.grade_address[1];const inv=(await q('SELECT permutation_inversions($1::int[]) v',[r.representation]))[0].v;if(inv!==k)mism=true;byK[k]=(byK[k]||0)+1}
  let ok=!mism
  for(const k of Object.keys(byK)){const cheap=Number((await q('SELECT permutation_count_by_inversions(6,$1) c',[Number(k)]))[0].c);if(cheap!==byK[k])ok=false}
  console.log('n=6 cheap===definitional & inv-consistent:', ok?'OK':'FAIL')
}
const t0=performance.now()
const slice=await q(`SELECT row_kind,grade_address,representation FROM enum_window('permutations','by_inversions',200,0,6)`,[])
console.log(`n=200 slice[0,6] in ${(performance.now()-t0).toFixed(1)}ms rows=${slice.length}`)
console.log('  ',slice.map(r=>r.row_kind+' k'+r.grade_address[1]+(r.representation?' len'+r.representation.length:'')).join(' | '))
{
  const wanted=[]
  for(let r=0;r<120;r++){const p=(await q('SELECT permutation_unrank(5,$1) v',[r]))[0].v;const inv=(await q('SELECT permutation_inversions($1::int[]) v',[p]))[0].v;if(inv===3)wanted.push(JSON.stringify(p))}
  const got=[]; const tot=Number((await q('SELECT permutation_count_by_inversions(5,3) c'))[0].c)
  for(let r=0;r<tot;r++) got.push(JSON.stringify((await q('SELECT permutation_grade_unrank(5,3,$1) v',[r]))[0].v))
  console.log('n=5 k=3 grade_unrank==global-lex-restricted:', JSON.stringify(wanted)===JSON.stringify(got)?'OK':'FAIL')
}
// subtotal-only large-n (max_depth=1) covers full inversion range without materializing leaves
const t1=performance.now()
const subsOnly=await q(`SELECT count(*) c, max((grade_address)[2]) mk FROM enum_window('permutations','by_inversions',20,0,NULL,1)`,[])
console.log(`n=20 subtotals-only: ${subsOnly[0].c} grades, maxk=${subsOnly[0].mk} (expect 191) in ${(performance.now()-t1).toFixed(0)}ms`)
console.log('grade_unrank(0,0,0)=',JSON.stringify((await q('SELECT permutation_grade_unrank(0,0,0) v'))[0].v))
console.log('impl backfilled:',Number((await q(`SELECT count(*) c FROM implementation WHERE func_id LIKE 'permutation%'`))[0].c))
// regression: compositions
await db.exec(readFileSync(`${R}/src/seed/integer_compositions.sql`, 'utf8'))
for(const n of [4,6,8]){const rows=await q(`SELECT row_kind,sub_count FROM enum_window('integer_compositions','by_num_parts',$1)`,[n]);const leaves=rows.filter(r=>r.row_kind==='leaf').length;const subs=rows.filter(r=>r.row_kind==='subtotal').reduce((a,r)=>a+Number(r.sub_count),0);const c=Number((await q('SELECT integer_composition_count($1) c',[n]))[0].c);console.log(`compositions n=${n}: leaves=${leaves} subSum=${subs} count=${c}`,leaves===c&&subs===c?'OK':'FAIL')}
