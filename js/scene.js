/* ==========================================================================
   Talleres Juma — scene.js
   Fondo 3D: tren de engranajes metálicos de precisión.
   Materiales PBR (metal real, no plástico) con mapa de entorno procedural
   para reflejos físicamente creíbles, textura de imperfecciones sutil,
   iluminación cinematográfica de 3 puntos, y SIN piso — los engranajes
   quedan suspendidos en un espacio oscuro y neutro.
   Cámara ligada al scroll, fallback CSS si Three.js no carga o el
   dispositivo no soporta WebGL.
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !isMobile;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var scene = new THREE.Scene();
  var NAVY = 0x060c2b;
  scene.fog = new THREE.FogExp2(NAVY, isMobile ? 0.05 : 0.038);

  var camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.4, 13);

  // ---------------------------------------------------------------------
  // Textura procedural de imperfecciones (metal cepillado / uso real)
  // Sin dependencias externas: se pinta en un <canvas> en memoria.
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
        // Vetas suaves en una dirección (cepillado) + ruido fino aleatorio
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
    tex.repeat.set(3, 3);
    return tex;
  }

  var imperfectionTex = buildImperfectionTexture();

  // ---------------------------------------------------------------------
  // Mapa de entorno procedural (estudio de luz suave) para reflejos
  // metálicos físicamente creíbles, sin depender de imágenes externas.
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
        var mat = new THREE.MeshBasicMaterial({ color: color });
        mat.color.multiplyScalar(intensity);
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        envScene.add(mesh);
      }
      // Softbox principal (cálido)
      panel(11, 9, 5, 0, -0.55, 0, 16, 11, 3.0, 0xfff2df);
      // Relleno (azul frío, marca)
      panel(-15, 1, 3, 0, 0.55, 0, 13, 17, 1.5, 0x3b63ec);
      // Contraluz (rojo, marca)
      panel(1, -5, -15, 0, 3.35, 0, 11, 11, 2.0, 0xef2430);
      // Panel superior suave (simula techo de estudio)
      panel(0, 22, 0, Math.PI / 2, 0, 0, 30, 30, 0.8, 0xaeb8d8);
      // Plano oscuro inferior: sólo existe para que el metal refleje una
      // referencia tenue de "suelo" (como lo haría una pieza real en el
      // aire) — nunca se renderiza en la escena visible, así que no hay
      // ninguna plataforma bajo los engranajes.
      panel(0, -20, 0, -Math.PI / 2, 0, 0, 40, 40, 0.12, 0x0a0d1c);

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
  // Materiales metálicos físicamente basados (PBR real, no plástico)
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
  var redAccent = metalMaterial(0xb4131f, 0.38, 1.2);
  redAccent.emissive = new THREE.Color(0x220305);
  redAccent.emissiveIntensity = 0.35;
  // Ligero barniz sobre el rojo: así se lee como pieza pintada/lacada,
  // no como el mismo acero desnudo de los demás engranajes.
  redAccent.clearcoat = 0.5;
  redAccent.clearcoatRoughness = 0.25;

  // ---------------------------------------------------------------------
  // Geometría de engranaje procedural (perfil dentado real, no un disco)
  // ---------------------------------------------------------------------

  function buildGearShape(teeth, outerR, innerR, boreR) {
    var shape = new THREE.Shape();
    var toothAngle = (Math.PI * 2) / teeth;

    for (var i = 0; i < teeth; i++) {
      var a0 = i * toothAngle;
      var a1 = a0 + toothAngle * 0.28;
      var a3 = a0 + toothAngle * 0.72;
      var a4 = a0 + toothAngle;

      var pInner0 = polar(innerR, a0);
      var pOuter1 = polar(outerR, a1);
      var pOuter2 = polar(outerR, a3);
      var pInner1 = polar(innerR, a4);

      if (i === 0) shape.moveTo(pInner0.x, pInner0.y);
      else shape.lineTo(pInner0.x, pInner0.y);

      shape.lineTo(pOuter1.x, pOuter1.y);
      shape.lineTo(pOuter2.x, pOuter2.y);
      shape.lineTo(pInner1.x, pInner1.y);
    }
    shape.closePath();

    var hole = new THREE.Path();
    hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    return shape;

    function polar(r, a) {
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
  }

  function makeGear(teeth, outerR, thickness, material) {
    var innerR = outerR * 0.82;
    var boreR = outerR * 0.28;
    var shape = buildGearShape(teeth, outerR, innerR, boreR);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: thickness * 0.14,
      bevelSize: thickness * 0.08,
      bevelSegments: 5,
      curveSegments: 22
    });
    geo.center();
    var mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !isMobile;
    mesh.receiveShadow = !isMobile;

    // Ejes / cubo central visible, en acero claro para contraste de valores
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(boreR * 1.15, boreR * 1.15, thickness * 1.4, 28),
      steelLight
    );
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = !isMobile;
    mesh.add(hub);

    // Tornillo/perno central: pequeño detalle mecánico que rompe la
    // superficie lisa y refuerza la sensación de pieza real de máquina.
    var bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(boreR * 0.5, boreR * 0.5, thickness * 1.55, 6),
      steelDark
    );
    bolt.rotation.x = Math.PI / 2;
    mesh.add(bolt);

    return mesh;
  }

  // ---------------------------------------------------------------------
  // Grupo de engranajes: tren mecánico compuesto, engranando entre sí,
  // suspendido en el espacio — sin plataforma ni piso debajo.
  // ---------------------------------------------------------------------

  var rig = new THREE.Group();
  scene.add(rig);

  var gearDefs = [
    { teeth: 20, r: 2.6, thick: 0.55, x: 0,    y: 0,    z: 0,   mat: steelLight, speed: 0.05 },
    { teeth: 14, r: 1.75, thick: 0.5, x: 3.85, y: 0.9,  z: -0.6, mat: steelDark,  speed: -0.08 },
    { teeth: 10, r: 1.25, thick: 0.45, x: -3.3, y: -1.1, z: 0.4, mat: redAccent,  speed: 0.11 },
    { teeth: 16, r: 1.95, thick: 0.5, x: -1.6, y: 2.4,  z: -1.4, mat: steelDark, speed: -0.065 },
    { teeth: 8,  r: 1.0,  thick: 0.4, x: 2.0,  y: -2.3, z: -1.0, mat: steelLight, speed: 0.14 }
  ];

  var gears = gearDefs.map(function (def) {
    var g = makeGear(def.teeth, def.r, def.thick, def.mat);
    g.position.set(def.x, def.y, def.z);
    g.userData.speed = def.speed;
    rig.add(g);
    return g;
  });

  // ---------------------------------------------------------------------
  // Iluminación de 3 puntos, estilo taller — cinematográfica y suave
  // ---------------------------------------------------------------------

  var key = new THREE.DirectionalLight(0xfff2df, 1.35);
  key.position.set(6, 8, 6);
  key.castShadow = !isMobile;
  if (key.castShadow) {
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.radius = 3;
    key.shadow.bias = -0.0025;
  }
  scene.add(key);

  var fill = new THREE.PointLight(0x3b63ec, 5, 30, 2);
  fill.position.set(-8, 2, 4);
  scene.add(fill);

  var rim = new THREE.PointLight(0xef2430, 4.5, 30, 2);
  rim.position.set(4, -3, -6);
  scene.add(rim);

  var ambient = new THREE.AmbientLight(0x1b2450, 0.4);
  scene.add(ambient);

  // ---------------------------------------------------------------------
  // Scroll -> cámara (con lerp para suavidad) + rotación continua elegante
  // ---------------------------------------------------------------------

  var targetScrollT = 0;
  var currentScrollT = 0;

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    targetScrollT = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.getElapsedTime();

    currentScrollT += (targetScrollT - currentScrollT) * 0.06;

    // Órbita lenta ligada al scroll: recorre el tren de engranajes
    var angle = -0.6 + currentScrollT * 1.5;
    var radius = 12.5 - currentScrollT * 3.2;
    var height = 2.4 - currentScrollT * 4.2;

    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = height + Math.sin(t * 0.12) * 0.15;
    camera.lookAt(0, -0.3 + currentScrollT * -0.4, 0);

    rig.rotation.y = t * 0.015;

    gears.forEach(function (g) {
      g.rotation.z += g.userData.speed * dt;
    });

    fill.position.x = Math.sin(t * 0.16) * 8;
    rim.position.z = Math.cos(t * 0.14) * -6;

    renderer.render(scene, camera);
  }

  try {
    animate();
  } catch (e) {
    if (fallback) fallback.classList.add("active");
  }

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