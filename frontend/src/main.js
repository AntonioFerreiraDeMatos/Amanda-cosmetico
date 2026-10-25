import './style.css'
import heroImg from './assets/hero.png'
import amandaBrandImg from './assets/images/amanddda.jfif'
import amandaVideo from './assets/videos/amanda-destaque.mp4'

const apiUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '')

const skincareImg =
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'

const makeupImg =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'

const hairImg =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80'

const perfumeImg =
  'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80'

const categorySkincareBg =
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80'

const categoryMakeupBg =
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'

const categoryHairBg =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80'

const categoryBodyBg =
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80'

const categoryPerfumeBg =
  'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80'

const categoryGiftBg =
  'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=900&q=80'


// =====================================================
// HTML PRINCIPAL
// =====================================================

document.querySelector('#app').innerHTML = `

<header class="header">
  <div class="header-container">

    <a href="#inicio" class="logo">
      <img
        src="${amandaBrandImg}"
        alt="Amanda Cosméticos"
      >
    </a>

    <nav class="nav">
      <a href="#inicio">Início</a>
      <a href="#produtos">Produtos</a>
      <a href="#categorias" class="category-nav-link">Categorias</a>
      <a href="#destaques">Destaques</a>
      <a href="#contato">Contato</a>
    </nav>

    <a href="#login" class="header-login">
      Entrar
    </a>

    <button
      class="cart-trigger"
      type="button"
      aria-label="Abrir carrinho"
    >
      Carrinho
      <span class="cart-count">0</span>
    </button>

  </div>
</header>


<main>

<!-- =====================================================
     HERO
===================================================== -->

<section class="hero" id="inicio">

  <div class="hero-container">

    <div class="hero-content">

      <div class="hero-label">
        Beleza & autocuidado
      </div>

      <h1>
        Sua beleza,
        <span>seu momento.</span>
      </h1>

      <p>
        Descubra produtos escolhidos para valorizar
        sua beleza e transformar sua rotina em
        momentos especiais.
      </p>

      <div class="hero-actions">

        <a
          href="#produtos"
          class="btn-primary"
        >
          Comprar agora
          <span class="btn-arrow">→</span>
        </a>

        <a
          href="#categorias"
          class="btn-secondary"
        >
          Ver coleções
        </a>

      </div>

      <ul class="hero-highlights" aria-label="Destaques da Amanda Cosméticos">
        <li class="hero-highlight-social">
          <a
            href="https://www.instagram.com/amandacosmeticos___?igsi=MW83cmtnd3dpc2ZyMQ=="
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg class="highlight-instagram-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle class="highlight-instagram-dot" cx="17.5" cy="6.5" r="1" />
            </svg>
            <span class="highlight-social-copy">
              <strong>+30 mil</strong>
              <span>seguidores no Instagram</span>
            </span>
            <span class="highlight-social-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
        <li class="hero-highlight-note">Beleza, cuidado e autoestima</li>
        <li class="hero-highlight-note">Tudo para realçar sua beleza</li>
      </ul>

    </div>


    <div class="hero-logo">

      <div class="hero-orbit orbit-one"></div>
      <div class="hero-orbit orbit-two"></div>

      <div class="hero-glow"></div>

      <img
        src="${amandaBrandImg}"
        alt="Amanda Cosméticos"
      >

    </div>

  </div>

</section>


<!-- =====================================================
     VIDEO
===================================================== -->

<section class="brand-video" id="video">

  <div class="container">

    <div class="video-placeholder visible">

      <video
        class="video-player"
        src="${amandaVideo}"
        autoplay
        muted
        loop
        playsinline
        poster="${amandaBrandImg}"
      ></video>

      <div class="video-content">

        <span>
          Descubra a Amanda
        </span>

        <h3>
          Beleza que transforma sua rotina.
        </h3>

        <p>
          Produtos pensados para realçar sua autoestima,
          cuidar de você e deixar sua beleza ainda mais especial.
        </p>

      </div>

    </div>

  </div>

</section>


<!-- =====================================================
     PRODUTOS
===================================================== -->

<section class="products" id="produtos">

  <div class="container">

    <div class="section-title">

      <span id="products-selection-label">Seleção especial</span>

      <h2>
        Produtos para
        <strong id="products-active-category">você</strong>
      </h2>

      <div class="gold-line"></div>

      <p>
        Escolhas especiais para cuidar,
        valorizar e realçar sua beleza.
      </p>

    </div>


    <div class="products-grid">

      <article class="product-card">

        <div class="product-image">

          <span class="badge">
            Destaque
          </span>

          <img
            src="${skincareImg}"
            alt="Linha de Skincare"
          >

          <button
            class="product-heart"
            type="button"
            aria-label="Favoritar"
          >
            ♡
          </button>

        </div>

        <div class="product-info">

          <span class="product-category">
            Skincare
          </span>

          <h3>
            Linha de Skincare
          </h3>

          <p>
            Cuidados especiais para
            deixar sua pele ainda mais bonita.
          </p>

          <div class="product-bottom">

            <strong>
              R$ 89,90
            </strong>

            <button
              class="product-add"
              type="button"
            >
              Comprar
            </button>

          </div>

        </div>

      </article>


      <article class="product-card">

        <div class="product-image">

          <span class="badge">
            Premium
          </span>

          <img
            src="${makeupImg}"
            alt="Maquiagem"
          >

          <button
            class="product-heart"
            type="button"
            aria-label="Favoritar"
          >
            ♡
          </button>

        </div>

        <div class="product-info">

          <span class="product-category">
            Maquiagem
          </span>

          <h3>
            Maquiagem
          </h3>

          <p>
            Produtos selecionados para
            valorizar sua beleza.
          </p>

          <div class="product-bottom">

            <strong>
              R$ 69,90
            </strong>

            <button
              class="product-add"
              type="button"
            >
              Comprar
            </button>

          </div>

        </div>

      </article>


      <article class="product-card">

        <div class="product-image">

          <span class="badge">
            Novo
          </span>

          <img
            src="${hairImg}"
            alt="Cuidados para Cabelos"
          >

          <button
            class="product-heart"
            type="button"
            aria-label="Favoritar"
          >
            ♡
          </button>

        </div>

        <div class="product-info">

          <span class="product-category">
            Cabelos
          </span>

          <h3>
            Cuidados para Cabelos
          </h3>

          <p>
            Produtos para uma rotina
            completa de cuidados.
          </p>

          <div class="product-bottom">

            <strong>
              R$ 79,90
            </strong>

            <button
              class="product-add"
              type="button"
            >
              Comprar
            </button>

          </div>

        </div>

      </article>


      <article class="product-card">

        <div class="product-image">

          <span class="badge">
            Especial
          </span>

          <img
            src="${perfumeImg}"
            alt="Perfumes"
          >

          <button
            class="product-heart"
            type="button"
            aria-label="Favoritar"
          >
            ♡
          </button>

        </div>

        <div class="product-info">

          <span class="product-category">
            Perfumes
          </span>

          <h3>
            Perfumes
          </h3>

          <p>
            Fragrâncias escolhidas
            para momentos especiais.
          </p>

          <div class="product-bottom">

            <strong>
              R$ 119,90
            </strong>

            <button
              class="product-add"
              type="button"
            >
              Comprar
            </button>

          </div>

        </div>

      </article>

    </div>

  </div>

</section>


<!-- =====================================================
     CATEGORIAS
===================================================== -->

<section
  class="categories"
  id="categorias"
>

  <div class="container">

    <div class="section-title">

      <span>
        Encontre o seu favorito
      </span>

      <h2>
        Nossas <strong>categorias</strong>
      </h2>

      <div class="gold-line"></div>

    </div>


    <div class="categories-grid">

      <a
        href="#produtos"
        class="category-card category-skincare"
        data-category="Skincare"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.52), rgba(255,196,216,0.32)), url('${categorySkincareBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Skincare</h3>
          <p>
            Cuidados para uma pele radiante.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>


      <a
        href="#produtos"
        class="category-card category-makeup"
        data-category="Maquiagem"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.48), rgba(255,188,216,0.28)), url('${categoryMakeupBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Maquiagem</h3>
          <p>
            Beleza, cor e personalidade.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>


      <a
        href="#produtos"
        class="category-card category-hair"
        data-category="Cabelos"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.48), rgba(255,214,183,0.28)), url('${categoryHairBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Cabelos</h3>
          <p>
            Tratamento e cuidado diário.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>


      <a
        href="#produtos"
        class="category-card category-body"
        data-category="Cosméticos"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.45), rgba(242,186,190,0.3)), url('${categoryBodyBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Cosméticos</h3>
          <p>
            Momentos de cuidado e bem-estar.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>


      <a
        href="#produtos"
        class="category-card category-perfume"
        data-category="Perfumes"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.46), rgba(255,196,213,0.28)), url('${categoryPerfumeBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Perfumes</h3>
          <p>
            Fragrâncias marcantes e delicadas.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>


      <a
        href="#produtos"
        class="category-card category-gifts"
        data-category="Kits e Presentes"
        style="background-image: linear-gradient(135deg, rgba(255,255,255,0.48), rgba(242,208,172,0.28)), url('${categoryGiftBg}'); background-size: cover; background-position: center;"
      >
        <div>
          <h3>Kits & Presentes</h3>
          <p>
            Escolhas especiais para presentear.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>

      <a
        href="#produtos"
        class="category-card category-special"
        data-category="Sessão de Dez"
        style="background-image: linear-gradient(135deg, #fff1e5, #ffd9b7 58%, #f8c4bb);"
      >
        <span class="category-brand-mark" aria-hidden="true">
          <img src="${amandaBrandImg}" alt="">
        </span>

        <div>
          <h3>Sessão de Dez</h3>
          <p>
            Promoções especiais da loja.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>

      <a
        href="#produtos"
        class="category-card category-accessories"
        data-category="Acessórios"
        style="background-image: linear-gradient(135deg, #f5eaff, #e4d4f5 58%, #f4d5e5);"
      >
        <span class="category-brand-mark" aria-hidden="true">
          <img src="${amandaBrandImg}" alt="">
        </span>

        <div>
          <h3>Acessórios</h3>
          <p>
            Detalhes que completam seu estilo.
          </p>
        </div>

        <span class="category-arrow">↗</span>
      </a>

    </div>

  </div>

</section>


<!-- =====================================================
     DESTAQUE
===================================================== -->

<section
  class="featured"
  id="destaques"
>

  <div class="container">

    <div class="featured-box">

      <div class="featured-content">

        <span class="featured-label">
          Seu momento de beleza
        </span>

        <h2>
          Cuide de você.
          <span>Você merece.</span>
        </h2>

        <p>
          Encontre produtos selecionados para
          transformar sua rotina em um momento
          especial de autocuidado.
        </p>

        <a
          href="#produtos"
          class="btn-primary"
        >
          Conhecer produtos
          <span class="btn-arrow">→</span>
        </a>

      </div>

      <div class="featured-decoration">
        <span>✦</span>
        <span>♡</span>
        <span>✧</span>
      </div>

    </div>

  </div>

</section>


<!-- =====================================================
     LOGIN
===================================================== -->

<section
  class="auth-page"
  id="login"
>

  <div class="auth-card">

    <div class="auth-brand">

      <img
        src="${amandaBrandImg}"
        alt="Amanda Cosméticos"
      >

    </div>

    <span class="auth-label">
      Área exclusiva
    </span>

    <h1>
      Bem-vinda.
    </h1>

    <p>
      Entre para acompanhar seus pedidos
      e deixar suas compras ainda mais práticas.
    </p>


    <!-- GOOGLE -->

    <button
      class="auth-button google-button"
      type="button"
    >

      <span
        class="social-icon google-icon"
        aria-hidden="true"
      >

        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label="Google"
        >

          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.9 2.4 2.7 6.7 2.7 12s4.2 9.6 9.3 9.6c5.4 0 9-3.8 9-9.1 0-.6-.1-1.2-.2-1.7H12z"
          />

          <path
            fill="#34A853"
            d="M3.8 7.4l3.5 2.6c.9-1.7 2.8-2.9 4.7-2.9 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4c-3.5 0-6.5 2-8.2 5z"
          />

          <path
            fill="#FBBC05"
            d="M3.8 16.7l3.9-3.1c.8 1.6 2.6 2.7 4.3 2.7 1.3 0 2.5-.5 3.4-1.5l3 2.6c-1.8 2.2-4.4 3.5-7.4 3.5-3.1 0-5.9-1.7-7.2-4.2z"
          />

          <path
            fill="#4285F4"
            d="M12 21.6c2.5 0 4.8-.8 6.4-2.2l-3.1-2.7c-.9.6-2 .9-3.3.9-2.8 0-5.1-1.9-5.7-4.5l-3.4 2.6C.7 18.9 5.7 21.6 12 21.6z"
          />

        </svg>

      </span>

      <span>
        Continuar com Google
      </span>

    </button>


    <p
      class="auth-feedback"
      role="status"
      aria-live="polite"
    ></p>

  </div>

</section>


<!-- =====================================================
     CONTATO
===================================================== -->

<section
  class="contact"
  id="contato"
>

  <div class="container">

    <div class="contact-box">

      <div>

        <span>
          Fale com a gente
        </span>

        <h2>
          Estamos aqui
          <strong>para você.</strong>
        </h2>

      </div>

      <div class="contact-actions">
        <a
          href="https://api.whatsapp.com/message/VELFBKYT6SCMJ1?autoload=1&app_absent=0&utm_source=ig"
          class="btn-gold contact-link whatsapp-contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
          <span class="btn-arrow">→</span>
        </a>

        <a
          href="https://www.instagram.com/amandacosmeticos___?igsi=MW83cmtnd3dpc2ZyMQ=="
          class="contact-social-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram
          <span class="btn-arrow">↗</span>
        </a>
      </div>

    </div>

  </div>

</section>

</main>


<!-- =====================================================
     CARRINHO
===================================================== -->

<aside
  class="cart-drawer"
  aria-hidden="true"
  aria-label="Carrinho de compras"
>

  <div class="cart-header">

    <div>

      <span class="eyebrow">
        Sua seleção
      </span>

      <h2>
        Seu carrinho
      </h2>

    </div>

    <button
      class="cart-close"
      type="button"
      aria-label="Fechar carrinho"
    >
      ×
    </button>

  </div>


  <div class="cart-items"></div>


  <div class="cart-footer">

    <div class="cart-total">
      <span>Total</span>
      <strong>R$ 0,00</strong>
    </div>

    <p class="payment-methods">
      Aceita Pix, cartão de crédito e cartão de débito
    </p>

    <button
      class="cart-checkout"
      type="button"
    >
      Pagar com InfinitePay
      <span>→</span>
    </button>

    <button
      class="cart-clear"
      type="button"
    >
      Limpar carrinho
    </button>

  </div>

</aside>


<div
  class="cart-overlay"
  aria-hidden="true"
></div>


<!-- =====================================================
     FOOTER
===================================================== -->

<footer class="footer">

  <div class="container">

    <div class="footer-main">

      <a
        href="#inicio"
        class="footer-logo"
      >

        <img
          src="${heroImg}"
          alt="Amanda Cosméticos"
        >

      </a>

      <p>
        Beleza, cuidado e autoestima
        em cada escolha.
      </p>

    </div>


    <div class="footer-bottom">

      <span>
        © 2026 Amanda Cosméticos.
        Todos os direitos reservados.
        Desenvolvido por
        <a
          href="https://www.rasterdigital.com.br/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Raster Digital
        </a>.
      </span>

      <span>
        Feito com carinho ♡
      </span>

    </div>

  </div>

</footer>


<!-- =====================================================
     WHATSAPP
===================================================== -->

<a
  href="https://api.whatsapp.com/message/VELFBKYT6SCMJ1?autoload=1&app_absent=0&utm_source=ig"
  class="whatsapp-float"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Falar no WhatsApp"
>

  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >

    <path
      d="M12.04 2.02c-5.35 0-9.7 4.34-9.7 9.7 0 1.71.45 3.38 1.31 4.84L2 22l5.6-1.47a9.7 9.7 0 0 0 4.44 1.02c5.35 0 9.7-4.35 9.7-9.7s-4.35-9.7-9.7-9.7Zm0 17.75c-1.43 0-2.82-.39-4.05-1.12l-.29-.17-3.32.87.89-3.23-.19-.33a7.9 7.9 0 0 1 1.67-9.1 7.9 7.9 0 0 1 11.18 11.18 7.87 7.87 0 0 1-6.49 2.4Zm4.33-5.91c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.16 1.7 2.58 4.11 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.41-.58 1.61-1.13.2-.55.2-1.03.14-1.13-.07-.1-.21-.16-.45-.28Z"
    />

  </svg>

</a>


<!-- =====================================================
     INSTAGRAM
===================================================== -->

<a
  href="https://www.instagram.com/amandacosmeticos___?igsi=MW83cmtnd3dpc2ZyMQ=="
  class="instagram-float"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Visitar o Instagram da Amanda Cosméticos"
>

  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >

    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      ry="5"
    ></rect>

    <circle
      cx="12"
      cy="12"
      r="4"
    ></circle>

    <circle
      cx="17.5"
      cy="6.5"
      r="1"
      class="instagram-dot"
    ></circle>

  </svg>

</a>


`


