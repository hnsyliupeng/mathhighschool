import {describe,expect,it} from 'vitest'
import {appLocationUrl,parseAppLocation,PAGE_IDS} from '../../navigation'

describe('app deep links and history URLs',()=>{
  it('round-trips every route, case, theory chapter and search query',()=>{
    for(const page of PAGE_IDS){
      const original=new URL('https://example.test/lab?keep=yes#view')
      const next=appLocationUrl(original,page,{caseId:'rod-helix',chapter:'rod',search:'柔性 杆'})
      expect(parseAppLocation(next)).toEqual({page,caseId:'rod-helix',chapter:'rod',search:'柔性 杆'})
      expect(next.searchParams.get('keep')).toBe('yes');expect(next.hash).toBe('#view')
      expect(original.searchParams.has('page')).toBe(false)
    }
  })
  it('falls back for unknown pages and clears an empty search',()=>{
    const original=new URL('https://example.test/?page=missing&q=old')
    expect(parseAppLocation(original)).toEqual({page:'workspace',caseId:'beam-gravity',chapter:'framework',search:'old'})
    const next=appLocationUrl(original,'library',{search:''});expect(next.searchParams.has('q')).toBe(false)
  })
})
