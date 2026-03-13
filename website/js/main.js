/* ================================================================
   Three.js Golden Particle Background + Shared Navigation Logic
   ================================================================ */

// ── Three.js Global Particles ──
(function initThreeJS() {
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('threejs-canvas'), alpha: true, antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.position.z = 5;

  // Particle system
  const count = 1800;
  const geo   = new THREE.BufferGeometry();
  const pos   = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const goldColors = [
    [0.72, 0.53, 0.04],  // deep gold
    [0.83, 0.63, 0.09],  // mid gold
    [1.00, 0.84, 0.00],  // bright gold
    [1.00, 0.95, 0.65],  // pale gold
    [0.85, 0.85, 0.85],  // silver star
  ];

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 20;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    sizes[i] = Math.random() * 2.5 + 0.5;
    const c = goldColors[Math.floor(Math.random() * goldColors.length)];
    colors[i * 3]     = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.025,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Soft nebula/glow mesh
  const nebGeo = new THREE.SphereGeometry(3.5, 32, 32);
  const nebMat = new THREE.MeshBasicMaterial({ color: 0xD4A017, transparent: true, opacity: 0.03, wireframe: false });
  const nebula = new THREE.Mesh(nebGeo, nebMat);
  nebula.position.set(0, 0, -4);
  scene.add(nebula);

  // Mouse parallax
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.4;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
  });

  // Scroll-based tilt
  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; });

  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    particles.rotation.y = t * 0.012 + mouseX * 0.5;
    particles.rotation.x = t * 0.006 + mouseY * 0.5 + scrollY * 0.0003;
    nebula.rotation.y    = t * 0.009;

    // Subtle camera drift
    camera.position.x += (mouseX * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.3 - camera.position.y) * 0.05;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

// ── Navigation ──
(function initNav() {
  const navbar = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  // Set active link
  const links = document.querySelectorAll('.nav-links a, .mobile-nav a');
  links.forEach(a => {
    if (a.href === window.location.href) a.classList.add('active');
  });

  // Scroll effect
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  // Hamburger toggle
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
  }
})();

// ── Scroll Reveal ──
(function initScrollReveal() {
  const els = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));
})();

// ── Number Counter ──
function animateCounter(el, target, duration = 1800) {
  let start = 0;
  const step = Math.ceil(duration / (target || 1));
  const timer = setInterval(() => {
    start += Math.ceil(target / (duration / 16));
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = start.toLocaleString('en-IN');
  }, 16);
}
