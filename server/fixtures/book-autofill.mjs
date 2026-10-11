export const bookMetadata={
  originalTitle:"Thinking, Fast and Slow",originalLanguage:"en",
  title:{es:"Pensar rápido, pensar despacio",en:"Thinking, Fast and Slow",fr:"Système 1 / Système 2"},
  shortTitle:{es:"Pensar rápido, pensar despacio",en:"Thinking, Fast and Slow",fr:"Système 1 / Système 2"},
  description:{es:"Un libro sobre cómo pensamos y tomamos decisiones.",en:"A book about thinking and decision-making.",fr:"Un livre sur la pensée et la prise de décision."},
  editorialNote:{es:"Ficha basada en las fuentes consultadas.",en:"Details based on consulted sources.",fr:"Fiche fondée sur les sources consultées."},
  genres:["personal-growth"],links:{goodreads:"https://www.goodreads.com/book/show/11468377-thinking-fast-and-slow"},
  sources:[{title:"Publisher",url:"https://publisher.example/thinking-fast-and-slow"},{title:"Goodreads",url:"https://www.goodreads.com/book/show/11468377-thinking-fast-and-slow"}]
};
export function researchResponse() {
  return {status:"completed",output:[
    {type:"web_search_call",action:{type:"search",sources:bookMetadata.sources}},
    {type:"message",content:[{type:"output_text",text:"Thinking, Fast and Slow, Daniel Kahneman, originally published in English. Verified translated titles and a brief description.",annotations:bookMetadata.sources.map(source=>({type:"url_citation",...source}))}]}
  ]};
}
export function extractionResponse(overrides={}) {
  const value={status:"matched",originalTitle:bookMetadata.originalTitle,originalLanguage:"en",author:"Daniel Kahneman",
    translations:Object.fromEntries(["es","en","fr"].map(language=>[language,Object.fromEntries(["title","shortTitle","description","editorialNote"].map(field=>[field,bookMetadata[field][language]]))])),
    genres:bookMetadata.genres,links:{amazon:null,goodreads:bookMetadata.links.goodreads},...overrides};
  return {status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]};
}
