// Draws a plain, empty sample room (illustration, not a photo) used by the "try a sample room" button.
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
<defs>
<linearGradient id="wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9d4cb"/><stop offset=".5" stop-color="#e6e1d8"/><stop offset="1" stop-color="#cfc9bf"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b58d62"/><stop offset="1" stop-color="#8f6a45"/></linearGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6f6"/><stop offset="1" stop-color="#f4f8fb"/></linearGradient>
</defs>
<rect width="1536" height="1024" fill="url(#wall)"/>
<polygon points="0,1024 1536,1024 1536,700 0,700" fill="url(#floor)"/>
${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 120 - 100}" y1="1024" x2="${700 + (i - 7) * 50}" y2="700" stroke="#7a5a3a" stroke-opacity=".35" stroke-width="2"/>`).join("")}
<rect x="0" y="680" width="1536" height="22" fill="#f3f0ea"/>
<rect x="150" y="150" width="440" height="380" fill="#8a8378"/>
<rect x="164" y="164" width="412" height="352" fill="url(#sky)"/>
<rect x="364" y="164" width="12" height="352" fill="#8a8378"/><rect x="164" y="330" width="412" height="12" fill="#8a8378"/>
<rect x="1040" y="190" width="260" height="490" fill="#c9c2b6"/><rect x="1056" y="206" width="228" height="474" fill="#efece6"/><circle cx="1260" cy="450" r="9" fill="#a89a7a"/>
<polygon points="0,0 1536,0 1536,40 0,40" fill="#f1eee8"/>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile("public/sample-room.jpg");
console.log("wrote public/sample-room.jpg");
