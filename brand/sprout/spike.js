"use strict";

const copy = {
  es: {
    exploration:"Exploración de marca",eyebrow:"LECTURA × CRECIMIENTO PERSONAL",headline:'De hoja<br>a hoja<span class="dot">.</span>',lead:"Una página que se convierte en una planta. Una idea que se queda contigo.",try:'Dale vida al símbolo <span aria-hidden="true">↓</span>',visualPhrase:"PEQUEÑAS IDEAS. ESPACIO PARA CRECER.",heroNote:"La misma forma.<br>Dos maneras de verla.",routesEyebrow:"01 / FORMA",routesTitle:"Tres maneras de brotar.",routesIntro:"Elige una para probar su personalidad.<br>El nombre sigue abierto.",seedName:"Semilla",seedTag:"Más compañero",seedDesc:"Una idea pequeña, lista para crecer.",leafName:"Hoja / página",leafTag:"Más producto",leafDesc:"Un libro que también es un brote.",loopName:"Bucle vivo",loopTag:"Más abstracto",loopDesc:"Volver a una idea. Dejarla crecer.",recommendation:"RECOMENDADA",sizeCaption:"MISMA SILUETA, CUALQUIER TAMAÑO",oneColor:"Un color",labEyebrow:"02 / PERSONALIDAD",labTitle:"El logo te mira.",labIntro:"Dos ojos. Un gesto. La misma silueta.<br>Una mascota que acompaña la lectura.",characterLabel:"EL COMPAÑERO",wake:"Convertir en mascota",sleep:"Volver al símbolo",logoState:"Símbolo",helloState:"Saludo",readingState:"Lectura",celebrateState:"Celebración",productLabel:"EN LA APP / DEMO DE LECTURA",today:"HOY",daily:"Tu idea del día",notebook:"CUADERNO DE EJEMPLO",cardTitle:"Hazlo fácil para tu yo de mañana.",cardBody:"Deja preparado el primer paso de lo que quieres hacer. Una pequeña decisión hoy puede ayudarte a empezar mañana.",detail:"Ver un ejemplo",detailBody:"Si quieres leer por la mañana, deja el libro donde desayunas.",review:'Ya la he leído <span aria-hidden="true">✓</span>',reread:"Volver a leer",readingHint:"Una idea. Un momento para ti.",reviewedHint:"Idea revisada. Vuelve cuando quieras.",prototypeNote:"Nombre provisional · Texto original de ejemplo · Estado temporal",storyEyebrow:"03 / LENGUAJE",storyTitle:"Crecer también cabe<br>en pocas palabras.",storyIntro:"El juego visual cruza idiomas.<br>El texto se adapta a cada uno.",namingEyebrow:"04 / NOMBRE ABIERTO",namingTitle:"¿Cómo se llama algo que empieza a crecer?",broteReason:"Cercano. Crecimiento claro en ES.",sproutReason:"La metáfora directa en EN.",leafiReason:"Hoja / página. Suena a compañero.",saviaReason:"Conocimiento que alimenta.",nameNote:"Son candidatos de concepto; su disponibilidad está pendiente.",footer:"Poco que hacer. Mucho que sentir.",fullSpike:"Leer el spike completo ↗",
    verdicts:{seed:"Semilla: el mejor cuerpo de mascota; la lectura necesita más apoyo.",leaf:"Hoja / página: la mejor unión entre lectura y crecimiento.",loop:"Bucle vivo: conecta con el repaso; más delicado a tamaño pequeño."},
    speeches:{logo:"La misma forma. Aún sin cara.",hello:"¡Hola! ¿Qué idea vemos hoy?",reading:"Una idea cada vez.",celebrate:"Un pequeño momento para tus ideas."}
  },
  en: {
    exploration:"Brand exploration",eyebrow:"READING × PERSONAL GROWTH",headline:'Turn a leaf.<br>Grow a little<span class="dot">.</span>',lead:"A page becomes a plant. An idea stays with you.",try:'Bring the symbol to life <span aria-hidden="true">↓</span>',visualPhrase:"SMALL IDEAS. ROOM TO GROW.",heroNote:"One shape.<br>Two ways to see it.",routesEyebrow:"01 / SHAPE",routesTitle:"Three ways to sprout.",routesIntro:"Pick a shape to try its personality.<br>The name is still open.",seedName:"Seed",seedTag:"More companion",seedDesc:"A small idea, ready to grow.",leafName:"Leaf / page",leafTag:"More product",leafDesc:"A book that is also a sprout.",loopName:"Living loop",loopTag:"More abstract",loopDesc:"Return to an idea. Let it grow.",recommendation:"RECOMMENDED",sizeCaption:"ONE SILHOUETTE, EVERY SIZE",oneColor:"One color",labEyebrow:"02 / PERSONALITY",labTitle:"The logo looks back.",labIntro:"Two eyes. One gesture. The same shape.<br>A companion for your reading.",characterLabel:"THE COMPANION",wake:"Turn into a companion",sleep:"Back to the symbol",logoState:"Symbol",helloState:"Hello",readingState:"Reading",celebrateState:"Celebrate",productLabel:"IN THE APP / READING DEMO",today:"TODAY",daily:"Your idea of the day",notebook:"EXAMPLE NOTEBOOK",cardTitle:"Make it easy for your future self.",cardBody:"Prepare the first step of what you want to do. One small decision today can help you get started tomorrow.",detail:"See an example",detailBody:"If you want to read in the morning, leave your book where you have breakfast.",review:'I’ve read it <span aria-hidden="true">✓</span>',reread:"Read it again",readingHint:"One idea. A moment for yourself.",reviewedHint:"Idea revisited. Come back whenever you like.",prototypeNote:"Working name · Original sample content · Temporary state",storyEyebrow:"03 / LANGUAGE",storyTitle:"Room to grow.<br>In just a few words.",storyIntro:"The visual idea travels across languages.<br>The words adapt to each one.",namingEyebrow:"04 / OPEN NAMING",namingTitle:"What do you call something starting to grow?",broteReason:"Warm. Clear growth metaphor in ES.",sproutReason:"The direct metaphor in EN.",leafiReason:"Leaf / page. Sounds like a companion.",saviaReason:"Knowledge that nourishes.",nameNote:"Concept names; availability has not been checked.",footer:"Less to do. More to feel.",fullSpike:"Read the full spike ↗",
    verdicts:{seed:"Seed: the strongest mascot body; reading needs more support.",leaf:"Leaf / page: the strongest link between reading and growth.",loop:"Living loop: a link to revisiting ideas; more delicate at small sizes."},
    speeches:{logo:"The same shape. No face yet.",hello:"Hello! What idea shall we read today?",reading:"One idea at a time.",celebrate:"A small moment for your ideas."}
  }
};