// =====================================================
// NAVEGAÇÃO SUAVE
// =====================================================

document.querySelectorAll('a[href^="#"]').forEach(link => {

  link.addEventListener('click', event => {

    const href = link.getAttribute('href')

    if (!href || href === '#') return

    const target = document.querySelector(href)

    if (!target) return

    event.preventDefault()

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

  })

})


// =====================================================
// PRODUTOS
// =====================================================

const productsGrid =
  document.querySelector('.products-grid')

let catalogProducts = []
let selectedProductCategory = 'Todas'


function productImage(product) {

  if (
    product.imagem_principal &&
    product.imagem_principal.startsWith('http')
  ) {
    return product.imagem_principal
  }

  if (
    product.imagem_principal &&
    product.imagem_principal.startsWith('/')
  ) {
    return (
      apiUrl.replace(/\/api\/?$/, '') +
      product.imagem_principal
    )
  }

  const category =
    (product.categoria || '').toLowerCase()

  if (category.includes('maqui')) {
    return makeupImg
  }

  if (category.includes('cabel')) {
    return hairImg
  }

  if (category.includes('perfume')) {
    return perfumeImg
  }

  return skincareImg
}


function productCard(product) {

  const regularPrice = Number(product.preco || 0)
  const promotionalPrice = Number(product.preco_promocional || 0)
  const hasPromotion = promotionalPrice > 0 && promotionalPrice < regularPrice
  const price = hasPromotion ? promotionalPrice : regularPrice

  const formatPrice = (value) => value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const badge = product.destaque
    ? '<span class="badge featured-badge">Destaque</span>'
    : ''

  return `
    <article
      class="product-card visible"
      data-product-id="${product.id}"
    >

      <div class="product-image">

        ${badge}

        <img
          src="${productImage(product)}"
          alt="${product.nome}"
        >

        <button
          class="product-heart"
          type="button"
          aria-label="Favoritar"
        >
          ♡
        </button>

      </div>

      <div class="product-info">

        <span class="product-category">
          ${product.categoria || 'Beleza'}
        </span>

        <h3>
          ${product.nome}
        </h3>

        <p>
          ${
            product.descricao ||
            'Produto selecionado para cuidar de você.'
          }
        </p>

        <div class="product-bottom">

          <div class="price-stack ${hasPromotion ? 'has-promotion' : ''}">
            ${hasPromotion ? `<span class="original-price">${formatPrice(regularPrice)}</span>` : ''}
            <strong>${formatPrice(price)}</strong>
          </div>

          <button
            class="product-add"
            type="button"
            aria-label="Adicionar ao carrinho"
          >
            Comprar
          </button>

        </div>

      </div>

    </article>
  `
}

