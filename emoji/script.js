(() => {
  "use strict";

  const canvas = document.querySelector("#space");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050714);
  scene.fog = new THREE.FogExp2(0x050714, 0.032);

  const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  camera.position.set(0, 0, 14);

  scene.add(new THREE.HemisphereLight(0xb9ccff, 0x17204a, 2.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-4, 7, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x7592ff, 55, 24);
  rimLight.position.set(7, -2, 5);
  scene.add(rimLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const mochi = [];
  const projectiles = [];
  const slashMarks = [];
  let selectedTool = "finger";
  let selectedEmoji = "🥺";
  let drag = null;
  let toastTimer;
  let firstInteraction = false;
  let starField;

  const toolLabels = { finger: "指 / TOUCH", flick: "弾き / FLICK", gun: "銃 / BLASTER", knife: "ナイフ / SLICE" };

  function createEmojiTexture(emoji) {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const ctx = c.getContext("2d");
    const gradient = ctx.createRadialGradient(400, 330, 80, 520, 520, 480);
    gradient.addColorStop(0, "#fffac2");
    gradient.addColorStop(.48, "#ffd33b");
    gradient.addColorStop(1, "#e67a00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '760px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText(emoji, 512, 535);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function makeMochi(emoji, position = new THREE.Vector3()) {
    const geometry = new THREE.SphereGeometry(1.45, 48, 36);
    const material = new THREE.MeshPhysicalMaterial({
      map: createEmojiTexture(emoji),
      roughness: .28,
      metalness: 0,
      clearcoat: .65,
      clearcoatRoughness: .32,
      emissive: new THREE.Color(0x2b1600),
      emissiveIntensity: .07
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const body = {
      mesh, emoji,
      velocity: new THREE.Vector3(),
      angular: new THREE.Vector3(.12, .16, .08).multiplyScalar(Math.random() - .5),
      scale: new THREE.Vector3(1, 1, 1),
      scaleVelocity: new THREE.Vector3(),
      targetScale: new THREE.Vector3(1, 1, 1),
      wobble: Math.random() * Math.PI * 2,
      radius: 1.45,
      sliced: false,
      fragments: []
    };
    mesh.userData.body = body;
    mochi.push(body);
    updateCount();
    return body;
  }

  function addStars() {
    const count = 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 25 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const tint = Math.random();
      colors[i * 3] = .5 + tint * .5;
      colors[i * 3 + 1] = .6 + tint * .4;
      colors[i * 3 + 2] = 1;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    starField = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: .055, vertexColors: true, transparent: true, opacity: .75, sizeAttenuation: true
    }));
    scene.add(starField);
  }

  function screenToWorld(clientX, clientY, z = 0) {
    pointer.x = (clientX / innerWidth) * 2 - 1;
    pointer.y = -(clientY / innerHeight) * 2 + 1;
    const v = new THREE.Vector3(pointer.x, pointer.y, .5).unproject(camera);
    const direction = v.sub(camera.position).normalize();
    const distance = (z - camera.position.z) / direction.z;
    return camera.position.clone().add(direction.multiplyScalar(distance));
  }

  function getHit(clientX, clientY) {
    pointer.x = (clientX / innerWidth) * 2 - 1;
    pointer.y = -(clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = mochi.filter(m => !m.sliced).map(m => m.mesh);
    return raycaster.intersectObjects(targets, false)[0] || null;
  }

  function deform(body, hitPoint, strength, pullPoint) {
    const local = body.mesh.worldToLocal(hitPoint.clone()).normalize();
    const direction = pullPoint ? pullPoint.clone().sub(hitPoint).normalize() : local.clone().multiplyScalar(-1);
    body.targetScale.set(
      1 + Math.abs(direction.x) * strength,
      1 + Math.abs(direction.y) * strength,
      1 + Math.abs(direction.z) * strength * .55
    );
    const volume = Math.max(.48, 1 / Math.sqrt(body.targetScale.x * body.targetScale.y));
    if (Math.abs(direction.x) > Math.abs(direction.y)) body.targetScale.y *= volume;
    else body.targetScale.x *= volume;
    body.mesh.rotation.z += local.x * .035;
  }

  function triggerWobble(body, axis = new THREE.Vector3(1, 0, 0), amount = .34) {
    body.scaleVelocity.add(new THREE.Vector3(
      -Math.abs(axis.x) * amount + amount * .55,
      -Math.abs(axis.y) * amount + amount * .55,
      amount * .45
    ));
  }

  function pointerDown(e) {
    if (e.target !== canvas) return;
    markInteraction();
    const hit = getHit(e.clientX, e.clientY);
    const world = screenToWorld(e.clientX, e.clientY);
    if (selectedTool === "finger" && hit) {
      const body = hit.object.userData.body;
      drag = {
        body, hitPoint: hit.point.clone(), start: world, current: world.clone(),
        started: performance.now(), moved: false
      };
      deform(body, hit.point, .2);
      canvas.setPointerCapture(e.pointerId);
    } else if (selectedTool === "flick" && hit) {
      const body = hit.object.userData.body;
      const impulse = body.mesh.position.clone().sub(world).normalize().multiplyScalar(4.8);
      impulse.z = 0;
      body.velocity.add(impulse);
      body.angular.add(new THREE.Vector3(rand(-2,2), rand(-2,2), rand(-3,3)));
      triggerWobble(body, impulse.clone().normalize(), .55);
      showToast("BOYO—N!");
    } else if (selectedTool === "gun") {
      fireBurst(world);
    } else if (selectedTool === "knife" && hit) {
      sliceMochi(hit.object.userData.body, hit.point);
    }
  }

  function pointerMove(e) {
    const crosshair = document.querySelector("#crosshair");
    crosshair.style.left = `${e.clientX}px`;
    crosshair.style.top = `${e.clientY}px`;
    if (!drag) return;
    const world = screenToWorld(e.clientX, e.clientY);
    drag.current.copy(world);
    const delta = world.clone().sub(drag.start);
    drag.moved ||= delta.length() > .08;
    const amount = Math.min(delta.length() * .45 + .18, 1.1);
    deform(drag.body, drag.hitPoint, amount, world);
    // Finger deformation intentionally anchors the center: no translational force.
  }

  function pointerUp() {
    if (!drag) return;
    const axis = drag.current.clone().sub(drag.start).normalize();
    triggerWobble(drag.body, axis, Math.min(.75, .22 + drag.current.distanceTo(drag.start) * .22));
    drag.body.targetScale.set(1, 1, 1);
    drag = null;
  }

  function nearestMochi(point) {
    return mochi.filter(m => !m.sliced).sort((a, b) =>
      a.mesh.position.distanceToSquared(point) - b.mesh.position.distanceToSquared(point)
    )[0];
  }

  function fireBurst(origin) {
    const target = nearestMochi(origin);
    if (!target) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => fireBullet(origin, target), i * 115);
    }
  }

  function fireBullet(origin, target) {
    if (!target || target.sliced) return;
    const geometry = new THREE.SphereGeometry(.09, 12, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xc9ff4d });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(origin).setZ(.3);
    scene.add(mesh);
    projectiles.push({
      mesh, target, velocity: target.mesh.position.clone().sub(mesh.position).normalize().multiplyScalar(10),
      life: 2
    });
  }

  function sliceMochi(body, point) {
    if (body.sliced) return;
    body.sliced = true;
    body.mesh.visible = false;
    const angle = rand(-Math.PI, Math.PI);
    const planeNormal = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    for (let side = -1; side <= 1; side += 2) {
      const geometry = new THREE.SphereGeometry(body.radius, 40, 28, 0, Math.PI);
      const material = body.mesh.material.clone();
      const fragment = new THREE.Mesh(geometry, material);
      fragment.position.copy(body.mesh.position);
      fragment.quaternion.copy(body.mesh.quaternion);
      fragment.rotation.z += angle + (side < 0 ? Math.PI : 0);
      fragment.scale.copy(body.mesh.scale);
      fragment.castShadow = true;
      scene.add(fragment);
      body.fragments.push({
        mesh: fragment,
        velocity: body.velocity.clone().add(new THREE.Vector3(planeNormal.x, planeNormal.y, .2).multiplyScalar(side * 1.2)),
        angular: body.angular.clone().add(new THREE.Vector3(rand(-2,2), rand(-2,2), side * 1.4)),
        radius: body.radius * .72
      });
    }
    addSlash(point, angle);
    showToast("SLICE!");
    updateCount();
  }

  function addSlash(point, angle) {
    const geometry = new THREE.PlaneGeometry(4.1, .055);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(point).setZ(2);
    mesh.rotation.z = angle;
    scene.add(mesh);
    slashMarks.push({ mesh, life: .28 });
  }

  function bounds() {
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    return { x: height * camera.aspect / 2, y: height / 2 };
  }

  function physics(body, dt, elapsed) {
    body.mesh.position.addScaledVector(body.velocity, dt);
    body.mesh.rotation.x += body.angular.x * dt;
    body.mesh.rotation.y += body.angular.y * dt;
    body.mesh.rotation.z += body.angular.z * dt;
    body.velocity.multiplyScalar(Math.pow(.994, dt * 60));
    body.angular.multiplyScalar(Math.pow(.996, dt * 60));
    const b = bounds();
    const r = body.radius * Math.max(body.mesh.scale.x, body.mesh.scale.y) * .72;
    if (Math.abs(body.mesh.position.x) + r > b.x) {
      body.mesh.position.x = Math.sign(body.mesh.position.x) * (b.x - r);
      body.velocity.x *= -.86;
      triggerWobble(body, new THREE.Vector3(1,0,0), .34);
    }
    if (Math.abs(body.mesh.position.y) + r > b.y) {
      body.mesh.position.y = Math.sign(body.mesh.position.y) * (b.y - r);
      body.velocity.y *= -.86;
      triggerWobble(body, new THREE.Vector3(0,1,0), .34);
    }
    const spring = 22, damping = 7.5;
    ["x","y","z"].forEach(axis => {
      const force = (body.targetScale[axis] - body.scale[axis]) * spring;
      body.scaleVelocity[axis] += force * dt;
      body.scaleVelocity[axis] *= Math.exp(-damping * dt);
      body.scale[axis] += body.scaleVelocity[axis] * dt;
    });
    const idle = Math.sin(elapsed * 2.1 + body.wobble) * .012;
    body.mesh.scale.set(body.scale.x + idle, body.scale.y - idle * .65, body.scale.z);
  }

  function fragmentPhysics(fragment, dt) {
    fragment.mesh.position.addScaledVector(fragment.velocity, dt);
    fragment.mesh.rotation.x += fragment.angular.x * dt;
    fragment.mesh.rotation.y += fragment.angular.y * dt;
    fragment.mesh.rotation.z += fragment.angular.z * dt;
    fragment.velocity.multiplyScalar(Math.pow(.995, dt * 60));
    const b = bounds(), r = fragment.radius;
    if (Math.abs(fragment.mesh.position.x) + r > b.x) {
      fragment.mesh.position.x = Math.sign(fragment.mesh.position.x) * (b.x - r);
      fragment.velocity.x *= -.82;
    }
    if (Math.abs(fragment.mesh.position.y) + r > b.y) {
      fragment.mesh.position.y = Math.sign(fragment.mesh.position.y) * (b.y - r);
      fragment.velocity.y *= -.82;
    }
  }

  function collisionStep() {
    const colliders = [];
    mochi.forEach(body => {
      if (!body.sliced) colliders.push({ body, pos: body.mesh.position, radius: body.radius });
      body.fragments.forEach(f => colliders.push({ body: f, pos: f.mesh.position, radius: f.radius, fragment: true }));
    });
    for (let i = 0; i < colliders.length; i++) for (let j = i + 1; j < colliders.length; j++) {
      const a = colliders[i], b = colliders[j];
      const delta = b.pos.clone().sub(a.pos);
      const dist = delta.length();
      const min = (a.radius + b.radius) * .8;
      if (dist > 0 && dist < min) {
        const normal = delta.multiplyScalar(1 / dist);
        const overlap = min - dist;
        a.pos.addScaledVector(normal, -overlap * .5);
        b.pos.addScaledVector(normal, overlap * .5);
        const av = a.body.velocity, bv = b.body.velocity;
        const relative = bv.clone().sub(av).dot(normal);
        if (relative < 0) {
          av.addScaledVector(normal, relative * .75);
          bv.addScaledVector(normal, -relative * .75);
        }
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p.target.sliced) p.velocity.lerp(p.target.mesh.position.clone().sub(p.mesh.position).normalize().multiplyScalar(10), .06);
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.life -= dt;
      if (!p.target.sliced && p.mesh.position.distanceTo(p.target.mesh.position) < p.target.radius) {
        p.target.velocity.addScaledVector(p.velocity, .075);
        p.target.angular.add(new THREE.Vector3(rand(-3,3), rand(-3,3), rand(-4,4)));
        triggerWobble(p.target, p.velocity.clone().normalize(), .22);
        p.life = 0;
      }
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        projectiles.splice(i, 1);
      }
    }
  }

  function updateSlashes(dt) {
    for (let i = slashMarks.length - 1; i >= 0; i--) {
      const s = slashMarks[i];
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life / .28);
      s.mesh.scale.x += dt * 5;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        slashMarks.splice(i, 1);
      }
    }
  }

  function reset() {
    [...mochi].forEach(removeBody);
    mochi.length = 0;
    projectiles.splice(0).forEach(p => scene.remove(p.mesh));
    slashMarks.splice(0).forEach(s => scene.remove(s.mesh));
    makeMochi(selectedEmoji, new THREE.Vector3(0, 0, 0));
    showToast("RESET");
  }

  function removeBody(body) {
    scene.remove(body.mesh);
    body.mesh.geometry.dispose();
    body.mesh.material.map?.dispose();
    body.mesh.material.dispose();
    body.fragments.forEach(f => {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    });
  }

  function addRandom(emoji) {
    const b = bounds();
    const position = new THREE.Vector3(rand(-b.x * .55, b.x * .55), rand(-b.y * .42, b.y * .42), rand(-.5,.5));
    const body = makeMochi(emoji, position);
    body.scale.set(.15,.15,.15);
    body.scaleVelocity.set(4.2,4.2,4.2);
    body.angular.set(rand(-1,1), rand(-1,1), rand(-1,1));
    showToast(`${emoji} NEW MOCHI`);
  }

  function updateCount() {
    const live = mochi.filter(m => !m.sliced).length;
    document.querySelector("#objectCount").textContent = `${live} MOCHI${live === 1 ? "" : "S"}`;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 900);
  }

  function markInteraction() {
    if (!firstInteraction) {
      firstInteraction = true;
      document.querySelector("#intro").classList.add("hide");
    }
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), .033);
    const elapsed = clock.elapsedTime;
    mochi.forEach(body => {
      if (!body.sliced) physics(body, dt, elapsed);
      body.fragments.forEach(f => fragmentPhysics(f, dt));
    });
    collisionStep();
    updateProjectiles(dt);
    updateSlashes(dt);
    starField.rotation.y += dt * .003;
    starField.rotation.x += dt * .001;
    renderer.render(scene, camera);
  }

  document.querySelectorAll(".emoji-choice").forEach(button => {
    button.addEventListener("click", () => {
      markInteraction();
      selectedEmoji = button.dataset.emoji;
      document.querySelectorAll(".emoji-choice").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      addRandom(selectedEmoji);
    });
  });

  document.querySelectorAll(".tool").forEach(button => {
    button.addEventListener("click", () => {
      markInteraction();
      if (button.dataset.tool === "reset") {
        reset();
        return;
      }
      selectedTool = button.dataset.tool;
      document.querySelectorAll(".tool").forEach(b => b.classList.toggle("active", b === button));
      document.querySelector("#toolName").textContent = toolLabels[selectedTool];
      document.querySelector("#crosshair").style.display = selectedTool === "gun" ? "block" : "none";
      showToast(toolLabels[selectedTool]);
    });
  });

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  window.addEventListener("resize", resize);

  addStars();
  resize();
  makeMochi("🥺");
  animate();
})();