// Names are preview candidates. Selection does not save a brand decision.
const nameOptions = {
  seedo: { label: "Seedo", line: "Read. Plant a seed.", hero: 'Read.<br>Plant a seed<span class="dot">.</span>' },
  reed: { label: "Reed", line: "Read. Plant a seed.", hero: 'Read.<br>Plant a seed<span class="dot">.</span>' },
  glo: { label: "Glo", line: "A little glow. Room to grow.", hero: 'A little glow.<br>Room to grow<span class="dot">.</span>' },
  bloom: { label: "Bloom", line: "Make room to bloom.", hero: 'Make room<br>to bloom<span class="dot">.</span>' }
};
Object.assign(copy.es, {
  namingTitle: "Un nuevo nombre. La misma idea.",
  nameIntro: "Prueba cómo suena cada nombre en la marca y en la app.",
  seedoReason: "Seed + un final juguetón.",
  reedReason: "Suena a read; significa junco.",
  gloReason: "Brillar y crecer.",
  bloomReason: "Espacio para florecer.",
  spanishFixed: "ES / De hoja a hoja.",
  nameNote: "Nombres de exploración. Seleccionar uno cambia la vista, no fija la marca.",
  storyIntro: "En español: De hoja a hoja.<br>En inglés: lectura, brotes y una rima."
});
Object.assign(copy.en, {
  namingTitle: "A new name. The same idea.",
  nameIntro: "Try each name in the brand and in the app.",
  seedoReason: "Seed + a playful ending.",
  reedReason: "Sounds like read; means a plant.",
  gloReason: "A little glow. Room to grow.",
  bloomReason: "Room for personal growth.",
  spanishFixed: "ES / De hoja a hoja.",
  nameNote: "Exploration names. Selecting one previews it; it does not choose the brand.",
  storyIntro: "Spanish: De hoja a hoja.<br>English: reading, sprouts, and a rhyme."
});
let currentName = "seedo";
let language = "es";
let route = "leaf";
let expression = "logo";
let reviewed = false;