function renderProductGroups(products) {
  const groups = products.reduce((groupsByCategory, product) => {
    const categoryName = product.categoria || 'Outros'
    const categoryId = product.categoria_id || categoryName
    const group = groupsByCategory.get(categoryId) || {
      name: categoryName,
      products: [],
    }

    group.products.push(product)
    groupsByCategory.set(categoryId, group)
    return groupsByCategory
  }, new Map())

  productsGrid.innerHTML = [...groups.values()]
    .map((group) => `
      <section class="product-category-group" data-category-group="${group.name}">
        <div class="product-category-heading">
          <h3>${group.name}</h3>
        </div>
        <div class="product-category-grid">
          ${group.products.map(productCard).join('')}
        </div>
      </section>
    `)
    .join('') + '<p class="products-empty-state" data-category-empty hidden></p>'

  filterProductGroups(selectedProductCategory)
}

function filterProductGroups(category) {
  selectedProductCategory = category

  const groups = [...productsGrid.querySelectorAll('[data-category-group]')]
  const matchingGroups = groups.filter(
    (group) => category === 'Todas' || group.dataset.categoryGroup === category
  )

  groups.forEach((group) => {
    group.hidden = category !== 'Todas' && group.dataset.categoryGroup !== category
  })

  document.querySelectorAll('.category-card[data-category]').forEach((card) => {
    const isSelected = card.dataset.category === category
    card.classList.toggle('is-selected', isSelected)
    if (isSelected) {
      card.setAttribute('aria-current', 'true')
    } else {
      card.removeAttribute('aria-current')
    }
  })

  const selectionLabel = document.querySelector('#products-selection-label')
  const activeCategory = document.querySelector('#products-active-category')
  const emptyState = productsGrid.querySelector('[data-category-empty]')

  if (selectionLabel) {
    selectionLabel.textContent = category === 'Todas'
      ? 'Seleção especial'
      : 'Categoria selecionada'
  }

  if (activeCategory) {
    activeCategory.textContent = category === 'Todas' ? 'você' : category
  }

  if (emptyState) {
    emptyState.hidden = category === 'Todas' || matchingGroups.length > 0
    emptyState.textContent = `Ainda não há produtos cadastrados em ${category}.`
  }
}

