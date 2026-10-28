import katex from 'katex'
import 'katex/dist/katex.min.css'
export function MathBlock({formula,inline=false}:{formula:string;inline?:boolean}) {
  const html=katex.renderToString(formula,{throwOnError:false,displayMode:!inline,strict:'ignore'})
  return <span className={inline?'math-inline':'math-block'} dangerouslySetInnerHTML={{__html:html}} />
}
