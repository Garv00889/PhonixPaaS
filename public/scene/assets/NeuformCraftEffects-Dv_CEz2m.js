import{n as e,r as t,t as n}from"./index-DPH5BU91.js";var r=t(e()),i=`<!DOCTYPE html><html><body></body></html>`,a=`<!DOCTYPE html><html><body></body></html>`,o=`<!DOCTYPE html><html><body></body></html>`,s=`<!DOCTYPE html><html><body></body></html>`,c=`<!DOCTYPE html><html><body></body></html>`,l=`<!DOCTYPE html><html><body></body></html>`,u=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nexus - Unified Ecosystem</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"><\/script>
    <!-- GSAP for Animations -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"><\/script>
</head>
<body class="bg-black text-white font-sans min-h-screen overflow-x-hidden antialiased selection:bg-red-500/30 flex flex-col relative" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

    <!-- WebGL Background -->
    <canvas id="glcanvas" class="fixed inset-0 w-full h-full -z-20"></canvas>

    <!-- Overlay structural lines to match reference -->
    <div class="fixed inset-0 pointer-events-none -z-10 w-full h-full">
        <!-- Thin angled lines behind logo area -->
        <div class="absolute top-0 left-0 w-[600px] h-[600px] border-l border-t border-white/5 origin-top-left rotate-[15deg] translate-x-[-100px] translate-y-[-100px]"></div>
        <div class="absolute top-0 left-0 w-[800px] h-[800px] border-l border-white/5 origin-top-left rotate-[-25deg] translate-x-[200px] translate-y-[-50px]"></div>
        <!-- Horizontal grid line -->
        <div class="absolute top-[20%] w-full border-t border-white/5"></div>
    </div>

    <!-- Main Content Layout -->
    <div class="flex-1 flex flex-col relative z-10 w-full max-w-[1600px] mx-auto min-h-screen border-l border-r border-white/10">
        
        <!-- Hero Section -->
        <main class="flex-1 flex flex-col lg:flex-row items-center lg:items-center justify-between px-8 sm:px-16 lg:px-24 py-24 lg:py-0 relative">
            
            <!-- Left: Logo & Title -->
            <div class="flex items-center gap-6 group cursor-default w-full lg:w-1/2 mb-20 lg:mb-0">
                <!-- Abstract Geometric Icon -->
                <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white transform group-hover:scale-105 transition-transform duration-500 ease-out" style="flex-shrink: 0;">
                    <path d="M10 20 L50 40 L90 10 L80 50 L95 85 L50 60 L15 90 L25 50 Z" fill="currentColor"/>
                    <path d="M50 40 L50 60" stroke="black" stroke-width="2"/>
                    <path d="M10 20 L50 60" stroke="black" stroke-width="2"/>
                </svg>
                
                <!-- Masked Reveal Title -->
                <h1 class="text-7xl sm:text-8xl lg:text-9xl font-semibold tracking-tighter lowercase leading-none flex flex-wrap gap-x-4 gap-y-2 reveal-text">
                    <span class="inline-block overflow-hidden pt-2">
                        <span class="reveal-word inline-block translate-y-[120%] pb-2">nexus</span>
                    </span>
                    <span class="inline-block overflow-hidden pt-2">
                        <span class="reveal-word inline-block translate-y-[120%] pb-2">flow</span>
                    </span>
                </h1>
            </div>

            <!-- Right: Input & Social Proof -->
            <div class="w-full lg:w-1/2 flex flex-col items-start lg:items-end relative">
                <!-- Offset Input Container -->
                <div class="relative group w-full max-w-md">
                    <!-- Stylized Shadow/Offset with subtle gradient -->
                    <div class="absolute inset-0 bg-gradient-to-br from-[#A63A29] to-[#732215] translate-x-3 translate-y-3 transition-transform duration-300 ease-out group-hover:translate-x-4 group-hover:translate-y-4"></div>
                    
                    <!-- Input Box with Premium Gradient Border Treatment -->
                    <div class="relative z-10 p-[1px] bg-gradient-to-r from-white/40 via-white/10 to-white/30">
                        <div class="bg-white flex items-center justify-between p-1 w-full h-[60px] sm:h-[72px]">
                            <input type="email" placeholder="Join the waitlist..." class="w-full h-full bg-transparent text-black outline-none px-6 text-base sm:text-lg font-medium placeholder:text-gray-500 placeholder:font-normal" />
                        </div>
                    </div>
                </div>

                <!-- Users Proof -->
                <div class="flex flex-row items-center gap-4 mt-10 mr-2">
                    <span class="text-sm font-medium tracking-wide">5,102+ early adopters</span>
                    <div class="flex -space-x-3">
                        <!-- Avatars with Gradient Borders -->
                        <div class="w-8 h-8 rounded-full p-[2px] bg-gradient-to-br from-white/50 to-white/10 bg-black shadow-sm">
                            <img class="w-full h-full rounded-full object-cover" src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/2f563338-39fa-47ea-9761-658d4f3f84db_1600w.jpg" alt="User avatar">
                        </div>
                        <div class="w-8 h-8 rounded-full p-[2px] bg-gradient-to-br from-white/50 to-white/10 bg-black shadow-sm">
                            <img class="w-full h-full rounded-full object-cover" src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/4f5668c5-fc4a-44e0-bc5e-a664189d3c31_1600w.jpg" alt="User avatar">
                        </div>
                        <div class="w-8 h-8 rounded-full p-[2px] bg-gradient-to-br from-white/50 to-white/10 bg-black shadow-sm">
                            <img class="w-full h-full rounded-full object-cover" src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/eca707cc-a5b7-439a-b4fd-247f6106c2e1_1600w.jpg" alt="User avatar">
                        </div>
                        <div class="w-8 h-8 rounded-full p-[2px] bg-gradient-to-br from-white/50 to-white/10 bg-black shadow-sm">
                            <img class="w-full h-full rounded-full object-cover" src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/77415a2e-dcbc-4748-a29d-fced4821881a_1600w.jpg" alt="User avatar">
                        </div>
                    </div>
                </div>
            </div>
            
        </main>

        <!-- Structural Horizontal Divider -->
        <div class="w-full border-t border-white/20"></div>

        <!-- Footer Section -->
        <footer class="w-full grid grid-cols-1 lg:grid-cols-12 min-h-[300px]">
            
            <!-- Footer Left: Brand & Desc -->
            <div class="lg:col-span-4 p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-white/20 flex flex-col gap-6">
                <div class="flex items-center gap-3">
                    <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white">
                        <path d="M10 20 L50 40 L90 10 L80 50 L95 85 L50 60 L15 90 L25 50 Z" fill="currentColor"/>
                    </svg>
                    <span class="text-base font-semibold tracking-tight">Nexus</span>
                </div>
                <p class="text-sm text-gray-400 leading-relaxed max-w-[280px]">
                    Your unified ecosystem to synchronize thoughts, maintain momentum, and build effortlessly.
                </p>
            </div>

            <!-- Footer Right: Links -->
            <div class="lg:col-span-8 p-8 sm:p-12 lg:p-16 grid grid-cols-2 sm:grid-cols-3 gap-12 sm:gap-8">
                <!-- Column 1 -->
                <div class="flex flex-col gap-5">
                    <h3 class="text-sm font-semibold tracking-tight text-white mb-1">Product</h3>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Capabilities</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Mechanism</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Plans</a>
                </div>
                
                <!-- Column 2 -->
                <div class="flex flex-col gap-5">
                    <h3 class="text-sm font-semibold tracking-tight text-white mb-1">Company</h3>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Our Story</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Join Us</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Get in Touch</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Media</a>
                </div>

                <!-- Column 3 -->
                <div class="flex flex-col gap-5">
                    <h3 class="text-sm font-semibold tracking-tight text-white mb-1">Resources</h3>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Support</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Changelog</a>
                    <a href="#" class="text-sm text-gray-400 hover:text-white transition-colors duration-200">Documentation</a>
                </div>
            </div>

        </footer>
    </div>

    <!-- Scripts -->
    <script>
        // --- WebGL Background Animation ---
        const canvas = document.getElementById('glcanvas');
        const gl = canvas.getContext('webgl');

        if (!gl) {
            console.error('WebGL not supported');
        } else {
            // Resize handler
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }
            window.addEventListener('resize', resize);
            resize();

            // Vertex Shader
            const vsSource = \`
                attribute vec4 aVertexPosition;
                void main() {
                    gl_Position = aVertexPosition;
                }
            \`;

            // Fragment Shader (Halftone Flow)
            const fsSource = \`
                precision highp float;
                uniform vec2 u_resolution;
                uniform float u_time;

                mat2 rot(float a) {
                    float s = sin(a), c = cos(a);
                    return mat2(c, -s, s, c);
                }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                    vec2 p = uv * 2.0 - 1.0;
                    p.x *= u_resolution.x / u_resolution.y;

                    vec2 flow_uv = p;
                    float time = u_time * 0.4;
                    
                    for(float i = 1.0; i < 4.0; i++) {
                        flow_uv *= rot(time * 0.1);
                        flow_uv.x += sin(flow_uv.y * 2.0 * i + time) * 0.5;
                        flow_uv.y += cos(flow_uv.x * 1.5 * i - time * 0.8) * 0.5;
                    }

                    float intensity = sin(flow_uv.x * 2.0 + flow_uv.y * 3.0) * 0.5 + 0.5;
                    
                    vec3 col_dark = vec3(0.02, 0.0, 0.0);
                    vec3 col_red = vec3(0.8, 0.1, 0.05);
                    vec3 col_bright = vec3(1.0, 0.6, 0.2);
                    
                    vec3 fluid_color = mix(col_dark, col_red, smoothstep(0.2, 0.6, intensity));
                    fluid_color = mix(fluid_color, col_bright, smoothstep(0.7, 1.0, intensity));

                    float gridSize = 6.0; 
                    vec2 grid_uv = gl_FragCoord.xy / gridSize;
                    vec2 cell_uv = fract(grid_uv) - 0.5;
                    
                    float dist = length(cell_uv);
                    float radius = intensity * 0.45; 
                    float dot_mask = smoothstep(radius, radius - 0.1, dist);
                    
                    vec3 final_color = mix(vec3(0.0), fluid_color, dot_mask);
                    final_color += fluid_color * 0.15;

                    gl_FragColor = vec4(final_color, 1.0);
                }
            \`;

            function compileShader(gl, type, source) {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    console.error(gl.getShaderInfoLog(shader));
                    gl.deleteShader(shader);
                    return null;
                }
                return shader;
            }

            const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
            const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            gl.useProgram(program);

            const positions = new Float32Array([
                -1.0,  1.0,
                 1.0,  1.0,
                -1.0, -1.0,
                 1.0, -1.0,
            ]);
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            const positionLocation = gl.getAttribLocation(program, "aVertexPosition");
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
            const timeLocation = gl.getUniformLocation(program, "u_time");

            let startTime = Date.now();
            function render() {
                gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                gl.uniform1f(timeLocation, (Date.now() - startTime) / 1000.0);
                
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                requestAnimationFrame(render);
            }
            render();
        }

        // --- GSAP ScrollTrigger Masked Word Reveal ---
        document.addEventListener("DOMContentLoaded", (event) => {
            gsap.registerPlugin(ScrollTrigger);

            gsap.to(".reveal-word", {
                y: "0%",
                duration: 1.2,
                stagger: 0.15,
                ease: "power4.out",
                scrollTrigger: {
                    trigger: ".reveal-text",
                    start: "top 90%",
                }
            });
        });
    <\/script>
</body>
</html>`,d=n(),f={hue:0,saturation:1,brightness:1},p={neon:{title:`Animated neon typography`,source:o,background:e=>e===`light`?`#f4f4f2`:`#090909`,targets:[{selector:`#board`,role:`ui`,width:`1040px`}],presentation:`animated-typography`},luminaWeaversCloth:{title:`Woven Cloth kinetic textile`,source:l,background:`#16090b`,targets:[{selector:`body > div.fixed.inset-0.overflow-hidden.z-0`,role:`background`}],presentation:`woven-cloth-label`},julianVanceNebula:{title:`Julian Vance nebula background`,source:s,background:`#09090b`,targets:[{selector:`#bg-canvas`,role:`background`}]},fluid:{title:`Aura UI fluid background`,source:a,background:`#030306`,targets:[{selector:`#bg-canvas`,role:`background`}]},nexusUnifiedFlow:{title:`Nexus unified halftone flow`,source:u,background:`#000000`,targets:[{selector:`#glcanvas`,role:`background`}]},emberStorm:{title:`Aeonix ember storm`,source:i,background:`#080503`,targets:[{selector:`#gl`,role:`background`}]},engravedCertificate:{title:`Kinetic Lathe certificate`,source:c,background:`#ded6c2`,targets:[{selector:`#cert`,role:`ui`,width:`720px`}]}};function m(e,t,n){return Math.min(n,Math.max(t,e))}function h(e,t,n){if(!e.includes(t))throw Error(`Neuform source adapter could not find: ${t}`);return e.replace(t,n)}function g(e){return[[`return { t0: after + 5.6 + frnd() * 7.2, dur: total, segs: segs };`,`return { t0: after + 1.25 + frnd() * 1.75, dur: total, segs: segs };`],[`if (!ev) ev = nextEvent(4.2);`,`if (!ev) ev = nextEvent(0.55);`],[`cap = Math.min((W - W * 0.12) / blockW, (H - H * 0.18) / blockH);`,`cap = Math.min((W - W * 0.20) / blockW, (H - H * 0.28) / blockH);`],[`var y0 = (H - blockH * cap) * 0.48;`,`var y0 = (H - blockH * cap) / 2;`]].reduce((e,[t,n])=>h(e,t,n),e)}function _(e){return[[`x.fillText('L W', W/2, 190);`,`x.fillText('W C', W/2, 190);`],[`x.fillText('· KYOTO ·', W/2, 246);`,`x.fillText('· WOVEN CLOTH ·', W/2, 246);`],[`x.fillText('LUMINA', W/2, 400);`,`x.fillText('WOVEN', W/2, 400);`],[`x.fillText('WEAVERS', W/2, 520);`,`x.fillText('CLOTH', W/2, 520);`],[`x.fillText('K I N E T I C   T E X T I L E S   ·   2 0 2 4', W/2, 626);`,`x.fillText('T E X T I L E   S I M U L A T I O N', W/2, 626);`]].reduce((e,[t,n])=>h(e,t,n),e)}function v(e,t){return typeof e.background==`function`?e.background(t):e.background}function y(e,t){let n=JSON.stringify(e.targets).replace(/</g,`\\u003c`),r=v(e,t),i=t===`light`?`grayscale(1) invert(1) contrast(1.08)`:`grayscale(1) contrast(1.08)`,a=`<style data-threeui-focus>
html, body { width: 100% !important; height: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: ${r} !important; }
body { position: relative !important; display: flex !important; align-items: center !important; justify-content: center !important; }
body > * { visibility: hidden !important; }
body[data-threeui-ready] > [data-threeui-role] { visibility: visible !important; }
[data-threeui-residual] { display: none !important; }
[data-threeui-role="background"] { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; z-index: 0 !important; opacity: 1 !important; pointer-events: none !important; }
[data-threeui-role="ui"] { position: relative !important; z-index: 1 !important; width: min(calc(100% - 32px), var(--threeui-target-width, 1040px)) !important; max-width: none !important; max-height: calc(100% - 32px) !important; margin: auto !important; overflow: auto !important; opacity: 1 !important; transform: none !important; filter: none !important; flex: none !important; box-sizing: border-box !important; }
${e.presentation===`animated-typography`?`
@keyframes sf-neon-type-breathe {
  0%, 100% { transform: translate3d(0, 3px, 0) scale(0.988); opacity: 0.88; }
  45% { transform: translate3d(0, -3px, 0) scale(1); opacity: 1; }
  68% { transform: translate3d(0, 0, 0) scale(0.996); opacity: 0.96; }
}
#board { overflow: visible !important; }
#neon {
  transform-origin: 50% 52%;
  animation: sf-neon-type-breathe 5.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  filter: ${i};
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) {
  #neon { animation: none !important; transform: none !important; opacity: 1 !important; }
}
`:``}
</style>`,o=`<script data-threeui-focus>
(function () {
  var isolated = false;
  function isolate() {
    if (isolated) return;
    var specs = ${n};
    var roots = [];
    specs.forEach(function (spec) {
      var element = document.querySelector(spec.selector);
      if (!element) return;
      element.setAttribute('data-threeui-role', spec.role);
      if (spec.width) element.style.setProperty('--threeui-target-width', spec.width);
      if (!roots.some(function (root) { return root.contains(element); })) roots.push(element);
    });
    if (!roots.length) return;
    isolated = true;
    roots.forEach(function (root) { document.body.appendChild(root); });
    Array.from(document.body.children).forEach(function (element) {
      if (roots.indexOf(element) !== -1) return;
      element.setAttribute('data-threeui-residual', '');
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) element.inert = true;
    });
    document.body.setAttribute('data-threeui-ready', '');
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }
  function scheduleIsolation() { setTimeout(isolate, 100); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleIsolation, { once: true });
  else scheduleIsolation();
  window.addEventListener('load', isolate, { once: true });
})();
<\/script>`;return(e.presentation===`animated-typography`?g(e.source):e.presentation===`woven-cloth-label`?_(e.source):e.source).replace(/<\/head>/i,`${a}</head>`).replace(/<\/body>/i,`${o}</body>`)}function b({definition:e,mode:t=`dark`,hue:n=f.hue,saturation:i=f.saturation,brightness:a=f.brightness,className:o,style:s}){let c=t===`light`?`light`:`dark`,l=v(e,c),u=(0,r.useMemo)(()=>y(e,c),[e,c]),p=m(n,-180,180),h=m(i,0,2),g=m(a,.35,1.65),_=p===0&&h===1&&g===1?void 0:`hue-rotate(${p}deg) saturate(${h}) brightness(${g})`;return(0,d.jsx)(`iframe`,{className:o,"data-mode":c,title:e.title,srcDoc:u,sandbox:`allow-scripts`,loading:`eager`,style:{display:`block`,width:`100%`,height:`100%`,border:0,background:l,filter:_,...s}})}function x(e){return function(t){return(0,d.jsx)(b,{...t,definition:e})}}p.neon,p.luminaWeaversCloth,p.julianVanceNebula,p.fluid;var S=x(p.nexusUnifiedFlow);p.emberStorm,p.engravedCertificate;export{S as HalftoneFlow};