function renderProductsMessage(message) {
  productsGrid.innerHTML = `
    <div class="products-empty-state">
      ${message}
    </div>
  `
}


const fallbackProducts = [
  {
    id: 1,
    nome: 'Hidra Glow Serum',
    categoria: 'Skincare',
    categoria_id: 1,
    descricao: 'Sérum leve para hidratação intensa e pele luminosa.',
    preco: 89.9,
    preco_promocional: 69.9,
    destaque: true,
    imagem_principal: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 2,
    nome: 'Kit de Maquiagem Essentials',
    categoria: 'Maquiagem',
    categoria_id: 2,
    descricao: 'Base, blush e brilho para um acabamento impecável.',
    preco: 149.9,
    preco_promocional: 129.9,
    destaque: true,
    imagem_principal: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 3,
    nome: 'Tratamento Capilar Repair',
    categoria: 'Cabelos',
    categoria_id: 3,
    descricao: 'Nutrição profunda para fios bonitos, fortes e hidratados.',
    preco: 99.9,
    preco_promocional: 0,
    destaque: false,
    imagem_principal: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 4,
    nome: 'Óleo Corporal de Rosas',
    categoria: 'Cosméticos',
    categoria_id: 4,
    descricao: 'Hidratação e aroma delicado para uma rotina de autocuidado.',
    preco: 79.9,
    preco_promocional: 59.9,
    destaque: true,
    imagem_principal: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 5,
    nome: 'Perfume Floral Intense',
    categoria: 'Perfumes',
    categoria_id: 5,
    descricao: 'Uma fragrância marcante e sofisticada para todos os dias.',
    preco: 179.9,
    preco_promocional: 159.9,
    destaque: true,
    imagem_principal: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80',
  },
]

