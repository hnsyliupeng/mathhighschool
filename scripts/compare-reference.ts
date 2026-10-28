import { compareReferences, referenceMetadata } from '../src/engine/reference'
const checks=compareReferences()
console.log(`Reference: ${referenceMetadata.reference_commit} (${referenceMetadata.runner})`)
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.name}: ${check.detail}`)
  if(check.conditional)console.log(`  ${check.conditional.pass?'PASS':'FAIL'} CONDITIONAL (not an independent trajectory): ${check.conditional.detail}`)
}
if(checks.some(c=>!c.pass||(c.conditional&&!c.conditional.pass))) process.exitCode=1
