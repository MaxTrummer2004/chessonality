let carouselIdx = 0;
let carouselTimer = null;
let carouselFirstRender = true;

function carouselSlideContent(p) {
  return `
    <span class="cs-emoji">${p.emoji}</span>
    <div class="cs-body">
      <span class="cs-name" style="color:${p.color}">${p.name}</span>
      <span class="cs-tagline">${p.tagline}</span>
      <div class="cs-traits">${p.traits.map(t => `<span class="cs-trait">${t}</span>`).join('')}</div>
    </div>`;
}

function applyCarouselColor(p) {
  const slide = document.getElementById('carouselSlide');
  if (slide) slide.style.setProperty('--cs-color', p.color);
}

function renderCarousel() {
  const slide = document.getElementById('carouselSlide');
  const dots  = document.getElementById('carouselDots');
  if (!slide || !dots) return;

  const p = PERSONALITY_LIST[carouselIdx];

  if (carouselFirstRender) {
    // First paint: snap in from right, no exit animation
    carouselFirstRender = false;
    slide.style.transition = 'none';
    slide.style.opacity = '0';
    slide.style.transform = 'translateX(40px)';
    slide.innerHTML = carouselSlideContent(p);
    applyCarouselColor(p);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slide.style.transition = '';
      slide.style.opacity = '1';
      slide.style.transform = 'translateX(0)';
    }));
  } else {
    // Animate out: slide left + fade
    slide.style.opacity = '0';
    slide.style.transform = 'translateX(-40px)';
    setTimeout(() => {
      // Snap to right side without transition
      slide.style.transition = 'none';
      slide.style.opacity = '0';
      slide.style.transform = 'translateX(40px)';
      slide.innerHTML = carouselSlideContent(p);
      applyCarouselColor(p);
      // Animate in
      requestAnimationFrame(() => requestAnimationFrame(() => {
        slide.style.transition = '';
        slide.style.opacity = '1';
        slide.style.transform = 'translateX(0)';
      }));
    }, 300);
  }

  // Update dots
  dots.innerHTML = '';
  PERSONALITY_LIST.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'carousel-dot' + (i === carouselIdx ? ' active' : '');
    dot.onclick = () => { carouselIdx = i; renderCarousel(); resetCarouselTimer(); };
    dots.appendChild(dot);
  });
}

function carouselNext() {
  carouselIdx = (carouselIdx + 1) % PERSONALITY_LIST.length;
  renderCarousel();
  resetCarouselTimer();
}

function carouselPrev() {
  carouselIdx = (carouselIdx - 1 + PERSONALITY_LIST.length) % PERSONALITY_LIST.length;
  renderCarousel();
  resetCarouselTimer();
}

function resetCarouselTimer() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(carouselNext, 4000);
}

// Boot carousel on load
document.addEventListener('DOMContentLoaded', () => {
  renderCarousel();
  resetCarouselTimer();
});