async function loadProducts() {

  if (!productsGrid) return

  try {

    const response =
      await fetch(apiUrl + '/produtos')

    if (!response.ok) {
      throw new Error(
        'Não foi possível carregar os produtos.'
      )
    }

    const data =
      await response.json()

    if (data.produtos?.length) {
      catalogProducts = data.produtos
      renderProductGroups(catalogProducts)
      productsGrid.dataset.source = 'api'
      return
    }

    throw new Error('Lista vazia da API')

  } catch (error) {

    console.warn(
      'Produtos da API indisponíveis. Mantendo produtos de demonstração.',
      error
    )

    catalogProducts = fallbackProducts
    renderProductGroups(catalogProducts)
    productsGrid.dataset.source = 'fallback'
  }
}


loadProducts()

document.querySelectorAll('.category-card[data-category]').forEach((categoryCard) => {
  categoryCard.addEventListener('click', () => {
    const category = categoryCard.dataset.category
    filterProductGroups(category)
    document.querySelector('#produtos')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
})

document.querySelectorAll('a[href="#produtos"]:not(.category-card)').forEach((link) => {
  link.addEventListener('click', () => {
    filterProductGroups('Todas')
  })
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadProducts()
  }
})


// =====================================================
// CARRINHO
// =====================================================

const cart =
  JSON.parse(
    localStorage.getItem('amanda_cart') || '[]'
  )

const cartDrawer =
  document.querySelector('.cart-drawer')

const cartOverlay =
  document.querySelector('.cart-overlay')

const cartItems =
  document.querySelector('.cart-items')

const cartCount =
  document.querySelector('.cart-count')

const cartTotal =
  document.querySelector('.cart-total strong')


function productFromCard(card) {

  const priceText =
    card
      .querySelector('.product-bottom strong')
      ?.textContent || '0'

  const price =
    Number(
      priceText
        .replace(/[^0-9,]/g, '')
        .replace(',', '.')
    )

  return {

    id:
      Number(card.dataset.productId) ||
      null,

    name:
      card
        .querySelector('h3')
        .textContent
        .trim(),

    price,

    image:
      card
        .querySelector('img')
        .src,

  }
}


function saveCart() {

  localStorage.setItem(
    'amanda_cart',
    JSON.stringify(cart)
  )

  renderCart()
}


function addToCart(card) {

  if (!card) return

  const product =
    productFromCard(card)

  const existing =
    cart.find(
      item => item.name === product.name
    )

  if (existing) {

    existing.quantity += 1

  } else {

    cart.push({
      ...product,
      quantity: 1,
    })

  }

  saveCart()

  openCart()
}


function renderCart() {

  if (
    !cartCount ||
    !cartTotal ||
    !cartItems
  ) {
    return
  }

  const totalItems =
    cart.reduce(
      (total, item) =>
        total + item.quantity,
      0
    )

  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        item.price *
        item.quantity,
      0
    )

  cartCount.textContent =
    totalItems

  cartTotal.textContent =
    total.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    )

  if (!cart.length) {

    cartItems.innerHTML =
      '<p class="cart-empty">Seu carrinho está vazio.</p>'

    return
  }

  cartItems.innerHTML =
    cart
      .map(
        (item, index) => `
          <div class="cart-item">

            <img
              src="${item.image}"
              alt="${item.name}"
            >

            <div class="cart-item-info">

              <strong>
                ${item.name}
              </strong>

              <span>
                ${item.price.toLocaleString(
                  'pt-BR',
                  {
                    style: 'currency',
                    currency: 'BRL',
                  }
                )}
              </span>

              <div class="cart-quantity">

                <button
                  type="button"
                  data-cart-action="decrease"
                  data-cart-index="${index}"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>

                <b>
                  ${item.quantity}
                </b>

                <button
                  type="button"
                  data-cart-action="increase"
                  data-cart-index="${index}"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>

              </div>

            </div>

          </div>
        `
      )
      .join('')
}


