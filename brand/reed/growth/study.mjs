import {mascotArt} from "/app/mascot-art.mjs?v=pot-calibration";
for (const frame of document.querySelectorAll("[data-mascot-preview]")) frame.innerHTML = mascotArt(frame.dataset.mascotPreview);
