import {mascotArt} from "/app/mascot-art.mjs?v=soil-bud-3";
for (const frame of document.querySelectorAll("[data-mascot-preview]")) frame.innerHTML = mascotArt(frame.dataset.mascotPreview);