function openCart() {

  if (!cartDrawer || !cartOverlay) {
    return
  }

  cartDrawer.classList.add('open')

  cartDrawer.setAttribute(
    'aria-hidden',
    'false'
  )

  cartOverlay.classList.add(
    'visible'
  )
}


function closeCart() {

  if (!cartDrawer || !cartOverlay) {
    return
  }

  cartDrawer.classList.remove(
    'open'
  )

  cartDrawer.setAttribute(
    'aria-hidden',
    'true'
  )

  cartOverlay.classList.remove(
    'visible'
  )
}


document
  .querySelector('.cart-trigger')
  ?.addEventListener(
    'click',
    openCart
  )


document
  .querySelector('.cart-close')
  ?.addEventListener(
    'click',
    closeCart
  )


cartOverlay?.addEventListener(
  'click',
  closeCart
)


productsGrid?.addEventListener(
  'click',
  event => {

    const addButton =
      event.target.closest(
        '.product-add'
      )

    if (addButton) {

      addToCart(
        addButton.closest(
          '.product-card'
        )
      )

      return
    }

    const heartButton =
      event.target.closest(
        '.product-heart'
      )

    if (heartButton) {

      heartButton.classList.toggle(
        'active'
      )

      heartButton.textContent =
        heartButton.classList.contains(
          'active'
        )
          ? '♥'
          : '♡'
    }

  }
)


