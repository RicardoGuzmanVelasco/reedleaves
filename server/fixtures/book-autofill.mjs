export const bookMetadata={
  popularTitle:"Thinking, Fast and Slow",popularLanguage:"en",
  title:{es:"Pensar rápido, pensar despacio",en:"Thinking, Fast and Slow"},
  description:{es:"Un libro sobre cómo pensamos y tomamos decisiones.",en:"A book about thinking and decision-making."},
  editorialNote:{es:"Título de la edición española.",en:"Original English edition."},
  genres:["personal-growth"],links:{goodreads:"https://www.goodreads.com/book/show/11468377-thinking-fast-and-slow"}
};
export function researchResponse() {
  return {status:"completed",output:[
    {type:"web_search_call",action:{type:"search"}},
    {type:"message",content:[{type:"output_text",text:"Thinking, Fast and Slow, Daniel Kahneman, originally published in English. Verified translated titles and a brief description.",annotations:[{type:"url_citation",title:"Goodreads",url:bookMetadata.links.goodreads}]}]}
  ]};
}
export function extractionResponse(overrides={}) {
  const value={status:"matched",popularTitle:bookMetadata.popularTitle,popularSubtitle:null,popularLanguage:"en",author:"Daniel Kahneman",
    translations:Object.fromEntries(["es","en"].map(language=>[language,{...Object.fromEntries(["title","description","editorialNote"].map(field=>[field,bookMetadata[field][language]])),subtitle:null,alternateTitle:null}])),
    genres:bookMetadata.genres,links:{amazon:null,goodreads:bookMetadata.links.goodreads},...overrides};
  return {status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]};
}
