// A cena do Órbita em 3D: o sol (o agora), os planetas (os espaços), as luas (as coisas de
// cada espaço), o céu e a câmera livre. Quem monta a árvore é universo.ts; quem mostra o
// cartão e a barra é Orbita.tsx. Aqui só há desenho e movimento.
import * as THREE from "three";
import { texAnel, texBrilho, texCeu, texLua, texMais, texMarca, texMundo, texNoite, texNuvens } from "./texturas";
import { ancestral, posicaoLocal, semente, todos, type No } from "./universo";

/** 0: rápido; 1: lento; 2: parado. */
export type Velocidade = 0 | 1 | 2;
const VEL = [1, 0.25, 0];

interface Corpo {
  g: THREE.Group; malha?: THREE.Mesh; nuvens?: THREE.Mesh; linhas: THREE.LineLoop[]; rotulo: HTMLDivElement;
  pos: THREE.Vector3; sx: number; sy: number; sr: number; frente: boolean; vis: boolean; giro: number; larg: number;
  caixa: { x: number; y: number; w: number; h: number } | null;
}
export interface Cena {
  /** Troca o universo (os dados mudaram). Mantém a vista onde estava, se o corpo ainda existir. */
  definir(raiz: No): void;
  /** Voa até um corpo. */
  irPara(n: No): void;
  marcar(n: No | null): void;
  foco(): No;
  zoom(fator: number): void;
  velocidade(v: Velocidade): void;
  /** Com isto ligado, arrastar passeia para os lados em vez de girar. */
  passear(ligado: boolean): void;
  /** Menos efeitos, para aparelho que não acompanha. */
  reduzir(ligado: boolean): void;
  destruir(): void;
}
export interface OpcoesCena {
  /** O foco mudou (a vista entrou noutro sistema) ou a pessoa tocou num corpo. */
  aoMudar: (foco: No, tocado: No | null | undefined) => void;
  /** O aparelho não está acompanhando (medido nos primeiros segundos). */
  aoPesado: () => void;
  velocidade: Velocidade;
  reduzido: boolean;
}

