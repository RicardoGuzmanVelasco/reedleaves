import {mascotArt} from "/app/mascot-art.mjs?v=flower-15-days";
for (const frame of document.querySelectorAll("[data-mascot-preview]")) frame.innerHTML = mascotArt(frame.dataset.mascotPreview);
