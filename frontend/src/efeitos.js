// =====================================================
// EXPERIÊNCIA VISUAL — profundidade, parallax e microinterações
// Tudo aqui é decorativo: se falhar ou o usuário pedir menos movimento,
// a loja continua funcionando exatamente igual.
// =====================================================

import './efeitos.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

function rafThrottle(fn) {
  let frame = 0
  let lastArgs
  return (...args) => {
    lastArgs = args
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      fn(...lastArgs)
    })
  }
}

// ---------- HERO: camadas com profundidade ----------
function setupHero() {
  const hero = document.querySelector('.hero')
  const logo = hero?.querySelector('.hero-logo')
  if (!hero || !logo) return

  hero.classList.add('fx-hero')

  const stage = document.createElement('div')
  stage.className = 'fx-hero-stage'
  stage.setAttribute('aria-hidden', 'true')
  stage.innerHTML = `
    <span class="fx-light"></span>
    <span class="fx-float fx-float--1"></span>
    <span class="fx-float fx-float--2"></span>
    <span class="fx-float fx-float--3"></span>
    <span class="fx-float fx-float--4"></span>
    <span class="fx-sparkle fx-sparkle--1"></span>
    <span class="fx-sparkle fx-sparkle--2"></span>
    <span class="fx-sparkle fx-sparkle--3"></span>`
  logo.prepend(stage)

  if (finePointer.matches) {
    const onMove = rafThrottle((event) => {
      const rect = hero.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      hero.style.setProperty('--px', x.toFixed(3))
      hero.style.setProperty('--py', y.toFixed(3))
    })
    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--px', '0')
      hero.style.setProperty('--py', '0')
    })
  }

  // Parallax de rolagem só enquanto o hero está visível.
  let visible = true
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }).observe(hero)
  const onScroll = rafThrottle(() => {
    if (!visible) return
    const progress = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight))
    hero.style.setProperty('--scroll', progress.toFixed(3))
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

// ---------- CARDS DE PRODUTO: inclinação 3D + brilho ----------
function setupTilt() {
  if (!finePointer.matches) return
  const selector = '.product-card'

  const onMove = rafThrottle((event) => {
    const card = event.target.closest?.(selector)
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    card.style.setProperty('--tilt-x', `${(-y * 7).toFixed(2)}deg`)
    card.style.setProperty('--tilt-y', `${(x * 9).toFixed(2)}deg`)
    card.style.setProperty('--glare-x', `${((x + 0.5) * 100).toFixed(1)}%`)
    card.style.setProperty('--glare-y', `${((y + 0.5) * 100).toFixed(1)}%`)
    card.classList.add('is-tilting')
  })

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerout', (event) => {
    const card = event.target.closest?.(selector)
    if (card && !card.contains(event.relatedTarget)) {
      card.classList.remove('is-tilting')
      card.style.removeProperty('--tilt-x')
      card.style.removeProperty('--tilt-y')
    }
  })
}

// ---------- ADICIONAR AO CARRINHO: produto "voa" até o carrinho ----------
function setupFlyToCart() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.product-add')
    if (!button || button.disabled) return
    const card = button.closest('.product-card')
    const image = card?.querySelector('.product-image img')
    const cart = document.querySelector('.cart-trigger')
    if (!image || !cart) return

    button.classList.remove('fx-added')
    void button.offsetWidth
    button.classList.add('fx-added')

    const from = image.getBoundingClientRect()
    const to = cart.getBoundingClientRect()
    if (!from.width || !to.width) return

    const ghost = image.cloneNode()
    ghost.className = 'fx-fly'
    ghost.removeAttribute('alt')
    ghost.setAttribute('aria-hidden', 'true')
    const size = Math.min(from.width, from.height, 140)
    Object.assign(ghost.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${from.left + from.width / 2 - size / 2}px`,
      top: `${from.top + from.height / 2 - size / 2}px`,
    })
    document.body.appendChild(ghost)

    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const animation = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(.6)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.4 },
    ], { duration: 750, easing: 'cubic-bezier(.5, 0, .3, 1)' })

    animation.onfinish = () => {
      ghost.remove()
      cart.classList.remove('fx-bump')
      void cart.offsetWidth
      cart.classList.add('fx-bump')
    }
  })
}

// ---------- ENTRADA AO ROLAR ----------
const REVEAL_SELECTORS = [
  '.brand-video .video-placeholder',
  '.products .section-header',
  '.products h2',
  '.product-category-group',
  '.categories-grid > *',
  '.category-card',
  '.highlights-grid > *',
  '.contact-box',
  '.footer > *',
]

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('fx-in')
      observer.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

  const mark = (root = document) => {
    root.querySelectorAll(REVEAL_SELECTORS.join(',')).forEach((el, index) => {
      if (el.classList.contains('fx-reveal') || el.closest('.acc-view')) return
      el.classList.add('fx-reveal')
      el.style.setProperty('--fx-delay', `${Math.min(index % 6, 5) * 70}ms`)
      observer.observe(el)
    })
  }

  mark()
  // Produtos e categorias chegam depois, pela API.
  const products = document.querySelector('#produtos')
  if (products) {
    new MutationObserver(() => mark(products)).observe(products, { childList: true, subtree: true })
  }
  document.documentElement.classList.add('fx-ready')
}

// ---------- BOTÕES: brilho que segue o dedo/mouse ----------
function setupButtons() {
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('.btn-primary, .product-add, .acc-btn, .phone-registration-submit')
    if (!button) return
    const rect = button.getBoundingClientRect()
    button.style.setProperty('--ripple-x', `${event.clientX - rect.left}px`)
    button.style.setProperty('--ripple-y', `${event.clientY - rect.top}px`)
    button.classList.remove('fx-ripple')
    void button.offsetWidth
    button.classList.add('fx-ripple')
  }, { passive: true })
}

// ---------- cabeçalho que ganha profundidade ao rolar ----------
function setupHeader() {
  const header = document.querySelector('.header')
  if (!header) return
  const update = rafThrottle(() => header.classList.toggle('fx-scrolled', window.scrollY > 24))
  window.addEventListener('scroll', update, { passive: true })
  update()
}

// ---------- barra de energia das etapas do checkout ----------
function setupCheckoutProgress() {
  const progress = document.querySelector('.checkout-progress')
  if (!progress) return
  const update = () => {
    const items = [...progress.querySelectorAll('[data-progress-step]')]
    const current = items.findIndex((li) => li.getAttribute('aria-current') === 'step')
    const index = current < 0 ? 0 : current
    const pct = items.length > 1 ? (index / (items.length - 1)) * 75 : 0
    progress.style.setProperty('--fx-progress', pct.toFixed(1) + '%')
  }
  new MutationObserver(update).observe(progress, { subtree: true, attributes: true, attributeFilter: ['aria-current'] })
  update()
}

export function initEffects() {
  setupCheckoutProgress()
  if (reduceMotion.matches) {
    document.documentElement.classList.add('fx-reduced')
    return
  }
  setupHeader()
  try {
    setupHero()
    setupTilt()
    setupFlyToCart()
    setupReveal()
    setupButtons()
  } catch (error) {
    console.warn('Efeitos visuais desativados:', error)
    document.documentElement.classList.remove('fx-ready')
  }
}