cartItems?.addEventListener(
  'click',
  event => {

    const button =
      event.target.closest(
        '[data-cart-action]'
      )

    if (!button) return

    const index =
      Number(
        button.dataset.cartIndex
      )

    const item = cart[index]

    if (!item) return

    if (
      button.dataset.cartAction ===
      'increase'
    ) {

      item.quantity += 1

    } else {

      item.quantity -= 1

    }

    if (item.quantity <= 0) {

      cart.splice(index, 1)

    }

    saveCart()
  }
)


document
  .querySelector('.cart-clear')
  ?.addEventListener(
    'click',
    () => {

      cart.splice(
        0,
        cart.length
      )

      saveCart()
    }
  )


document
  .querySelector('.cart-checkout')
  ?.addEventListener(
    'click',
    async () => {

      if (!cart.length) {

        openCart()

        return
      }

      const customerToken = localStorage.getItem('amanda_customer_token')
      if (!customerToken) {
        window.location.hash = '#login'
        showAuthFeedback('Entre com Google para continuar com o pagamento.', true)
        return
      }

      const checkoutButton =
        document.querySelector(
          '.cart-checkout'
        )

      if (!checkoutButton) return

      checkoutButton.disabled =
        true

      checkoutButton.textContent =
        'Abrindo pagamento...'

      try {

        const response =
          await fetch(
            apiUrl +
              '/pagamentos/checkout',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
                Authorization: `Bearer ${customerToken}`,
              },

              body: JSON.stringify({
                items: cart,
              }),
            }
          )

        const data =
          await response.json()

        if (!response.ok) {

          throw new Error(
            data.mensagem ||
              'Não foi possível iniciar o pagamento.'
          )
        }

        window.location.href =
          data.checkoutUrl

      } catch (error) {

        alert(
          error.message
        )

        checkoutButton.disabled =
          false

        checkoutButton.innerHTML =
          'Pagar com InfinitePay <span>→</span>'
      }

    }
  )