const positions = {seed:{x1:64,x2:92,y:95,mx:78,my:111},leaf:{x1:53,x2:111,y:104,mx:82,my:121},loop:{x1:23,x2:137,y:76,mx:80,my:96}};
function faceMarkup(shape, state) {
  const {x1,x2,y,mx,my} = positions[shape];
  const look = state === "reading" ? 3 : 0;
  const eyes = state === "celebrate"
    ? `<path d="M${x1-4} ${y+2}q4-7 8 0M${x2-4} ${y+2}q4-7 8 0" stroke="#173D2C" stroke-width="4" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x1+look}" cy="${y+look}" rx="3.5" ry="5" fill="#173D2C"/><ellipse cx="${x2+look}" cy="${y+look}" rx="3.5" ry="5" fill="#173D2C"/>`;
  const mouth = state === "reading" ? `<path d="M${mx-3} ${my}h6"/>` : `<path d="M${mx-4} ${my-2}q4 6 8 0"/>`;
  return `<svg class="face" viewBox="0 0 160 160" aria-hidden="true">${eyes}<g fill="none" stroke="#173D2C" stroke-width="3" stroke-linecap="round">${mouth}</g></svg>`;
}
function paintArt(element, shape, state) {
  element.dataset.route = shape;
  element.dataset.face = state;
  element.querySelector("img").src = `${shape}.svg`;
  element.querySelector("img").alt = copy[language][`${shape}Name`];
  element.querySelector(".face")?.remove();
  element.insertAdjacentHTML("beforeend", faceMarkup(shape, state));
}
function animateArt(element, state) {
  element.classList.remove("animate-hello", "animate-reading", "animate-celebrate");
  if (state === "logo") return;
  // Restart a finite animation even if the same expression is selected twice.
  void element.offsetWidth;
  element.classList.add(`animate-${state}`);
}
function setExpression(state, animate = true) {
  expression = state;
  const character = document.querySelector(".character");
  paintArt(character, route, state);
  document.querySelectorAll("[data-state]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.state === state)));
  const wake = document.getElementById("wake");
  wake.setAttribute("aria-pressed", String(state !== "logo"));
  wake.textContent = copy[language][state === "logo" ? "wake" : "sleep"];
  document.getElementById("character-speech").textContent = copy[language].speeches[state];
  const stage = document.querySelector(".character-stage");
  stage.classList.remove("party");
  if (animate) {
    animateArt(character,state);
    if (state === "celebrate") { void stage.offsetWidth; stage.classList.add("party"); }
  }
}
function paintReading() {
  const c = copy[language];
  document.getElementById("review").innerHTML = c[reviewed ? "reread" : "review"];
  document.getElementById("reading-feedback").textContent = c[reviewed ? "reviewedHint" : "readingHint"];
  paintArt(document.querySelector(".mini-character"),route,reviewed ? "celebrate" : "hello");
}
function selectRoute(shape) {
  route = shape;
  document.querySelectorAll("[data-choice]").forEach(button => {
    const selected = button.dataset.choice === shape;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed",String(selected));
  });
  document.querySelectorAll(".dynamic-symbol").forEach(img => img.src = `${shape}.svg`);
  paintArt(document.querySelector(".hero-mark"),shape,"logo");
  document.getElementById("route-verdict").textContent = copy[language].verdicts[shape];
  document.getElementById("current-route").textContent = copy[language][`${shape}Name`].toLocaleUpperCase(language);
  setExpression(expression,false);
  paintReading();
}
function setLanguage(next) {
  language = next;
  document.documentElement.lang = next;
  document.title = `${nameOptions[currentName].label} · ${next === "es" ? "De hoja a hoja" : nameOptions[currentName].line}`;
  document.querySelectorAll("[data-i18n]").forEach(element => element.innerHTML = copy[next][element.dataset.i18n]);
  document.querySelectorAll("[data-lang]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.lang === next)));
  selectRoute(route);
  previewName(currentName);
}

function previewName(key) {
  currentName = key;
  const candidate = nameOptions[key];
  document.querySelectorAll("[data-name]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.name === key)));
  document.querySelector(".signature > span").innerHTML = `${candidate.label.toLowerCase()}<span class="edition"> / estudio 01</span>`;
  document.querySelector(".app-wordmark > span").innerHTML = `${candidate.label.toLowerCase()}<span class="wordmark-period">.</span>`;
  document.getElementById("name-context-label").textContent = `EN / ${candidate.label.toUpperCase()}`;
  document.getElementById("name-tagline").textContent = candidate.line;
  document.getElementById("english-brand-line").textContent = candidate.line;
  if (language === "en") document.getElementById("hero-title").innerHTML = candidate.hero;
  document.title = `${candidate.label} · ${language === "es" ? "De hoja a hoja" : candidate.line}`;
}
document.querySelectorAll("[data-name]").forEach(button => button.addEventListener("click",()=>previewName(button.dataset.name)));
document.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click",()=>selectRoute(button.dataset.choice)));
document.querySelectorAll("[data-state]").forEach(button => button.addEventListener("click",()=>setExpression(button.dataset.state)));
document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click",()=>setLanguage(button.dataset.lang)));
document.getElementById("wake").addEventListener("click",()=>setExpression(expression === "logo" ? "hello" : "logo"));
document.getElementById("review").addEventListener("click",()=>{
  reviewed = !reviewed;
  paintReading();
  setExpression(reviewed ? "celebrate" : "reading");
  animateArt(document.querySelector(".mini-character"), reviewed ? "celebrate" : "reading");
});
document.getElementById("card-detail").addEventListener("toggle",event=>{
  if(event.target.open && !reviewed) setExpression("reading");
});
setLanguage("es");
