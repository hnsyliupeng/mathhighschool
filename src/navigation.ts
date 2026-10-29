export const PAGE_IDS=['workspace','tendon3d','materials3d','objects3d','hand3d','gripper3d','gripper','library','theory','validation'] as const
export type Page=typeof PAGE_IDS[number]

export interface AppLocation {page:Page;caseId:string;chapter:string;search:string}
/** Parse a deep link defensively; unknown pages and cases fall back in the app. */
export function parseAppLocation(url:URL):AppLocation{
  const raw=url.searchParams.get('page')
  const page=PAGE_IDS.find(p=>p===raw)||'workspace'
  return {page,caseId:url.searchParams.get('case')||'beam-gravity',chapter:url.searchParams.get('chapter')||'framework',search:url.searchParams.get('q')||''}
}
/** Build history entries without mutating the caller's URL or losing other query parameters. */
export function appLocationUrl(url:URL,page:Page,options:{caseId?:string;chapter?:string;search?:string}={}):URL{
  const next=new URL(url.href)
  next.searchParams.set('page',page)
  if(options.caseId!==undefined)next.searchParams.set('case',options.caseId)
  if(options.chapter!==undefined)next.searchParams.set('chapter',options.chapter)
  if(options.search!==undefined){if(options.search)next.searchParams.set('q',options.search);else next.searchParams.delete('q')}
  return next
}
