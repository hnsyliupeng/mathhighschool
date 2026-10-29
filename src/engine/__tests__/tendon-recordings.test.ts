import {describe,expect,it} from 'vitest'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'

type Report={params:{dt:number;duration:number;verifyCCD:boolean};sourceHash:string;sourceChanged:boolean;sourceFiles:string[];referenceHash:string;steps:number;error:string;certifiedEveryAcceptedStep:boolean;summary:{retained:boolean;minFinalRise:number;minFinalContacts:number;thumbStayed:boolean;maxPenetration:number;maxStrain:number;lastRelativeRise:number;tailRelativeDrift:number;verifiedCCD:boolean};history:{time:number;rise:number;wristRise:number;contactFingers:number;thumb:boolean;maxPenetration:number;maxStructuralStrain:number;verifiedCCD:boolean}[]}
type Recording={params:Report['params'];sourceHash:string;referenceHash:string;steps:number;certifiedEveryAcceptedStep:boolean;summary:Report['summary'];frames:{time:number;rise:number;wristRise:number;contactFingers:number;thumbContact:boolean;verifiedCCD:boolean;finite:boolean}[]}
const read=<T>(path:string)=>JSON.parse(readFileSync(path,'utf8')) as T
const cases=[
  ['egg','docs/screenshots/tendon-dynamic-egg-ccd.json','src/data/tendon-egg-recording.json'],
  ['screwdriver','docs/screenshots/tendon-dynamic-screwdriver-opposed-ccd.json','src/data/tendon-screwdriver-recording.json'],
  ['bottle cap','docs/screenshots/tendon-dynamic-cap-opposed-ccd.json','src/data/tendon-cap-recording.json'],
] as const

describe('sampled tendon recordings and original full-step reports',()=>{
  it.each(cases)('%s matches unchanged listed sources and a complete CCD history',(_name,reportPath,recordingPath)=>{
    const report=read<Report>(reportPath),recording=read<Recording>(recordingPath),hash=createHash('sha256')
    for(const file of report.sourceFiles)hash.update(file).update(readFileSync(file))
    expect(report.sourceChanged).toBe(false);expect(report.error).toBe('');expect(hash.digest('hex')).toBe(report.sourceHash)
    expect(recording.sourceHash).toBe(report.sourceHash);expect(recording.referenceHash).toBe(report.referenceHash);expect(recording.params).toEqual(report.params);expect(recording.summary).toEqual(report.summary)
    expect(recording.steps).toBe(report.steps);expect(report.steps).toBe(Math.ceil(report.params.duration/report.params.dt-1e-10));expect(report.history).toHaveLength(report.steps+1)
    expect(report.params.verifyCCD&&report.certifiedEveryAcceptedStep&&recording.certifiedEveryAcceptedStep).toBe(true)
    for(let i=0;i<report.history.length;i++){
      const f=report.history[i];expect(f.time).toBeCloseTo(Math.min(i*report.params.dt,report.params.duration),9)
      expect([f.rise,f.wristRise,f.maxPenetration,f.maxStructuralStrain].every(Number.isFinite)).toBe(true)
      if(i>0)expect(f.verifiedCCD).toBe(true)
    }
    const end=report.history.at(-1)!,tail=report.history.filter(f=>f.time>=end.time-.2),relative=tail.map(f=>f.rise-f.wristRise)
    expect(report.summary.minFinalRise).toBeCloseTo(Math.min(...tail.map(f=>f.rise)),12)
    expect(report.summary.minFinalContacts).toBe(Math.min(...tail.map(f=>f.contactFingers)))
    expect(report.summary.thumbStayed).toBe(tail.every(f=>f.thumb))
    expect(report.summary.tailRelativeDrift).toBeCloseTo(Math.max(...relative)-Math.min(...relative),12)
    expect(report.summary.lastRelativeRise).toBeCloseTo(end.rise-end.wristRise,12)
    expect(report.summary.maxPenetration).toBeCloseTo(Math.max(...report.history.map(f=>f.maxPenetration)),12)
    expect(report.summary.maxStrain).toBeCloseTo(Math.max(...report.history.map(f=>f.maxStructuralStrain)),12)
    expect(report.summary.retained).toBe(report.summary.minFinalRise>=.025&&report.summary.minFinalContacts>=2&&report.summary.thumbStayed&&report.summary.tailRelativeDrift<=.01&&report.summary.verifiedCCD&&report.summary.maxPenetration<=.00025)
    expect(recording.frames).toHaveLength(12)
    for(const frame of recording.frames){
      const step=report.history.find(f=>Math.abs(f.time-frame.time)<1e-9);expect(step).toBeDefined()
      expect(frame.finite).toBe(true);expect(frame.rise).toBeCloseTo(step!.rise,12);expect(frame.wristRise).toBeCloseTo(step!.wristRise,12);expect(frame.contactFingers).toBe(step!.contactFingers);expect(frame.thumbContact).toBe(step!.thumb)
      if(frame.time>0)expect(frame.verifiedCCD).toBe(true)
    }
  })
})
