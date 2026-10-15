const titles=Object.freeze({es:"Notas de lectura",en:"Reading notes"});

export function defaultNoteDeckTitle(language) {
  return titles[language] || titles.es;
}
