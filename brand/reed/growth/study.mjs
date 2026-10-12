import {mascotArt} from "/app/mascot-art.mjs?v=mascot-icon-image";
for (const frame of document.querySelectorAll("[data-mascot-preview]")) frame.innerHTML = mascotArt(frame.dataset.mascotPreview);
