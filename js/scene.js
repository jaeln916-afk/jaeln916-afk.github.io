/* ==========================================================================
   Talleres Juma — scene.js
   Fondo 3D: tren de engranajes metálicos de precisión.
   Cámara ligada al scroll, iluminación de taller (azul/rojo), fallback CSS
   si Three.js no carga o el dispositivo no soporta WebGL.
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
  renderer.shadowMap.enabled = !isMobile;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var scene = new THREE.Scene();
  var NAVY = 0x060c2b;
  scene.fog = new THREE.FogExp2(NAVY, isMobile ? 0.045 : 0.032);

  var camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.4, 13);

  // ---------------------------------------------------------------------
  // Materiales
  // ---------------------------------------------------------------------

  var steelDark = new THREE.MeshStandardMaterial({
    color: 0x8992ad,
    metalness: 0.92,
    roughness: 0.28
  });

  var steelLight = new THREE.MeshStandardMaterial({
    color: 0xdfe4f2,
    metalness: 0.85,
    roughness: 0.22
  });

  var redAccent = new THREE.MeshStandardMaterial({
    color: 0xd1121f,
    metalness: 0.6,
    roughness: 0.35,
    emissive: 0x2a0305,
    emissiveIntensity: 0.4
  });

  var floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a1230,
    metalness: 0.4,
    roughness: 0.75
  });

  // ---------------------------------------------------------------------
  // Geometría de engranaje procedural (perfil dentado real, no un disco)
  // ---------------------------------------------------------------------

  function buildGearShape(teeth, outerR, innerR, boreR) {
    var shape = new THREE.Shape();
    var toothAngle = (Math.PI * 2) / teeth;
    var addendum = outerR - innerR;

    for (var i = 0; i < teeth; i++) {
      var a0 = i * toothAngle;
      var a1 = a0 + toothAngle * 0.28;
      var a2 = a0 + toothAngle * 0.5;
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
      bevelThickness: thickness * 0.12,
      bevelSize: thickness * 0.06,
      bevelSegments: 2,
      curveSegments: 8
    });
    geo.center();
    var mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !isMobile;
    mesh.receiveShadow = !isMobile;

    // Ejes / cubo central visible
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(boreR * 1.15, boreR * 1.15, thickness * 1.4, 20),
      steelLight
    );
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = !isMobile;
    mesh.add(hub);

    return mesh;
  }

  // ---------------------------------------------------------------------
  // Grupo de engranajes: tren mecánico compuesto, engranando entre sí
  // ---------------------------------------------------------------------

  var rig = new THREE.Group();
  scene.add(rig);

  var gearDefs = [
    { teeth: 20, r: 2.6, thick: 0.55, x: 0,    y: 0,    z: 0,   mat: steelLight, speed: 0.09 },
    { teeth: 14, r: 1.75, thick: 0.5, x: 3.85, y: 0.9,  z: -0.6, mat: steelDark,  speed: -0.13 },
    { teeth: 10, r: 1.25, thick: 0.45, x: -3.3, y: -1.1, z: 0.4, mat: redAccent,  speed: 0.19 },
    { teeth: 16, r: 1.95, thick: 0.5, x: -1.6, y: 2.4,  z: -1.4, mat: steelDark, speed: -0.11 },
    { teeth: 8,  r: 1.0,  thick: 0.4, x: 2.0,  y: -2.3, z: -1.0, mat: steelLight, speed: 0.24 }
  ];

  var gears = gearDefs.map(function (def) {
    var g = makeGear(def.teeth, def.r, def.thick, def.mat);
    g.position.set(def.x, def.y, def.z);
    g.userData.speed = def.speed;
    rig.add(g);
    return g;
  });

  // Plano de piso metálico tenue, sólo perceptible como reflejo de luz
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6.5;
  floor.receiveShadow = !isMobile;
  scene.add(floor);

  // ---------------------------------------------------------------------
  // Iluminación de 3 puntos, estilo taller
  // ---------------------------------------------------------------------

  var key = new THREE.DirectionalLight(0xfff2df, 1.15);
  key.position.set(6, 8, 6);
  key.castShadow = !isMobile;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0025;
  }
  scene.add(key);

  var fill = new THREE.PointLight(0x3b63ec, 6, 30, 2);
  fill.position.set(-8, 2, 4);
  scene.add(fill);

  var rim = new THREE.PointLight(0xef2430, 5, 30, 2);
  rim.position.set(4, -3, -6);
  scene.add(rim);

  var ambient = new THREE.AmbientLight(0x223066, 0.55);
  scene.add(ambient);

  // ---------------------------------------------------------------------
  // Scroll -> cámara (con lerp para suavidad) + rotación continua
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
    var dt = clock.getDelta();
    var t = clock.getElapsedTime();

    currentScrollT += (targetScrollT - currentScrollT) * 0.06;

    // Órbita lenta ligada al scroll: recorre el tren de engranajes
    var angle = -0.6 + currentScrollT * 2.1;
    var radius = 12.5 - currentScrollT * 4.2;
    var height = 2.4 - currentScrollT * 5.4;

    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = height + Math.sin(t * 0.15) * 0.2;
    camera.lookAt(0, -0.4 + currentScrollT * -0.6, 0);

    rig.rotation.y = t * 0.025;

    gears.forEach(function (g) {
      g.rotation.z += g.userData.speed * dt;
    });

    fill.position.x = Math.sin(t * 0.2) * 8;
    rim.position.z = Math.cos(t * 0.18) * -6;

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