renderCart()


// =====================================================
// AUTENTICAÇÃO GOOGLE
// =====================================================

const authFeedback =
  document.querySelector(
    '.auth-feedback'
  )

const googleButton =
  document.querySelector(
    '.google-button'
  )

const authApiUrl =
  apiUrl


function showAuthFeedback(
  message,
  isError = false
) {

  if (!authFeedback) {
    return
  }

  authFeedback.textContent =
    message

  authFeedback.classList.toggle(
    'error',
    isError
  )
}


function loadExternalScript(src) {

  return new Promise(
    (resolve, reject) => {

      const existingScript =
        document.querySelector(
          'script[src="' +
            src +
            '"]'
        )

      if (existingScript) {

        if (
          existingScript.dataset
            .loaded === 'true'
        ) {

          resolve()

          return
        }

        existingScript.addEventListener(
          'load',
          resolve,
          { once: true }
        )

        existingScript.addEventListener(
          'error',
          reject,
          { once: true }
        )

        return
      }


      const script =
        document.createElement(
          'script'
        )

      script.src = src

      script.async = true


      script.onload = () => {

        script.dataset.loaded =
          'true'

        resolve()
      }


      script.onerror =
        reject


      document.head.appendChild(
        script
      )

    }
  )
}


async function loginGoogle(
  idToken,
  telefone = ''
) {

  const response =
    await fetch(
      authApiUrl +
        '/auth/google',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          idToken,
          telefone,
        }),
      }
    )


  const data =
    await response.json()


  if (!response.ok) {

    const error =
      new Error(
        data.mensagem ||
          'Não foi possível entrar com Google.'
      )

    error.status =
      response.status

    throw error
  }


  localStorage.setItem(
    'amanda_customer_token',
    data.token
  )


  showAuthFeedback(
    'Bem-vinda, ' +
      data.cliente.nome +
      '.'
  )


}


// =====================================================
// BOTÃO GOOGLE
// =====================================================

googleButton?.addEventListener(
  'click',
  async () => {

    const clientId =
      import.meta.env
        .VITE_GOOGLE_CLIENT_ID


    if (!clientId) {

      showAuthFeedback(
        'Configure VITE_GOOGLE_CLIENT_ID para ativar o login Google.',
        true
      )

      return
    }


    googleButton.disabled =
      true


    showAuthFeedback(
      'Abrindo o login Google...'
    )


    try {

      await loadExternalScript(
        'https://accounts.google.com/gsi/client'
      )


      if (
        !window.google ||
        !window.google.accounts
      ) {

        throw new Error(
          'Biblioteca do Google não foi carregada.'
        )
      }


      window.google.accounts.id.initialize(
        {

          client_id:
            clientId,

          callback:
            async ({
              credential,
            }) => {

              try {

                if (!credential) {

                  throw new Error(
                    'O Google não retornou o token de autenticação.'
                  )
                }


                await loginGoogle(
                  credential
                )


              } catch (error) {

                console.error(
                  'Erro no login Google:',
                  error
                )


                if (
                  error.status ===
                  400
                ) {

                  const telefone =
                    window.prompt(
                      'Informe seu telefone para concluir o cadastro:'
                    )


                  if (!telefone) {

                    showAuthFeedback(
                      'O telefone é necessário para concluir o cadastro.',
                      true
                    )

                    return
                  }


                  try {

                    await loginGoogle(
                      credential,
                      telefone
                    )

                  } catch (
                    retryError
                  ) {

                    console.error(
                      retryError
                    )

                    showAuthFeedback(
                      retryError.message ||
                        'Não foi possível concluir o cadastro.',
                      true
                    )
                  }

                } else {

                  showAuthFeedback(
                    error.message ||
                      'Não foi possível entrar com Google.',
                    true
                  )
                }

              } finally {

                googleButton.disabled =
                  false
              }

            },

        }
      )


      window.google.accounts.id.prompt()


    } catch (error) {

      console.error(
        'Erro ao carregar login Google:',
        error
      )


      googleButton.disabled =
        false


      showAuthFeedback(
        error.message ||
          'Não foi possível carregar o login Google.',
        true
      )
    }

  }
)
