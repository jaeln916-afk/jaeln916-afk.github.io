/* ==========================================================================
   Talleres Juma — scene.js  (v2)
   Fondo 3D: tren de engranajes de precisión que engranan de verdad.

   - Engranajes con aro dentado, alma rebajada con agujeros de aligeramiento,
     cubo torneado y tornillo hexagonal de latón (sin cilindros lisos).
   - Los dientes encajan: velocidades y fases calculadas por relación de
     dientes, cada rueda gira en sentido contrario a su vecina.
   - Segundo plano con otro tren más grande y oscuro (profundidad/parallax).
   - Decoración técnica: diales graduados tipo bisel, círculos primitivos
     y líneas de centros (estética de plano de ingeniería), polvo de metal.
   - Materiales PBR con mapa de entorno procedural (tiras de luz de estudio).
   - Animación: entrada ensamblándose, parallax con el puntero, el scroll
     orbita la cámara Y acelera/invierte el giro, luz de brillo que barre.
   - Respeta prefers-reduced-motion. Fallback CSS si no hay WebGL.

   Compatible con Three.js r128. Mismos IDs que antes:
   #scene-canvas y #sceneFallback.
   ========================================================================== */

(function () {
  "use strict";

  var canvas = document.getElementById("scene-canvas");
  var fallback = document.getElementById("sceneFallback");

  if (!canvas || typeof THREE === "undefined") {
    if (fallback) fallback.classList.add("active");
    return;
  }

  var isMobile = window.innerWidth < 900;
  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var hasFinePointer = !!(window.matchMedia &&
    window.matchMedia("(pointer: fine)").matches);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance"
    });
  } catch (e) {
    if (fallback) fallback.classList.add("active");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = reduceMotion ? 1.1 : 0.2;
  renderer.shadowMap.enabled = !isMobile;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var running = true;
  canvas.addEventListener("webglcontextlost", function (ev) {
    ev.preventDefault();
    running = false;
    if (fallback) fallback.classList.add("active");
  }, false);

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clampRange(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  var scene = new THREE.Scene();
  var NAVY = 0x060c2b;
  scene.fog = new THREE.FogExp2(NAVY, isMobile ? 0.042 : 0.034);

  var camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(0, 2.2, 14);

  // ---------------------------------------------------------------------
  // Textura procedural de imperfecciones (metal cepillado / uso real)
  // ---------------------------------------------------------------------

  function buildImperfectionTexture() {
    var size = 256;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(size, size);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var i = (y * size + x) * 4;
        var streak = Math.sin(x * 0.14 + Math.sin(y * 0.05) * 2.0) * 10;
        var grain = (Math.random() - 0.5) * 26;
        var v = 168 + streak + grain;
        v = Math.max(90, Math.min(235, v));
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.4, 1.4);
    return tex;
  }

  var imperfectionTex = buildImperfectionTexture();

  // ---------------------------------------------------------------------
  // Mapa de entorno procedural: estudio con softboxes y tiras de luz
  // ---------------------------------------------------------------------

  function buildEnvTexture(rendererRef) {
    if (typeof THREE.PMREMGenerator === "undefined") return null;
    try {
      var envScene = new THREE.Scene();

      var skyGeo = new THREE.SphereGeometry(60, 32, 16);
      var pos = skyGeo.attributes.position;
      var colors = new Float32Array(pos.count * 3);
      var top = new THREE.Color(0x263766);
      var bottom = new THREE.Color(0x05060f);
      var tmp = new THREE.Color();
      for (var i = 0; i < pos.count; i++) {
        var t = THREE.MathUtils.clamp((pos.getY(i) + 60) / 120, 0, 1);
        tmp.copy(bottom).lerp(top, t);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      skyGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      var skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      function panel(x, y, z, rx, ry, rz, w, h, intensity, color) {
        var mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        mat.color.multiplyScalar(intensity);
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        envScene.add(mesh);
      }
      // Softbox principal (cálido)
      panel(11, 9, 5, 0, -0.55, 0, 16, 11, 3.0, 0xfff2df);
      // Relleno frío (azul de marca)
      panel(-15, 1, 3, 0, 0.55, 0, 13, 17, 1.5, 0x3b63ec);
      // Contraluz (rojo de marca)
      panel(1, -5, -15, 0, 3.35, 0, 11, 11, 2.0, 0xef2430);
      // Techo suave de estudio
      panel(0, 22, 0, Math.PI / 2, 0, 0, 30, 30, 0.8, 0xaeb8d8);
      // Referencia tenue de "suelo" (solo para reflejos, no se ve)
      panel(0, -20, 0, -Math.PI / 2, 0, 0, 40, 40, 0.12, 0x0a0d1c);
      // Tiras de luz: dan brillos largos y nítidos que recorren los dientes
      panel(-3, 7, 9, 0.5, 0.15, 0, 2.2, 18, 5.0, 0xffffff);
      panel(14, -1, -4, 0, -1.2, 0, 1.8, 16, 3.5, 0xcfe0ff);

      var pmrem = new THREE.PMREMGenerator(rendererRef);
      var target = pmrem.fromScene(envScene, 0.035);
      pmrem.dispose();
      return target.texture;
    } catch (e) {
      return null;
    }
  }

  var envTexture = buildEnvTexture(renderer);

  // ---------------------------------------------------------------------
  // Materiales metálicos PBR
  // ---------------------------------------------------------------------

  function metalMaterial(color, roughness, envIntensity) {
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 1.0,
      roughness: roughness,
      roughnessMap: imperfectionTex,
      envMapIntensity: envIntensity
    });
    if (envTexture) mat.envMap = envTexture;
    return mat;
  }

  var steelDark = metalMaterial(0x767e97, 0.4, 1.25);
  var steelLight = metalMaterial(0xc7cde2, 0.3, 1.35);
  var gunmetal = metalMaterial(0x4a5270, 0.5, 0.95);
  var brass = metalMaterial(0xc19a5b, 0.32, 1.3);

  var redAccent = metalMaterial(0xb4131f, 0.38, 1.2);
  redAccent.emissive = new THREE.Color(0x220305);
  redAccent.emissiveIntensity = 0.35;
  redAccent.clearcoat = 0.5;
  redAccent.clearcoatRoughness = 0.25;

  var blueAnodized = metalMaterial(0x2f52d6, 0.34, 1.3);
  blueAnodized.emissive = new THREE.Color(0x050c26);
  blueAnodized.emissiveIntensity = 0.4;
  blueAnodized.clearcoat = 0.35;
  blueAnodized.clearcoatRoughness = 0.3;

  // ---------------------------------------------------------------------
  // Geometría de engranaje procedural
  //   - Dientes trapezoidales con módulo común -> engranan entre sí.
  //   - Aro grueso + alma más delgada con agujeros de aligeramiento.
  //   - Cubo torneado (LatheGeometry) con hueco central y tornillo hex.
  // ---------------------------------------------------------------------

  var MODULE = 0.22;
  function pitchR(n) { return n * MODULE * 0.5; }

  function polar(r, a) { return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }

  // El diente 0 queda centrado en el ángulo 0 (necesario para la fase).
  function buildRimShape(teeth, rootR, tipR, innerR) {
    var shape = new THREE.Shape();
    var pa = (Math.PI * 2) / teeth;
    var rootHalf = pa * 0.30;
    var tipHalf = pa * 0.13;

    for (var i = 0; i < teeth; i++) {
      var c = i * pa;
      var pts = [
        polar(rootR, c - rootHalf),
        polar(tipR, c - tipHalf),
        polar(tipR, c + tipHalf),
        polar(rootR, c + rootHalf)
      ];
      for (var k = 0; k < 4; k++) {
        if (i === 0 && k === 0) shape.moveTo(pts[k].x, pts[k].y);
        else shape.lineTo(pts[k].x, pts[k].y);
      }
    }
    shape.closePath();

    var hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return shape;
  }

  function buildWebShape(outerR, boreR, holes, holeR, ringR, phase) {
    var shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

    var bore = new THREE.Path();
    bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(bore);

    for (var i = 0; i < holes; i++) {
      var a = phase + (i * Math.PI * 2) / holes;
      var h = new THREE.Path();
      h.absarc(Math.cos(a) * ringR, Math.sin(a) * ringR, holeR, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    return shape;
  }

  function buildHexShape(r, socketR) {
    var s = new THREE.Shape();
    var i, a;
    for (i = 0; i < 6; i++) {
      a = (i * Math.PI) / 3 + Math.PI / 6;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    var h = new THREE.Path();
    for (i = 0; i < 6; i++) {
      a = (i * Math.PI) / 3;
      if (i === 0) h.moveTo(Math.cos(a) * socketR, Math.sin(a) * socketR);
      else h.lineTo(Math.cos(a) * socketR, Math.sin(a) * socketR);
    }
    h.closePath();
    s.holes.push(h);
    return s;
  }

  function makeGear(teeth, thick, mat, hubMat, holes, shadows) {
    var rp = pitchR(teeth);
    var rootR = rp - 1.25 * MODULE;
    var tipR = rp + 0.9 * MODULE;
    var rimInner = rootR * 0.84;
    var collarR = rp * 0.3;
    var bevT = thick * 0.1;
    var spin = new THREE.Group();

    // Aro dentado
    var rimGeo = new THREE.ExtrudeGeometry(
      buildRimShape(teeth, rootR, tipR, rimInner),
      {
        depth: thick,
        bevelEnabled: true,
        bevelThickness: bevT,
        bevelSize: MODULE * 0.09,
        bevelSegments: isMobile ? 2 : 3,
        curveSegments: 36
      }
    );
    rimGeo.translate(0, 0, -thick / 2);
    var rim = new THREE.Mesh(rimGeo, mat);
    rim.castShadow = shadows;
    rim.receiveShadow = shadows;
    spin.add(rim);

    // Alma rebajada con agujeros de aligeramiento
    var webT = thick * 0.5;
    var hr = 0, ringR = 0;
    if (holes > 0) {
      var rIn = collarR * 1.22;
      var rOut = rimInner * 0.94;
      ringR = (rIn + rOut) / 2;
      hr = Math.min(
        ((rOut - rIn) / 2) * 0.92,
        ringR * Math.sin(Math.PI / holes) * 0.72
      );
    }
    var webOuter = rimInner + (rootR - rimInner) * 0.6;
    var webGeo = new THREE.ExtrudeGeometry(
      buildWebShape(webOuter, collarR * 0.8, holes, hr, ringR, Math.PI / holes),
      {
        depth: webT,
        bevelEnabled: true,
        bevelThickness: webT * 0.12,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 40
      }
    );
    webGeo.translate(0, 0, -webT / 2);
    var web = new THREE.Mesh(webGeo, mat);
    web.receiveShadow = shadows;
    spin.add(web);

    // Cubo torneado con brida y hueco central
    var hh = thick * 0.5 + bevT + 0.09;
    var rc = collarR;
    var prof = [
      [0, -hh * 0.8], [rc * 0.52, -hh * 0.8], [rc * 0.6, -hh], [rc * 0.9, -hh],
      [rc, -hh * 0.86], [rc, hh * 0.86], [rc * 0.9, hh], [rc * 0.6, hh],
      [rc * 0.52, hh * 0.8], [0, hh * 0.8]
    ].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var hubGeo = new THREE.LatheGeometry(prof, isMobile ? 28 : 44);
    hubGeo.rotateX(Math.PI / 2);
    var hub = new THREE.Mesh(hubGeo, hubMat);
    hub.castShadow = shadows;
    spin.add(hub);

    // Tornillos hexagonales de latón (con hueco Allen) a ambos lados
    var hexR = rc * 0.34;
    var hexD = 0.1;
    var hexGeo = new THREE.ExtrudeGeometry(buildHexShape(hexR, hexR * 0.45), {
      depth: hexD,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 6
    });
    hexGeo.translate(0, 0, -hexD / 2);
    var zFloor = hh * 0.8 + hexD * 0.35;
    var hexF = new THREE.Mesh(hexGeo, brass);
    hexF.position.z = zFloor;
    var hexB = new THREE.Mesh(hexGeo, brass);
    hexB.position.z = -zFloor;
    spin.add(hexF);
    spin.add(hexB);

    spin.userData.rp = rp;
    spin.userData.faceZ = thick * 0.5 + bevT;
    return spin;
  }

  // ---------------------------------------------------------------------
  // Trenes de engranajes: cada rueda se coloca a la distancia de paso de
  // su "padre" y su fase se calcula para que los dientes encajen.
  // ---------------------------------------------------------------------

  function buildChain(defs, z, shadows) {
    var items = [];
    defs.forEach(function (d) {
      var spin = makeGear(d.teeth, d.thick, d.mat, d.hubMat, d.holes, shadows);
      var holder = new THREE.Group();
      holder.add(spin);

      var parent = d.parent == null ? null : items[d.parent];
      var theta = ((d.theta || 0) * Math.PI) / 180;
      var x = d.x || 0;
      var y = d.y || 0;
      if (parent) {
        var dist = (pitchR(parent.teeth) + pitchR(d.teeth)) * 1.014;
        x = parent.x + Math.cos(theta) * dist;
        y = parent.y + Math.sin(theta) * dist;
      }
      holder.position.set(x, y, z);

      items.push({
        holder: holder,
        spin: spin,
        teeth: d.teeth,
        parent: parent,
        theta: theta,
        x: x,
        y: y,
        rest: new THREE.Vector3(x, y, z),
        angle: 0
      });
    });
    return items;
  }

  // Rueda conducida: gira en sentido contrario, con relación de dientes
  // y fase tal que un diente de la vecina cae en el hueco de ésta.
  function updateChain(items, driverAngle) {
    for (var i = 0; i < items.length; i++) {
      var g = items[i];
      if (!g.parent) {
        g.angle = driverAngle;
      } else {
        g.angle = g.theta + Math.PI +
          (g.parent.teeth * (g.theta - g.parent.angle) - Math.PI) / g.teeth;
      }
      g.spin.rotation.z = g.angle;
    }
  }

  var rig = new THREE.Group();
  rig.position.set(0.25, 0.55, 0);
  scene.add(rig);

  var bgRig = new THREE.Group();
  scene.add(bgRig);

  // Tren principal (plano z = 0): héroe + 4 ruedas engranadas
  var fg = buildChain([
    { teeth: 22, thick: 0.56, mat: steelLight,   hubMat: steelDark,  holes: 6, x: 0, y: 0 },
    { teeth: 14, thick: 0.5,  mat: steelDark,    hubMat: steelLight, holes: 5, parent: 0, theta: 38 },
    { teeth: 10, thick: 0.46, mat: redAccent,    hubMat: steelLight, holes: 0, parent: 0, theta: 203 },
    { teeth: 16, thick: 0.5,  mat: steelDark,    hubMat: steelLight, holes: 5, parent: 0, theta: -48 },
    { teeth: 12, thick: 0.46, mat: blueAnodized, hubMat: steelLight, holes: 3, parent: 2, theta: -105 }
  ], 0, !isMobile);
  fg.forEach(function (g) { rig.add(g.holder); });

  // Tren de fondo: más grande, oscuro y lejano (profundidad)
  var bgA = buildChain([
    { teeth: 34, thick: 0.7, mat: gunmetal, hubMat: steelDark, holes: 8, x: -9, y: 2.5 },
    { teeth: 20, thick: 0.6, mat: gunmetal, hubMat: steelDark, holes: 6, parent: 0, theta: -70 }
  ], -6.5, false);
  var bgB = buildChain([
    { teeth: 28, thick: 0.66, mat: gunmetal, hubMat: steelDark, holes: 7, x: 9.5, y: -2.5 },
    { teeth: 16, thick: 0.56, mat: gunmetal, hubMat: steelDark, holes: 5, parent: 0, theta: 100 }
  ], -6.5, false);
  bgA.concat(bgB).forEach(function (g) { bgRig.add(g.holder); });

  // ---------------------------------------------------------------------
  // Decoración técnica (estética de plano de ingeniería)
  // ---------------------------------------------------------------------

  // Dial graduado tipo bisel, dibujado en un canvas (sin imágenes externas)
  function buildDialTexture() {
    var S = 1024;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var d, a;

    function ring(r, w, style) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.lineWidth = w;
      g.strokeStyle = style;
      g.stroke();
    }
    function arc(r, a0, a1, w, style) {
      g.beginPath();
      g.arc(0, 0, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
      g.lineWidth = w;
      g.strokeStyle = style;
      g.stroke();
    }

    ring(506, 3, "rgba(170,190,255,0.9)");
    ring(468, 1.5, "rgba(170,190,255,0.5)");
    ring(392, 1.5, "rgba(170,190,255,0.4)");
    ring(300, 1, "rgba(170,190,255,0.25)");

    for (d = 0; d < 360; d += 2) {
      a = (d * Math.PI) / 180;
      var major = d % 30 === 0;
      var mid = d % 10 === 0;
      var r2 = major ? 450 : mid ? 474 : 490;
      g.beginPath();
      g.moveTo(Math.cos(a) * 506, Math.sin(a) * 506);
      g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      g.lineWidth = major ? 3 : 1.5;
      g.strokeStyle = major ? "rgba(225,233,255,0.95)" : "rgba(170,190,255,0.6)";
      g.stroke();
    }

    g.fillStyle = "rgba(200,215,255,0.85)";
    g.font = '600 20px "Courier New", monospace';
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (d = 0; d < 360; d += 30) {
      g.save();
      g.rotate((d * Math.PI) / 180 + Math.PI / 2);
      g.translate(0, -424);
      g.fillText(String(d), 0, 0);
      g.restore();
    }

    // Sectores de color de marca
    arc(392, -20, 70, 8, "rgba(239,36,48,0.9)");
    arc(392, 160, 200, 8, "rgba(88,120,255,0.9)");
    arc(340, 210, 320, 3, "rgba(170,190,255,0.7)");
    arc(340, 30, 130, 3, "rgba(170,190,255,0.7)");

    // Marcas cardinales interiores
    for (d = 0; d < 360; d += 90) {
      a = (d * Math.PI) / 180;
      g.beginPath();
      g.moveTo(Math.cos(a) * 300, Math.sin(a) * 300);
      g.lineTo(Math.cos(a) * 356, Math.sin(a) * 356);
      g.lineWidth = 2;
      g.strokeStyle = "rgba(225,233,255,0.8)";
      g.stroke();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  var dialTex = buildDialTexture();

  function makeDial(size, z, maxOpacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.position.z = z;
    mesh.userData.maxOpacity = maxOpacity;
    return mesh;
  }

  var dialNear = makeDial(9.6, -0.9, 0.55);
  rig.add(dialNear);
  var dialFar = makeDial(26, -11, 0.22);
  scene.add(dialFar);

  // Círculos primitivos (paso) y líneas de centros entre ruedas engranadas
  var guideMat = new THREE.LineBasicMaterial({
    color: 0x7f9bff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  function circlePoints(r, segs, z) {
    var pts = [];
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z));
    }
    return pts;
  }

  fg.forEach(function (g) {
    var faceZ = g.spin.userData.faceZ + 0.01;
    var pitchCircle = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(circlePoints(g.spin.userData.rp, 120, faceZ)),
      guideMat
    );
    g.holder.add(pitchCircle);
  });

  var linkPts = [];
  fg.forEach(function (g) {
    if (g.parent) {
      linkPts.push(new THREE.Vector3(g.parent.x, g.parent.y, 0.45));
      linkPts.push(new THREE.Vector3(g.x, g.y, 0.45));
    }
  });
  var links = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linkPts),
    guideMat
  );
  rig.add(links);

  // Polvo de metal / destellos flotando
  function buildSpriteTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var PCOUNT = isMobile ? 90 : 220;
  var pPos = new Float32Array(PCOUNT * 3);
  var pCol = new Float32Array(PCOUNT * 3);
  var pX0 = new Float32Array(PCOUNT);
  var pY = new Float32Array(PCOUNT);
  var pVy = new Float32Array(PCOUNT);
  var pSA = new Float32Array(PCOUNT);
  var pSF = new Float32Array(PCOUNT);
  var pPh = new Float32Array(PCOUNT);
  var palette = [
    new THREE.Color(0x9fb4ff), new THREE.Color(0xdbe4ff),
    new THREE.Color(0x6f8cff), new THREE.Color(0xff7a6b)
  ];
  for (var pi = 0; pi < PCOUNT; pi++) {
    pX0[pi] = (Math.random() - 0.5) * 30;
    pY[pi] = (Math.random() - 0.5) * 20;
    pPos[pi * 3 + 2] = -9 + Math.random() * 17;
    pVy[pi] = 0.05 + Math.random() * 0.2;
    pSA[pi] = 0.15 + Math.random() * 0.5;
    pSF[pi] = 0.15 + Math.random() * 0.4;
    pPh[pi] = Math.random() * Math.PI * 2;
    var pc = palette[Math.random() < 0.08 ? 3 : Math.floor(Math.random() * 3)];
    pCol[pi * 3] = pc.r;
    pCol[pi * 3 + 1] = pc.g;
    pCol[pi * 3 + 2] = pc.b;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  var pMat = new THREE.PointsMaterial({
    size: isMobile ? 0.16 : 0.13,
    map: buildSpriteTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  var dust = new THREE.Points(pGeo, pMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------------
  // Iluminación: 3 puntos cinematográficos + luz de brillo que barre
  // ---------------------------------------------------------------------

  var key = new THREE.DirectionalLight(0xfff2df, 1.35);
  key.position.set(6, 8, 6);
  key.castShadow = !isMobile;
  if (key.castShadow) {
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.radius = 3;
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.03;
  }
  scene.add(key);

  var fill = new THREE.PointLight(0x3b63ec, 5, 32, 2);
  fill.position.set(-8, 2, 4);
  scene.add(fill);

  var rim = new THREE.PointLight(0xef2430, 4.5, 32, 2);
  rim.position.set(4, -3, -6);
  scene.add(rim);

  var glint = new THREE.PointLight(0xffe2bd, 3, 24, 2);
  glint.position.set(0, 1, 6);
  scene.add(glint);

  scene.add(new THREE.AmbientLight(0x1b2450, 0.4));

  // ---------------------------------------------------------------------
  // Entrada del usuario: scroll (con velocidad) y puntero (parallax)
  // ---------------------------------------------------------------------

  var targetScrollT = 0;
  var currentScrollT = 0;
  var lastTarget = 0;
  var scrollVel = 0;

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    targetScrollT = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  lastTarget = targetScrollT;
  currentScrollT = targetScrollT;

  var mouseX = 0, mouseY = 0, px = 0, py = 0;
  if (hasFinePointer && !reduceMotion) {
    window.addEventListener("pointermove", function (ev) {
      mouseX = (ev.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (ev.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Bucle de animación
  // ---------------------------------------------------------------------

  var clock = new THREE.Clock();
  var t = 0;
  var driverFg = 0;
  var driverA = 0.6;
  var driverB = 2.1;
  var INTRO = reduceMotion ? 0.001 : 3.2;
  var motion = reduceMotion ? 0.25 : 1;

  function applyIntro(items, delay, stagger, dur, spread) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var p = reduceMotion ? 1 : clamp01((t - delay - i * stagger) / dur);
      var k = 1 - easeOutCubic(p);
      it.holder.position.set(
        it.rest.x + it.rest.x * 0.8 * k,
        it.rest.y + it.rest.y * 0.8 * k,
        it.rest.z - spread * k
      );
      it.holder.scale.setScalar(0.6 + 0.4 * (1 - k));
    }
  }

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    var eIntro = easeOutCubic(clamp01(t / INTRO));
    var decoIn = reduceMotion ? 1 : clamp01((t - 1.6) / 1.4);

    currentScrollT += (targetScrollT - currentScrollT) * 0.06;

    // Velocidad de scroll -> acelera / invierte el giro de los engranajes
    var rawVel = dt > 0 ? (targetScrollT - lastTarget) / dt : 0;
    lastTarget = targetScrollT;
    scrollVel += (rawVel - scrollVel) * 0.12;
    var boost = reduceMotion ? 0 : clampRange(scrollVel * 4.5, -2.0, 2.0);

    driverFg += (0.14 * motion + boost) * dt;
    driverA -= (0.045 * motion + boost * 0.35) * dt;
    driverB += (0.05 * motion + boost * 0.35) * dt;

    updateChain(fg, driverFg);
    updateChain(bgA, driverA);
    updateChain(bgB, driverB);

    // Entrada: las piezas se ensamblan desde fuera y desde atrás
    applyIntro(fg, 0.0, 0.16, 1.7, 6);
    applyIntro(bgA, 0.5, 0.2, 1.9, 5);
    applyIntro(bgB, 0.7, 0.2, 1.9, 5);
    renderer.toneMappingExposure = reduceMotion
      ? 1.1
      : 0.2 + 0.9 * easeOutCubic(clamp01(t / 2.0));

    // Decoración: aparece tras el ensamblado
    guideMat.opacity = 0.3 * decoIn;
    dialNear.material.opacity = dialNear.userData.maxOpacity * decoIn;
    dialFar.material.opacity = dialFar.userData.maxOpacity * decoIn;
    pMat.opacity = (0.7 + 0.12 * Math.sin(t * 0.8)) * decoIn;
    dialNear.rotation.z = -t * 0.04 * motion;
    dialFar.rotation.z = t * 0.012 * motion;

    // Polvo a la deriva
    if (!reduceMotion) {
      for (var i = 0; i < PCOUNT; i++) {
        pY[i] += pVy[i] * dt;
        if (pY[i] > 10) pY[i] = -10;
        pPos[i * 3] = pX0[i] + Math.sin(t * pSF[i] + pPh[i]) * pSA[i];
        pPos[i * 3 + 1] = pY[i];
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    dust.position.y = currentScrollT * 1.5;

    // Parallax con el puntero (suavizado)
    px += (mouseX - px) * 0.05;
    py += (mouseY - py) * 0.05;

    // Cámara: órbita por scroll + dolly de entrada + parallax
    var aspect = camera.aspect;
    var fit = 1 + Math.max(0, 1.25 - aspect) * 0.8;
    var angle = -0.55 + currentScrollT * 1.4 - (1 - eIntro) * 0.5;
    var radius = (13.4 - currentScrollT * 3.2) * fit * (1 + (1 - eIntro) * 0.35);
    var height = 2.2 - currentScrollT * 4.2;

    camera.position.x = Math.sin(angle) * radius + px * 0.9;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = height + Math.sin(t * 0.12) * 0.15 - py * 0.55;
    camera.lookAt(0.25, 0.4 - currentScrollT * 0.5, 0);

    // Balanceo suave de los grupos (a distinta velocidad => profundidad)
    rig.rotation.y = Math.sin(t * 0.08) * 0.06 * motion;
    rig.rotation.x = Math.sin(t * 0.06) * 0.03 * motion;
    rig.position.y = 0.55 + Math.sin(t * 0.4) * 0.08 * motion;
    bgRig.rotation.y = -Math.sin(t * 0.05) * 0.04 * motion;

    // Luces vivas
    fill.position.x = Math.sin(t * 0.16) * 8;
    rim.position.z = Math.cos(t * 0.14) * -6;
    glint.position.set(
      Math.sin(t * 0.35) * 7,
      1 + Math.cos(t * 0.27) * 4,
      5 + Math.sin(t * 0.21) * 1.5
    );

    renderer.render(scene, camera);
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    try {
      frame();
    } catch (e) {
      running = false;
      if (window.console) console.error("scene.js:", e);
      if (fallback) fallback.classList.add("active");
    }
  }
  animate();

  // ---------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 120);
  });
})();
