import {readerStages} from "./reader-progression.mjs";
import {words} from "./i18n.mjs?v=evergreen-2";

const englishSurnames=Object.freeze({
  "Vacía":"Empty","Barnizada":"Glazed","Virgen":"Untouched","Húmeda":"Moist","Fértil":"Fertile","Abonada":"Enriched","Nutrida":"Nourished","Viva":"Living",
  "Dormida":"Sleeping","Latente":"Dormant","Palpitante":"Pulsing","Despierta":"Awake","Tímida":"Timid","Exploradora":"Exploring","Profunda":"Deep",
  "Naciente":"Budding","Incipiente":"Early","Emergente":"Emerging","Vigoroso":"Vigorous","Tierno":"Tender","Prometedor":"Promising","Fresco":"Fresh","Verde":"Green","Resistente":"Resilient",
  "Joven":"Young","Erguido":"Upright","Firme":"Firm","Robusto":"Sturdy","Inquebrantable":"Unyielding","Imponente":"Towering",
  "Tímido":"Timid","Protegido":"Protected","Resguardado":"Sheltered","Inquieto":"Restless","Silvestre":"Wild","Inmaduro":"Unripe","Maduro":"Mature","Paciente":"Patient","Impaciente":"Eager",
  "Delicada":"Delicate","Colorida":"Colorful","Fragante":"Fragrant","Radiante":"Radiant","Exuberante":"Lush","Resplandeciente":"Resplendent","Majestuosa":"Majestic","Espléndida":"Splendid"
});

export function readerLevelName({stage,fullName},language) {
  if(language!=="en") return fullName;
  const entry=readerStages.find(item=>item.id===stage);
  if(!entry || !fullName.startsWith(entry.name+" ")) return fullName;
  const noun=words.en[`mascotName${stage[0].toUpperCase()}${stage.slice(1)}`];
  const surname=fullName.slice(entry.name.length+1);
  if(stage==="evergreen") return `${noun} ${surname}`;
  const [adjective,numeral]=surname.split(" ");
  return englishSurnames[adjective] ? `${englishSurnames[adjective]} ${noun}${numeral?" "+numeral:""}` : fullName;
}