const GLSL_RUIDO = `float h3(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*n3(p);p*=2.02;a*=0.5;}return s;}`;
const VS_P = `varying vec2 vUv;varying vec3 vNw;varying vec3 vPw;varying vec3 vNv;void main(){vUv=uv;vNw=normalize(mat3(modelMatrix)*normal);vNv=normalize(normalMatrix*normal);vec4 p=modelMatrix*vec4(position,1.0);vPw=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const rnd = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function criarCena(tela: HTMLElement, nomes: HTMLElement, op: OpcoesCena): Cena {
  const render = new THREE.WebGLRenderer({ antialias: true });
  render.setPixelRatio(op.reduzido ? 1 : Math.min(2, devicePixelRatio || 1)); tela.append(render.domElement);
  const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 1, 0.05, 20000);
  cena.add(new THREE.AmbientLight(0x93a4d6, 0.2 * Math.PI));
  cena.add(new THREE.PointLight(0xfff1dc, 2.1 * Math.PI, 0, 0));

  // Céu: a Via Láctea pintada e milhares de estrelas.
  cena.add(new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, map: texCeu() })));
  const normalVia = new THREE.Vector3(0.32, 0.9, 0.28).normalize();
  const estrelas = (qtd: number, tam: number, forca: number) => {
    const pos = new Float32Array(qtd * 3), cor = new Float32Array(qtd * 3), v = new THREE.Vector3();
    for (let i = 0; i < qtd; i++) {
      v.set(rnd(i * 3 + tam) * 2 - 1, rnd(i * 3 + 1 + tam) * 2 - 1, rnd(i * 3 + 2 + tam) * 2 - 1);
      if (v.lengthSq() < 0.01) v.set(1, 0, 0);
      v.normalize(); if (i % 2) v.addScaledVector(normalVia, -v.dot(normalVia) * 0.82).normalize();
      v.multiplyScalar(8000); pos.set([v.x, v.y, v.z], i * 3);
      const b = Math.pow(rnd(i * 7 + 5), 2.4) * forca + 0.12, q = rnd(i * 13 + 2);
      cor.set([b * (0.75 + q * 0.25), b * (0.82 + q * 0.1), b * (1 - q * 0.3)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(cor, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: tam, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })); cena.add(p); return p;
  };
  estrelas(6000, 1.5, 0.95); const estrelasGrandes = estrelas(300, 2.8, 1.25);

  // Sol: superfície viva, raios da coroa e o brilho em volta.
  const matSol = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `${GLSL_RUIDO} uniform float t;varying vec3 vP;varying vec3 vN;void main(){
      float a=fbm(vP*2.2+vec3(0.0,t*0.05,t*0.03));float b=fbm(vP*7.0+vec3(t*0.09,0.0,-t*0.07));float c=fbm(vP*18.0-vec3(t*0.12));
      float v=a*0.5+b*0.32+c*0.18;
      vec3 col=mix(vec3(0.80,0.22,0.02),vec3(1.0,0.56,0.08),smoothstep(0.22,0.42,v));
      col=mix(col,vec3(1.0,0.88,0.48),smoothstep(0.40,0.56,v));col=mix(col,vec3(1.0,0.98,0.90),smoothstep(0.56,0.72,v));
      float mu=clamp(vN.z,0.0,1.0);col*=0.42+0.58*pow(mu,0.55);col+=vec3(1.0,0.45,0.1)*pow(1.0-mu,3.0)*0.55;
      gl_FragColor=vec4(col,1.0);}` });
  const matCoroa = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `${GLSL_RUIDO} uniform float t;varying vec2 vUv;void main(){vec2 p=(vUv-0.5)*2.0;float r=length(p);float a=atan(p.y,p.x);
      float raios=fbm(vec3(cos(a)*3.0,sin(a)*3.0,t*0.05))*fbm(vec3(cos(a)*9.0+4.0,sin(a)*9.0,r*2.0-t*0.2));
      float i=exp(-max(r-0.2,0.0)*5.5)*(0.25+2.6*raios)*smoothstep(1.0,0.55,r);
      gl_FragColor=vec4(vec3(1.0,0.72,0.38)*i,i);}` });
  // Planetas: luz do sol de verdade (dia e noite), brilho do sol no mar, luzes de cidade e o ar na beirada.
  const PRETO = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); PRETO.needsUpdate = true;
  const matPlaneta = (map: THREE.Texture, o: { noite?: THREE.Texture; esp?: number; atmo?: string; transparente?: boolean } = {}) => new THREE.ShaderMaterial({ transparent: !!o.transparente, depthWrite: !o.transparente,
    uniforms: { map: { value: map }, noite: { value: o.noite ?? PRETO }, esp: { value: o.esp ?? 0 }, atmo: { value: new THREE.Color(o.atmo ?? "#000000") } }, vertexShader: VS_P,
    fragmentShader: `uniform sampler2D map;uniform sampler2D noite;uniform float esp;uniform vec3 atmo;varying vec2 vUv;varying vec3 vNw;varying vec3 vPw;void main(){
      vec4 tx=texture2D(map,vUv);vec3 N=normalize(vNw);vec3 L=normalize(-vPw);vec3 V=normalize(cameraPosition-vPw);
      float d=dot(N,L);float dia=smoothstep(-0.10,0.30,d);
      vec3 col=tx.rgb*(0.24+1.05*pow(max(d,0.0),0.8));
      float mar=step(tx.r*1.25,tx.b)*step(tx.g,tx.b+0.02);vec3 Hh=normalize(L+V);
      col+=vec3(1.0,0.95,0.85)*pow(max(dot(N,Hh),0.0),70.0)*mar*esp*dia;
      col+=texture2D(noite,vUv).rgb*(1.0-dia)*1.6;
      float fr=pow(1.0-max(dot(N,V),0.0),3.0);col+=atmo*fr*(0.08+0.92*dia)*0.55;
      gl_FragColor=vec4(col,tx.a);}` });
  const matAtmo = (cor: string) => new THREE.ShaderMaterial({ uniforms: { cor: { value: new THREE.Color(cor) } }, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, vertexShader: VS_P,
    fragmentShader: `uniform vec3 cor;varying vec3 vNv;varying vec3 vNw;varying vec3 vPw;void main(){float i=pow(0.62-dot(vNv,vec3(0.0,0.0,1.0)),4.0);float luz=smoothstep(-0.35,0.45,dot(normalize(vNw),normalize(-vPw)));gl_FragColor=vec4(cor,1.0)*clamp(i*1.6,0.0,0.75)*(0.3+0.7*luz);}` });

  const GEO = [new THREE.SphereGeometry(1, 64, 40), new THREE.SphereGeometry(1, 64, 40), new THREE.SphereGeometry(1, 24, 16), new THREE.SphereGeometry(1, 14, 10)];
  const claro = (hex: string, q: number) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), q);
  const corpos = new Map<No, Corpo>();
  const C = (n: No) => corpos.get(n)!;
  let raiz: No | null = null, lista: No[] = [], coroa: THREE.Mesh | null = null;
  const extras: THREE.Object3D[] = []; // some com "reduzir"

  function criarCorpo(n: No) {
    const g = new THREE.Group(); cena.add(g);
    const c: Corpo = { g, linhas: [], rotulo: document.createElement("div"), pos: new THREE.Vector3(), sx: 0, sy: 0, sr: 0, frente: false, vis: false, giro: 0, larg: 0, caixa: null };
    if (n.prof === 0) {
      c.malha = new THREE.Mesh(GEO[0], matSol); c.malha.scale.setScalar(n.s); g.add(c.malha);
      coroa = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matCoroa); coroa.scale.setScalar(n.s * 10); coroa.visible = !reduzido; g.add(coroa);
      for (const [esc, opac, cor] of [[4.2, 0.9, [255, 196, 120]], [11, 0.45, [255, 150, 80]]] as const) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(cor[0], cor[1], cor[2], 0.12), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opac })); sp.scale.setScalar(n.s * esc); g.add(sp);
      }
    } else if (n.tipo === "novo") {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMais(), color: claro(n.cor, 0.3), transparent: true, depthWrite: false })); sp.scale.setScalar(n.s * 2.6); g.add(sp);
    } else {
      const planeta = n.tipo === "espaco" && !!n.mundo, terra = n.mundo === "terra";
      const mat = planeta ? matPlaneta(texMundo(n.mundo!), { atmo: n.cor, esp: terra ? 1.4 : 0, noite: terra ? texNoite() : undefined })
        : new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, map: texLua(Math.floor(semente(n.id) * 3)), color: claro(n.cor, n.prof === 1 ? 0.25 : 0.45) });
      c.malha = new THREE.Mesh(GEO[Math.min(3, n.prof)], mat); c.malha.scale.setScalar(n.s); c.malha.rotation.z = 0.2 + semente(`${n.id}z`) * 0.4; c.giro = 0.05 + semente(`${n.id}g`) * 0.08; g.add(c.malha);
      if (planeta) {
        const at = new THREE.Mesh(GEO[1], matAtmo(n.cor)); at.scale.setScalar(n.s * 1.09); g.add(at);
        if (terra) { c.nuvens = new THREE.Mesh(GEO[1], matPlaneta(texNuvens(), { transparente: true })); c.nuvens.scale.setScalar(n.s * 1.015); c.nuvens.visible = !reduzido; g.add(c.nuvens); }
        if (n.aneis) {
          const rg = new THREE.RingGeometry(n.s * 1.35, n.s * 2.25, 128, 1), p = rg.attributes.position, uv = rg.attributes.uv;
          for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - n.s * 1.35) / (n.s * 0.9), 0.5);
          const an = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: texAnel(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 })); an.rotation.x = Math.PI / 2 - 0.42; an.rotation.y = 0.2; g.add(an);
        }
      } else if (n.tipo === "hoje") {
        const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(255, 255, 255), color: n.cor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); h.scale.setScalar(n.s * 6); g.add(h);
      }
    }
    for (const r of new Set(n.filhos.map((k) => k.r))) {
      const pts = Array.from({ length: 200 }, (_, i) => new THREE.Vector3(Math.cos((i / 200) * 2 * Math.PI) * r, 0, Math.sin((i / 200) * 2 * Math.PI) * r));
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fb6e8, transparent: true, opacity: 0.2, depthWrite: false }));
      l.rotation.x = n.incl; cena.add(l); c.linhas.push(l);
    }
    c.rotulo.className = `orbita-nome${n.prof <= 1 ? " grande" : ""}`; c.rotulo.style.setProperty("--cor", n.cor);
    const bola = document.createElement("i"), texto = document.createElement("span"); texto.textContent = n.nome; c.rotulo.append(bola, texto); c.rotulo.hidden = true; nomes.append(c.rotulo);
    corpos.set(n, c);
  }
  function limpar() {
    for (const c of corpos.values()) { cena.remove(c.g); c.linhas.forEach((l) => { cena.remove(l); l.geometry.dispose(); }); c.rotulo.remove(); }
    corpos.clear(); coroa = null;
  }

  // Cinturão de pedras e um cometa (somem com "reduzir").
  const cinturao = (() => { const q = 1600, pos = new Float32Array(q * 3); for (let i = 0; i < q; i++) { const a = rnd(i * 2.3) * 2 * Math.PI, r = 21.5 + rnd(i * 5.1) * 5; pos.set([Math.cos(a) * r, (rnd(i * 9.7) - 0.5) * 1.3, Math.sin(a) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9a9184, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.8 })); cena.add(p); return p; })();
  const cometa = (() => { const cab = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(255, 255, 255), color: 0xcfe6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); cab.scale.setScalar(2.2); cena.add(cab);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array([0.7, 0.85, 1, 0, 0, 0]), 3));
    const cauda = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); cauda.frustumCulled = false; cena.add(cauda); return { cab, cauda, a: 2.2 }; })();
  const marca = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMarca(), transparent: true, depthWrite: false })); marca.visible = false; cena.add(marca);
  extras.push(cinturao, cometa.cab, cometa.cauda, estrelasGrandes);

  // ---------- Câmera livre ----------
  // A vista fica presa a um corpo (o foco) mais um desvio. Ao passar perto de outro sistema,
  // ela se prende a ele sozinha, sem pulo: assim dá para passear de um para o outro.
  let W = 1, H = 1, t = 0, antes = performance.now(), foco: No, sel: No | null = null, explicito = 0, grudado: No | null = null;
  let az = 0.7, el = 0.42, dist = 400, distAlvo = 130, vel: Velocidade = op.velocidade, reduzido = op.reduzido, modoPassear = false, vivo = true, quadroId = 0;
  const off = new THREE.Vector3(), offAlvo = new THREE.Vector3(), velPan = new THREE.Vector3(), alvo = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const K = () => H / 2 / Math.tan((cam.fov * Math.PI) / 360);
  const largo = () => W > 900;
  const encaixe = (n: No) => { const aspecto = largo() ? (W - 320) / H : W / H; return (n.ext * 1.08) / (Math.tan((cam.fov * Math.PI) / 360) * Math.min(1, Math.max(0.2, aspecto))); };
  const temFilhos = (n: No) => n.filhos.length > 0;
  function medir() {
    const r = tela.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); render.setSize(W, H, false); cam.aspect = W / H;
    // O centro da vista desvia do cartão: ao lado dele no computador, acima dele no celular.
    cam.setViewOffset(W, H, largo() ? 150 : 0, largo() ? 0 : H * 0.17, W, H);
  }
  function posicoes(n: No) {
    const c = C(n);
    if (n.pai) { const [x, y, z] = posicaoLocal(n, t), p = C(n.pai).pos; c.pos.set(p.x + x, p.y + y, p.z + z); }
    c.g.position.copy(c.pos); for (const l of c.linhas) l.position.copy(c.pos);
    for (const k of n.filhos) posicoes(k);
  }
  function trocarFoco(n: No, avisar = true) { if (n === foco) return; v3.copy(C(foco).pos).sub(C(n).pos); off.add(v3); offAlvo.add(v3); foco = n; if (avisar) op.aoMudar(foco, undefined); }
  function voarPara(n: No) { trocarFoco(n, false); offAlvo.set(0, 0, 0); velPan.set(0, 0, 0); distAlvo = encaixe(n); explicito = performance.now(); grudado = n; }
  function sistemaAqui(): No {
    if (grudado === foco && off.length() < Math.max(foco.ext * 1.6, foco.s * 10)) return foco;
    if (!temFilhos(foco) && off.length() < foco.s * 8 && dist < foco.s * 45) return foco;
    let cur = raiz!;
    for (;;) {
      const k = cur.filhos.find((c) => { if (!temFilhos(c)) return false; const meu = c === foco || ancestral(c, foco); return C(c).pos.distanceTo(alvo) < c.ext * (meu ? 1.35 : 1.0) && dist < encaixe(c) * (meu ? 2.8 : 1.9); });
      if (!k) return cur;
      cur = k;
    }
  }
  function naTela(n: No) { const c = C(n); v3.copy(c.pos).project(cam); c.sx = (v3.x * 0.5 + 0.5) * W; c.sy = (-v3.y * 0.5 + 0.5) * H; c.frente = v3.z < 1; c.sr = (n.s / Math.max(0.001, cam.position.distanceTo(c.pos))) * K(); }

  // O Órbita mede os primeiros segundos: se o aparelho não acompanha, avisa (uma vez).
  const medida = { desde: 0, quadros: 0, feito: op.reduzido };
  function quadro() {
    if (!vivo) return;
    quadroId = requestAnimationFrame(quadro);
    if (!raiz) return;
    const agora = performance.now(), dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
    if (!medida.feito && document.visibilityState === "visible") {
      if (!medida.desde) medida.desde = agora + 1500;
      else if (agora > medida.desde) { medida.quadros++; if (agora - medida.desde > 3500) { medida.feito = true; if (medida.quadros / 3.5 < 30) op.aoPesado(); } }
    }
    t += dt * VEL[vel]; if (vel !== 2) matSol.uniforms.t.value += dt; matCoroa.uniforms.t.value = matSol.uniforms.t.value;
    posicoes(raiz);
    if (!arrasto && velPan.lengthSq() > 1e-5) { off.addScaledVector(velPan, dt); offAlvo.addScaledVector(velPan, dt); velPan.multiplyScalar(Math.exp(-dt * 3.5)); }
    const k = vel === 2 ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 6);
    off.lerp(offAlvo, k); dist = Math.exp(Math.log(dist) + (Math.log(distAlvo) - Math.log(dist)) * k);
    // Não deixa ir para o vazio, longe de tudo.
    v3.copy(C(foco).pos).add(offAlvo); const lim = raiz.ext * 1.02; if (v3.length() > lim) { v3.setLength(lim); offAlvo.copy(v3).sub(C(foco).pos); velPan.set(0, 0, 0); }
    alvo.copy(C(foco).pos).add(off);
    if (agora - explicito > 900) { const s = sistemaAqui(); if (s !== foco) { trocarFoco(s); if (grudado !== s) grudado = null; } }
    cam.near = Math.max(0.01, dist * 0.02); cam.updateProjectionMatrix();
    cam.position.set(alvo.x + dist * Math.cos(el) * Math.sin(az), alvo.y + dist * Math.sin(el), alvo.z + dist * Math.cos(el) * Math.cos(az)); cam.lookAt(alvo); cam.updateMatrixWorld();
    if (coroa) coroa.quaternion.copy(cam.quaternion);
    cinturao.rotation.y = -t * ((2 * Math.PI) / 400);
    { const c = cometa; c.a += (dt * VEL[vel] * 54) / Math.pow(Math.max(8, c.cab.position.length()), 1.5); const e = 0.72, r = (62 * (1 - e * e)) / (1 + e * Math.cos(c.a));
      c.cab.position.set(Math.cos(c.a) * r, Math.sin(c.a + 1) * r * 0.22, Math.sin(c.a) * r * 0.9);
      const p = c.cauda.geometry.attributes.position, d = v4.copy(c.cab.position).normalize(), comp = 6 + 260 / Math.max(10, r);
      p.setXYZ(0, c.cab.position.x, c.cab.position.y, c.cab.position.z); p.setXYZ(1, c.cab.position.x + d.x * comp, c.cab.position.y + d.y * comp, c.cab.position.z + d.z * comp); p.needsUpdate = true; }
    lista.forEach(naTela);
    for (const n of lista) {
      const c = C(n);
      c.vis = !n.pai || n.pai === raiz || (C(n.pai).vis && C(n.pai).sr > 9);
      c.g.visible = c.vis;
      if (c.malha && n !== raiz) c.malha.rotation.y += c.giro * dt * VEL[vel];
      if (c.nuvens) c.nuvens.rotation.y += c.giro * 1.5 * dt * VEL[vel];
      for (const l of c.linhas) { l.visible = c.vis && (n === raiz || c.sr > 9); (l.material as THREE.LineBasicMaterial).opacity = n === foco || ancestral(n, foco) ? 0.28 : 0.12; }
      c.caixa = null;
    }
    // Nomes: uma etiqueta por corpo visível; se duas se sobrepõem, fica a mais importante.
    const cand = lista.filter((n) => { const c = C(n); return c.vis && c.frente && (n.prof <= 1 || c.sr > 5 || n === sel || n === foco) && c.sx > -60 && c.sx < W + 60 && c.sy > -40 && c.sy < H + 40; })
      .sort((a, b) => Number(b === sel) - Number(a === sel) || Number(b === foco) - Number(a === foco) || a.prof - b.prof || C(b).sr - C(a).sr);
    const postos: NonNullable<Corpo["caixa"]>[] = [];
    for (const n of cand) {
      const c = C(n);
      if (!c.larg) { c.rotulo.hidden = false; c.larg = c.rotulo.offsetWidth || 80; }
      const cx = { x: c.sx - c.larg / 2, y: c.sy + Math.max(5, c.sr) + 7, w: c.larg, h: 26 };
      if (postos.some((p) => cx.x < p.x + p.w + 4 && cx.x + cx.w + 4 > p.x && cx.y < p.y + p.h + 3 && cx.y + cx.h + 3 > p.y)) continue;
      postos.push(cx); c.caixa = cx;
    }
    for (const n of lista) {
      const c = C(n);
      c.rotulo.hidden = !c.caixa; if (!c.caixa) continue;
      c.rotulo.style.transform = `translate(${c.caixa.x}px, ${c.caixa.y}px)`;
      c.rotulo.classList.toggle("forte", n === foco || n === sel); c.rotulo.classList.toggle("longe", !(n === foco || n === sel || n.pai === foco || n.prof <= 1));
    }
    marca.visible = !!sel && corpos.has(sel) && C(sel).vis; if (marca.visible && sel) { marca.position.copy(C(sel).pos); marca.scale.setScalar(Math.max(sel.s * 3.2, dist * 0.035)); }
    render.render(cena, cam);
  }

  // ---------- Mouse, dedo e pinça ----------
  const dedos = new Map<number, { x: number; y: number }>();
  let arrasto: { x: number; y: number; ux: number; uy: number; ut: number; andou: number; gira: boolean } | null = null, pinca: { d: number; mx: number; my: number } | null = null;
  const raio = new THREE.Raycaster(), chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ponto = new THREE.Vector3();
  const local = (e: { clientX: number; clientY: number }) => { const r = tela.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function corpoEm(x: number, y: number): No | undefined {
    return lista.filter((n) => { const c = C(n); return c.vis && c.frente && (Math.hypot(c.sx - x, c.sy - y) <= Math.max(c.sr, 16) || (!!c.caixa && x >= c.caixa.x && x <= c.caixa.x + c.caixa.w && y >= c.caixa.y && y <= c.caixa.y + c.caixa.h)); })
      .sort((a, b) => C(a).sr - C(b).sr)[0];
  }
  function passear(dx: number, dy: number, dt: number) {
    const esc = dist / K(), s = Math.max(0.35, Math.sin(el));
    v3.set(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(-dx * esc).add(v4.set(-Math.sin(az), 0, -Math.cos(az)).multiplyScalar((dy * esc) / s));
    off.add(v3); offAlvo.add(v3); grudado = null; explicito = 0;
    if (dt > 0) velPan.lerp(v4.copy(v3).multiplyScalar(1 / dt), 0.5);
  }
  function zoom(fator: number, x?: number, y?: number) {
    const sob = x === undefined || y === undefined ? undefined : corpoEm(x, y);
    if (fator < 1 && sob && sob !== foco && sob !== raiz && !ancestral(sob, foco)) {
      // Chegando perto de um corpo: a vista se prende a ele e vai junto.
      trocarFoco(sob); grudado = sob; explicito = performance.now(); offAlvo.multiplyScalar(0.55); distAlvo = Math.max(sob.s * 1.7, Math.min(distAlvo * fator, encaixe(sob) * 2.4)); return;
    }
    if (x !== undefined && y !== undefined) {
      // Zoom no ponto do mouse (ou no meio dos dedos), no plano das órbitas.
      raio.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1), cam); chao.constant = -alvo.y;
      if (raio.ray.intersectPlane(chao, ponto) && ponto.distanceTo(alvo) < dist * 4) { ponto.sub(C(foco).pos); offAlvo.sub(ponto).multiplyScalar(fator).add(ponto); }
    }
    const perto = offAlvo.length() < foco.s * 1.3;
    distAlvo = Math.min(encaixe(raiz!) * 2, Math.max(perto ? foco.s * 1.7 : 0.5, distAlvo * fator));
    if (fator > 1 && grudado && distAlvo > encaixe(grudado) * 3) grudado = null;
    velPan.set(0, 0, 0);
  }
  const girarVista = (dx: number, dy: number) => { az -= dx * 0.006; el = Math.max(0.06, Math.min(1.45, el + dy * 0.005)); };
  const aoRoda = (e: WheelEvent) => { e.preventDefault(); const p = local(e); zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)), p.x, p.y); };
  const aoMenu = (e: Event) => e.preventDefault();
  const aoDescer = (e: PointerEvent) => {
    tela.setPointerCapture(e.pointerId); const p = local(e); dedos.set(e.pointerId, p);
    // Um dedo (ou o botão esquerdo) gira a vista; botão direito, do meio, Shift ou o modo "Passear" andam para os lados.
    if (dedos.size === 1) { arrasto = { ...p, ux: p.x, uy: p.y, ut: performance.now(), andou: 0, gira: !(modoPassear || e.button === 2 || e.button === 1 || e.shiftKey) }; velPan.set(0, 0, 0); }
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; arrasto = null; }
    tela.classList.add("pegando");
  };
  const aoMover = (e: PointerEvent) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, local(e));
    if (pinca && dedos.size === 2) {
      // Dois dedos: abrir e fechar aproxima; mover os dois juntos passeia para os lados.
      const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (Math.abs(d - pinca.d) > 1.5) { zoom(pinca.d / d, mx, my); pinca.d = d; }
      passear(mx - pinca.mx, my - pinca.my, 0.016); pinca.mx = mx; pinca.my = my; return;
    }
    if (!arrasto) return;
    const p = local(e), agora = performance.now(), dx = p.x - arrasto.ux, dy = p.y - arrasto.uy;
    arrasto.andou = Math.max(arrasto.andou, Math.hypot(p.x - arrasto.x, p.y - arrasto.y));
    if (arrasto.andou > 5) { if (arrasto.gira) girarVista(dx, dy); else passear(dx, dy, (agora - arrasto.ut) / 1000); }
    arrasto.ux = p.x; arrasto.uy = p.y; arrasto.ut = agora;
  };
  const aoSoltar = (e: PointerEvent) => {
    const p = dedos.get(e.pointerId); dedos.delete(e.pointerId); if (dedos.size < 2) pinca = null; tela.classList.remove("pegando");
    if (arrasto && p) {
      if (arrasto.andou <= 5) { const a = corpoEm(p.x, p.y); velPan.set(0, 0, 0); if (a) { sel = temFilhos(a) ? null : a; voarPara(a); op.aoMudar(foco, a); } else if (sel) { sel = null; op.aoMudar(foco, null); } }
      else if (performance.now() - arrasto.ut > 90) velPan.set(0, 0, 0);
    }
    if (!dedos.size) arrasto = null;
  };
  const aoTecla = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
    const passo = ({ ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] } as Record<string, [number, number]>)[e.key];
    if (passo) { e.preventDefault(); passear(passo[0], passo[1], 0); }
    else if (e.key === "+" || e.key === "=") zoom(0.75);
    else if (e.key === "-") zoom(1.35);
  };
  tela.addEventListener("wheel", aoRoda, { passive: false }); tela.addEventListener("contextmenu", aoMenu);
  tela.addEventListener("pointerdown", aoDescer); tela.addEventListener("pointermove", aoMover); tela.addEventListener("pointerup", aoSoltar); tela.addEventListener("pointercancel", aoSoltar);
  window.addEventListener("keydown", aoTecla);
  const ro = new ResizeObserver(medir); ro.observe(tela);
  medir();
  if (op.reduzido) for (const o of extras) o.visible = false;
  quadroId = requestAnimationFrame(quadro);

  return {
    definir(nova) {
      const idFoco = raiz ? foco.id : null, idSel = sel?.id ?? null, primeira = !raiz;
      limpar(); raiz = nova; lista = todos(nova); lista.forEach(criarCorpo);
      foco = lista.find((n) => n.id === idFoco) ?? nova; sel = lista.find((n) => n.id === idSel) ?? null;
      posicoes(nova);
      if (primeira) { if (!largo()) el = 1.0; distAlvo = encaixe(nova); dist = distAlvo * (vel === 2 ? 1 : 3.2); }
      else if (foco === nova && idFoco !== nova.id) { off.set(0, 0, 0); offAlvo.set(0, 0, 0); distAlvo = encaixe(nova); }
      op.aoMudar(foco, sel);
    },
    irPara(n) { if (!corpos.has(n)) return; sel = temFilhos(n) ? null : n; voarPara(n); op.aoMudar(foco, sel); },
    marcar(n) { sel = n; },
    foco: () => foco,
    zoom: (f) => zoom(f),
    velocidade(v) { vel = v; },
    passear(l) { modoPassear = l; },
    reduzir(l) { reduzido = l; medida.feito = true; render.setPixelRatio(l ? 1 : Math.min(2, devicePixelRatio || 1)); medir(); for (const o of extras) o.visible = !l; if (coroa) coroa.visible = !l; for (const c of corpos.values()) if (c.nuvens) c.nuvens.visible = !l; },
    destruir() {
      vivo = false; cancelAnimationFrame(quadroId); ro.disconnect(); window.removeEventListener("keydown", aoTecla);
      tela.removeEventListener("wheel", aoRoda); tela.removeEventListener("contextmenu", aoMenu);
      tela.removeEventListener("pointerdown", aoDescer); tela.removeEventListener("pointermove", aoMover); tela.removeEventListener("pointerup", aoSoltar); tela.removeEventListener("pointercancel", aoSoltar);
      limpar(); render.dispose(); render.domElement.remove();
    },
  };
}
