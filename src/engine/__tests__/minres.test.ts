import {describe,it,expect} from 'vitest'
import {minres} from '../minres'

describe('symmetric-indefinite MINRES fallback',()=>{
  it('solves a nonsingular indefinite system and verifies the true residual',()=>{
    const matrix=[[0,1,0],[1,0,1],[0,1,2]],expected=[2,-1,3]
    const apply=(x:Float64Array,out:Float64Array)=>{for(let i=0;i<3;i++)out[i]=matrix[i].reduce((sum,a,j)=>sum+a*x[j],0)}
    const b=new Float64Array(3);apply(Float64Array.from(expected),b)
    const result=minres(b,apply,Float64Array.from([1,1,2]),100)
    expect(result.converged).toBe(true);expect(result.residual).toBeLessThan(1e-9)
    result.x.forEach((v,i)=>expect(v).toBeCloseTo(expected[i],9))
  })
  it('does not silently accept an unsolvable singular system or invalid preconditioner',()=>{
    const apply=(_x:Float64Array,out:Float64Array)=>{out.fill(0)}
    const result=minres(Float64Array.from([1,0]),apply,Float64Array.from([1,1]),10)
    expect(result.converged).toBe(false);expect(result.residual).toBeCloseTo(1)
    expect(()=>minres(Float64Array.from([1,0]),apply,Float64Array.from([-1,1]))).toThrow()
  })
})
