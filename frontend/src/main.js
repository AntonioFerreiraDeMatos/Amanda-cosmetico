import './style.css'
import QRCode from 'qrcode'
import {
  buildOrderMessage,
  createWhatsAppOrderUrl,
  formatOrderNumber,
  WHATSAPP_BUSINESS_NUMBER,
} from './order-message.js'
import heroImg from './assets/hero.png'
import amandaBrandImg from './assets/images/amanddda.jfif'
import amandaVideo from './assets/videos/amanda-destaque.mp4'
import { resolveApiUrl } from './api-url.js'

const apiUrl = resolveApiUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV
)

const skincareImg =
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'

const makeupImg =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'

const hairImg =
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80'

const perfumeImg =
  'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80'

const storeAddress =
  'R. Aratanha, 118B - Barra do Ceará, Fortaleza - CE, 60331-020'
const encodedStoreAddress = encodeURIComponent(storeAddress)
const storeWhatsappUrl = `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}`

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

    <button
      class="nav-toggle"
      type="button"
      aria-controls="primary-navigation"
      aria-expanded="false"
      aria-label="Abrir menu"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <nav class="nav" id="primary-navigation">
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span class="cart-label">Carrinho</span>
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

    <div class="category-filter" id="categorias">
      <div class="category-filter-heading">
        <span>Explore por categoria</span>
        <p>Encontre mais rápido o que combina com você.</p>
      </div>

      <div class="category-filter-options" role="group" aria-label="Filtrar produtos por categoria">
        <button class="category-filter-button is-selected" type="button" data-category="Todas" aria-pressed="true">Todas</button>
        <button class="category-filter-button" type="button" data-category="Skincare" aria-pressed="false">Skincare</button>
        <button class="category-filter-button" type="button" data-category="Maquiagem" aria-pressed="false">Maquiagem</button>
        <button class="category-filter-button" type="button" data-category="Cabelos" aria-pressed="false">Cabelos</button>
        <button class="category-filter-button" type="button" data-category="Cosméticos" aria-pressed="false">Cosméticos</button>
        <button class="category-filter-button" type="button" data-category="Perfumes" aria-pressed="false">Perfumes</button>
        <button class="category-filter-button" type="button" data-category="Kits e Presentes" aria-pressed="false">Kits &amp; Presentes</button>
        <button class="category-filter-button" type="button" data-category="Sessão de Dez" aria-pressed="false">Sessão de Dez</button>
        <button class="category-filter-button" type="button" data-category="Acessórios" aria-pressed="false">Acessórios</button>
      </div>
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
     DESTAQUE
===================================================== -->

<section
  class="featured"
  id="destaques"
>

  <div class="container">

    <div class="featured-heading">
      <span class="featured-label">Escolhas especiais da Amanda</span>
      <h2>Novidades e <span>ofertas</span></h2>
      <p>Produtos selecionados pela nossa equipe para você.</p>
    </div>

    <div class="featured-products-grid" aria-live="polite"></div>
    <div class="featured-empty-state">
      <span aria-hidden="true">✦</span>
      <p>Estamos preparando novidades especiais. Volte em breve!</p>
      <a href="#produtos" class="btn-primary">
        Ver todos os produtos <span class="btn-arrow">→</span>
      </a>
    </div>

    <div class="featured-footer">
      <a href="#produtos" class="featured-all-link">
        Ver todos os produtos <span aria-hidden="true">→</span>
      </a>
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

    <div
      class="google-button"
      id="google-button"
      aria-label="Continuar com Google"
    ></div>


    <p
      class="auth-feedback"
      role="status"
      aria-live="polite"
    >
      <span class="auth-feedback-message"></span>
      <a class="auth-shopping-link" href="#produtos" hidden>Vamos às compras →</a>
    </p>

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

    <div class="contact-box visible">

      <div class="contact-heading">
        <span class="contact-eyebrow">
          Fale com a gente
        </span>

        <h2>
          Estamos aqui
          <strong>para você.</strong>
        </h2>

        <p>Chame no WhatsApp, acompanhe no Instagram ou venha nos visitar.</p>
      </div>

      <div class="contact-actions">
        <a
          href="${storeWhatsappUrl}"
          class="contact-card contact-whatsapp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="contact-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M20 11.6a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.6Z" />
              <path d="M9 8.5c.3-.6.6-.6.9-.6h.4c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .5l-.5.7c-.2.2-.2.4 0 .6.5.8 1.2 1.4 2 1.8.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.9.5-1.2-.3-2.6-1-3.8-2.1-1-.9-1.8-2.1-2-3.1-.2-.7 0-1.4.6-2Z" />
            </svg>
          </span>
          <span class="contact-card-copy">
            <strong>WhatsApp</strong>
            <small>Fale com a nossa equipe</small>
          </span>
          <span class="contact-card-arrow" aria-hidden="true">↗</span>
        </a>

        <a
          href="https://www.instagram.com/amandacosmeticos___?igsi=MW83cmtnd3dpc2ZyMQ=="
          class="contact-card contact-instagram"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="contact-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle class="instagram-icon-dot" cx="17.5" cy="6.5" r="1" />
            </svg>
          </span>
          <span class="contact-card-copy">
            <strong>Instagram</strong>
            <small>Novidades e inspirações</small>
          </span>
          <span class="contact-card-arrow" aria-hidden="true">↗</span>
        </a>

        <a
          href="https://www.google.com/maps/dir/?api=1&destination=${encodedStoreAddress}"
          class="contact-card contact-address"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="contact-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <span class="contact-card-copy">
            <strong>Visite nossa loja</strong>
            <small>${storeAddress}</small>
          </span>
          <span class="contact-card-arrow" aria-hidden="true">↗</span>
        </a>
      </div>

      <div class="contact-directions">
        <span class="contact-directions-label">Como chegar</span>
        <div class="contact-directions-links">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${encodedStoreAddress}" target="_blank" rel="noopener noreferrer">Google Maps</a>
          <a href="https://waze.com/ul?q=${encodedStoreAddress}&navigate=yes" target="_blank" rel="noopener noreferrer">Waze</a>
          <a href="https://m.uber.com/ul/?action=setPickup&dropoff[formatted_address]=${encodedStoreAddress}" target="_blank" rel="noopener noreferrer">Uber</a>
        </div>
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
  aria-label="Checkout"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>

  <div class="cart-header">

    <div>

      <span class="eyebrow">
        Compra segura
      </span>

      <h2>
        Finalizar pedido
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

  <ol class="checkout-progress" aria-label="Etapas do checkout">
    <li data-progress-step="1" aria-current="step"><span>1</span><b>Carrinho</b></li>
    <li data-progress-step="2"><span>2</span><b>Entrega</b></li>
    <li data-progress-step="3"><span>3</span><b>Pix</b></li>
    <li data-progress-step="4"><span>4</span><b>Confirmação</b></li>
  </ol>

  <div class="cart-footer">
    <section class="checkout-step" data-checkout-step="1" aria-labelledby="cart-step-title">
      <h3 id="cart-step-title">Seu carrinho</h3>
      <div class="cart-items"></div>

      <div class="checkout-order-totals">
        <div class="cart-subtotal">
          <span>Subtotal dos produtos</span>
          <strong>R$ 0,00</strong>
        </div>
        <div class="cart-total">
          <span>Total dos produtos</span>
          <strong>R$ 0,00</strong>
        </div>
      </div>
      <p class="shipping-pending-note">
        O frete será confirmado com a Amanda e não está incluído neste total.
      </p>
      <button class="cart-checkout" type="button" data-next-step="2">
        Continuar para entrega <span aria-hidden="true">→</span>
      </button>
      <button class="cart-clear" type="button">Limpar carrinho</button>
    </section>

    <section class="checkout-step" data-checkout-step="2" aria-labelledby="delivery-step-title" hidden>
      <div class="checkout-stage-heading">
        <h3 id="delivery-step-title">Dados de entrega</h3>
        <p>Informe como falar com você e onde entregar o pedido.</p>
      </div>
      <div class="checkout-two-column">
        <form class="checkout-form" id="checkout-form" novalidate>
          <label>
            Nome completo
            <input name="nome_destinatario" autocomplete="name" maxlength="150" required>
          </label>
          <label>
            WhatsApp com DDD
            <input name="telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" required aria-describedby="telefone-error">
            <small class="field-error" id="telefone-error"></small>
          </label>
          <div class="checkout-form-row">
            <label>
              CEP
              <input name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" required aria-describedby="cep-error">
              <small class="field-error" id="cep-error"></small>
            </label>
            <label>
              Número
              <input name="numero" autocomplete="address-line2" maxlength="20" required>
            </label>
          </div>
          <label>
            Endereço
            <input name="rua" autocomplete="address-line1" maxlength="200" required>
          </label>
          <label>
            Complemento <span class="optional-label">opcional</span>
            <input name="complemento" maxlength="100">
          </label>
          <label>
            Bairro
            <input name="bairro" autocomplete="address-level3" maxlength="100" required>
          </label>
          <div class="checkout-form-row">
            <label>
              Cidade
              <input name="cidade" autocomplete="address-level2" maxlength="100" required>
            </label>
            <label>
              Estado
              <input name="estado" autocomplete="address-level1" maxlength="100" required>
            </label>
          </div>
          <div class="checkout-stage-actions">
            <button class="checkout-back" type="button" data-previous-step="1">Voltar ao carrinho</button>
            <button class="cart-checkout" type="button" data-next-step="3">
              Continuar para pagamento <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
        <aside class="checkout-mini-summary" aria-label="Resumo do pedido">
          <h4>Resumo do pedido</h4>
          <div class="checkout-summary-items"></div>
          <div class="checkout-summary-total"><span>Total dos produtos</span><strong>R$ 0,00</strong></div>
          <p>Frete a confirmar pelo WhatsApp.</p>
        </aside>
      </div>
    </section>

    <section class="checkout-step" data-checkout-step="3" aria-labelledby="payment-step-title" hidden>
      <div class="checkout-stage-heading">
        <h3 id="payment-step-title">Revise seu pedido</h3>
        <p>Confira os itens e o endereço antes de registrar a compra.</p>
      </div>
      <div class="checkout-review" data-checkout-review>
        <section class="checkout-review-section">
          <div class="checkout-review-heading">
            <h4>Produtos</h4>
            <button type="button" class="checkout-edit" data-edit-step="1">Editar carrinho</button>
          </div>
          <div class="checkout-review-items"></div>
        </section>
        <section class="checkout-review-section">
          <div class="checkout-review-heading">
            <h4>Entrega</h4>
            <button type="button" class="checkout-edit" data-edit-step="2">Editar endereço</button>
          </div>
          <div class="checkout-review-address"></div>
        </section>
        <div class="checkout-review-total">
          <span>Subtotal dos produtos</span><strong data-review-subtotal>R$ 0,00</strong>
          <span>Desconto</span><strong data-review-discount>R$ 0,00</strong>
          <span>Frete</span><strong>A confirmar</strong>
          <span class="review-total-label">Valor do Pix</span><strong class="review-total-value" data-review-total>R$ 0,00</strong>
        </div>
        <p class="shipping-pending-note">O Pix considera apenas os produtos. O frete será combinado pelo WhatsApp.</p>
        <div class="checkout-stage-actions">
          <button class="checkout-back" type="button" data-previous-step="2">Voltar aos dados</button>
          <button class="cart-checkout" id="checkout-finalize" type="button">
            Registrar pedido e gerar Pix <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <p class="checkout-feedback" role="alert" aria-live="polite"></p>
      <div class="order-confirmation" hidden aria-live="polite"></div>
    </section>

    <section class="checkout-step" data-checkout-step="4" aria-labelledby="tracking-step-title" hidden>
      <div class="checkout-stage-heading">
        <h3 id="tracking-step-title">Acompanhe seu pedido</h3>
        <p>O status do pagamento só muda após a confirmação da loja.</p>
      </div>
      <div class="order-tracking" aria-live="polite"></div>
      <div class="checkout-stage-actions">
        <button class="checkout-back" type="button" data-previous-step="3">Voltar ao Pix</button>
        <button class="cart-checkout" type="button" data-refresh-order>
          Atualizar status <span aria-hidden="true">↻</span>
        </button>
      </div>
      <p class="checkout-feedback" role="alert" aria-live="polite"></p>
    </section>

    <p class="checkout-global-feedback" role="alert" aria-live="polite"></p>
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

<dialog class="phone-registration-dialog" aria-labelledby="phone-registration-title">
  <form class="phone-registration-form">
    <span class="auth-label">Só falta uma etapa</span>
    <h2 id="phone-registration-title">Informe seu celular</h2>
    <p>
      Vamos usar seu número para falar sobre seus pedidos e esclarecer dúvidas
      de compra. Se preferir, informe seu WhatsApp.
    </p>
    <label for="registration-phone">Celular com DDD</label>
    <input
      id="registration-phone"
      name="telefone"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      placeholder="(11) 99999-9999"
      aria-describedby="registration-phone-help registration-phone-error"
      required
    >
    <small id="registration-phone-help">Exemplo: (11) 99999-9999</small>
    <p
      class="phone-registration-error"
      id="registration-phone-error"
      role="alert"
      aria-live="polite"
    ></p>
    <div class="phone-registration-actions">
      <button class="phone-registration-cancel" type="button">Agora não</button>
      <button class="phone-registration-submit" type="submit">Continuar</button>
    </div>
  </form>
</dialog>

<!-- =====================================================
     WHATSAPP
===================================================== -->

<a
  href="${storeWhatsappUrl}"
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

const featuredProductsGrid =
  document.querySelector('.featured-products-grid')

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


function productCard(product, isFeatured = false) {

  const regularPrice = Number(product.preco || 0)
  const promotionalPrice = Number(product.preco_promocional || 0)
  const hasPromotion = promotionalPrice > 0 && promotionalPrice < regularPrice
  const price = hasPromotion ? promotionalPrice : regularPrice
  const available = Number(product.estoque) > 0

  const formatPrice = (value) => value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const badge = isFeatured && hasPromotion
    ? '<span class="badge featured-badge">Oferta especial</span>'
    : product.destaque
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
          src="${escapeHtml(productImage(product))}"
          alt="${escapeHtml(product.nome)}"
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
          ${escapeHtml(product.categoria || 'Beleza')}
        </span>

        <h3>
          ${escapeHtml(product.nome)}
        </h3>

        <p>
          ${
            escapeHtml(product.descricao) ||
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
            ${available ? '' : 'disabled'}
          >
            ${available ? 'Comprar' : 'Indisponível'}
          </button>

        </div>

      </div>

    </article>
  `
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character])
}

function renderFeaturedProducts(products) {
  if (!featuredProductsGrid) return

  const featuredProducts = products
    .filter((product) => product.destaque)

  featuredProductsGrid.innerHTML = featuredProducts
    .map((product) => productCard(product, true))
    .join('')

  const emptyState = document.querySelector('.featured-empty-state')
  const footer = document.querySelector('.featured-footer')
  if (emptyState) emptyState.hidden = featuredProducts.length > 0
  if (footer) footer.hidden = featuredProducts.length === 0
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

  document.querySelectorAll('.category-filter-button[data-category]').forEach((button) => {
    const isSelected = button.dataset.category === category
    button.classList.toggle('is-selected', isSelected)
    button.setAttribute('aria-pressed', String(isSelected))
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

    if (!data.fallback && Array.isArray(data.produtos) && data.produtos.length) {
      catalogProducts = data.produtos
      renderProductGroups(catalogProducts)
      renderFeaturedProducts(catalogProducts)
      productsGrid.dataset.source = 'api'
      renderCart()
      return
    }

    if (data.fallback) {
      throw new Error('O catálogo oficial está indisponível.')
    }

    if (!data.fallback && Array.isArray(data.produtos)) {
      catalogProducts = []
      renderProductsMessage('Nenhum produto disponível no momento.')
      renderFeaturedProducts([])
      productsGrid.dataset.source = 'api'
      renderCart()
      return
    }

    throw new Error('O catálogo não retornou produtos oficiais.')

  } catch (error) {

    console.warn(
      'Catálogo oficial indisponível.',
      error
    )

    catalogProducts = []
    renderProductsMessage('Não foi possível carregar o catálogo oficial. Tente novamente em instantes.')
    renderFeaturedProducts([])
    productsGrid.dataset.source = 'unavailable'
    renderCart()
  }
}


loadProducts()

document.querySelectorAll('.category-filter-button[data-category]').forEach((button) => {
  button.addEventListener('click', () => {
    filterProductGroups(button.dataset.category)
  })
})

document.querySelectorAll('a[href="#produtos"]').forEach((link) => {
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

let cart = []

try {
  const savedCart = JSON.parse(localStorage.getItem('amanda_cart') || '[]')
  if (Array.isArray(savedCart)) {
    cart = savedCart
      .filter((item) =>
        Number.isSafeInteger(Number(item?.id)) &&
        Number(item.id) > 0 &&
        Number.isSafeInteger(Number(item?.quantity)) &&
        Number(item.quantity) > 0
      )
      .map((item) => ({
        ...item,
        id: Number(item.id),
        quantity: Number(item.quantity),
      }))
  }
} catch {
  localStorage.removeItem('amanda_cart')
}

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

const cartSubtotal =
  document.querySelector('.cart-subtotal strong')

const navigationToggle =
  document.querySelector('.nav-toggle')

const primaryNavigation =
  document.querySelector('#primary-navigation')

function closePrimaryNavigation() {
  navigationToggle?.setAttribute('aria-expanded', 'false')
  navigationToggle?.setAttribute('aria-label', 'Abrir menu')
  primaryNavigation?.classList.remove('is-open')
}

navigationToggle?.addEventListener('click', () => {
  const isExpanded = navigationToggle.getAttribute('aria-expanded') === 'true'
  navigationToggle.setAttribute('aria-expanded', String(!isExpanded))
  navigationToggle.setAttribute(
    'aria-label',
    isExpanded ? 'Abrir menu' : 'Fechar menu'
  )
  primaryNavigation?.classList.toggle('is-open', !isExpanded)
})

primaryNavigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closePrimaryNavigation)
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePrimaryNavigation()
  }
})

const checkoutButton =
  document.querySelector('#checkout-finalize')

const checkoutContinueButton =
  document.querySelector('[data-checkout-step="1"] .cart-checkout')

const checkoutForm =
  document.querySelector('#checkout-form')

const checkoutFeedback =
  document.querySelector('.checkout-global-feedback')

const orderConfirmation =
  document.querySelector('.order-confirmation')

const orderTracking =
  document.querySelector('.order-tracking')

let checkoutStep = 1
let currentOrder = null
let currentOrderId = null
let isCreatingOrder = false
let previouslyFocusedElement = null

try {
  const savedStep = Number(sessionStorage.getItem('amanda_checkout_step'))
  const savedOrderId = Number(sessionStorage.getItem('amanda_checkout_order_id'))
  checkoutStep = Number.isInteger(savedStep) && savedStep >= 1 && savedStep <= 4
    ? savedStep
    : 1
  currentOrderId = Number.isSafeInteger(savedOrderId) && savedOrderId > 0
    ? savedOrderId
    : null
  if (!currentOrderId && checkoutStep > 2) checkoutStep = 1
} catch (error) {
  console.error('Não foi possível restaurar o estado do checkout:', error)
  checkoutStep = 1
  currentOrderId = null
}

function currentProductPrice(product) {
  const regularPrice = Number(product.preco || 0)
  const promotionalPrice = Number(product.preco_promocional || 0)

  return promotionalPrice > 0 && promotionalPrice < regularPrice
    ? promotionalPrice
    : regularPrice
}

function currentProduct(item) {
  return catalogProducts.find(
    (product) => Number(product.id) === Number(item.id)
  )
}

function prefillDeliveryContact(customer) {
  if (!checkoutForm || !customer) return

  const recipientInput = checkoutForm.elements.nome_destinatario
  const phoneInput = checkoutForm.elements.telefone

  if (!recipientInput.value && customer.nome) {
    recipientInput.value = customer.nome
  }

  if (!phoneInput.value && customer.telefone) {
    phoneInput.value = customer.telefone
  }
}

try {
  prefillDeliveryContact(
    JSON.parse(localStorage.getItem('amanda_customer_user') || 'null')
  )
} catch {
  localStorage.removeItem('amanda_customer_user')
}

try {
  const savedDelivery = JSON.parse(
    sessionStorage.getItem('amanda_checkout_delivery') || 'null'
  )
  if (savedDelivery && typeof savedDelivery === 'object') {
    for (const [name, value] of Object.entries(savedDelivery)) {
      const field = checkoutForm?.elements.namedItem(name)
      if (field && typeof value === 'string') field.value = value
    }
  }
} catch (error) {
  console.error('Não foi possível restaurar os dados de entrega:', error)
  sessionStorage.removeItem('amanda_checkout_delivery')
}


function productFromCard(card) {
  return {

    id:
      Number(card.dataset.productId) ||
      null,

    name:
      card
        .querySelector('h3')
        .textContent
        .trim(),

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
  localStorage.removeItem('amanda_checkout_attempt')

  renderCart()
}

function persistDeliveryForm() {
  if (!checkoutForm) return

  const values = Object.fromEntries(new FormData(checkoutForm).entries())
  sessionStorage.setItem('amanda_checkout_delivery', JSON.stringify(values))
}

function resetCurrentOrder() {
  currentOrder = null
  currentOrderId = null
  checkoutStep = 1
  sessionStorage.removeItem('amanda_checkout_order_id')
  sessionStorage.setItem('amanda_checkout_step', '1')
  if (orderConfirmation) {
    orderConfirmation.hidden = true
    orderConfirmation.replaceChildren()
  }
  if (orderTracking) orderTracking.replaceChildren()
  setCheckoutStep(1)
}


function addToCart(card) {

  if (!card) return

  const product =
    productFromCard(card)

  if (!product.id || productsGrid.dataset.source !== 'api') {
    return
  }

  const officialProduct = catalogProducts.find(
    (item) => Number(item.id) === product.id
  )

  if (!officialProduct || Number(officialProduct.estoque) < 1) {
    return
  }

  if (currentOrderId) resetCurrentOrder()

  const existing =
    cart.find(
      item => Number(item.id) === product.id
    )

  if (existing) {

    if (existing.quantity >= Number(officialProduct.estoque)) return
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
    !cartSubtotal ||
    !cartItems
  ) {
    return
  }

  if (checkoutFeedback) {
    checkoutFeedback.textContent = ''
  }

  const totalItems =
    cart.reduce(
      (total, item) =>
        total + item.quantity,
      0
    )

  const total = cart.reduce((sum, item) => {
    const product = currentProduct(item)
    return product
      ? sum + currentProductPrice(product) * Number(item.quantity)
      : sum
  }, 0)

  cartCount.textContent =
    totalItems

  const formattedTotal = total.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
  cartSubtotal.textContent = formattedTotal
  cartTotal.textContent = formattedTotal

  if (!cart.length) {

    cartItems.innerHTML =
      '<p class="cart-empty">Seu carrinho está vazio.</p>'

    checkoutContinueButton.disabled = true
    renderCheckoutSummary()
    return
  }

  cartItems.innerHTML = cart.map((item, index) => {
    const product = currentProduct(item)
    const available = Boolean(product)
    const price = available ? currentProductPrice(product) : null
    const quantity = Number(item.quantity)
    const productName = product?.nome || item.name || 'Produto indisponível'
    const image = product ? productImage(product) : item.image || ''
    const stock = Number(product?.estoque || 0)

    return `
          <div class="cart-item">

            <img
              src="${escapeHtml(image)}"
              alt="${escapeHtml(productName)}"
            >

            <div class="cart-item-info">

              <strong>
                ${escapeHtml(productName)}
              </strong>

              <span>
                ${available
                  ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : 'Preço indisponível'}
              </span>

              <span class="cart-item-subtotal">
                ${available
                  ? `Subtotal: ${(price * quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : 'Produto indisponível no catálogo atual'}
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
                  ${quantity}
                </b>

                <button
                  type="button"
                  data-cart-action="increase"
                  data-cart-index="${index}"
                  aria-label="Aumentar quantidade de ${escapeHtml(productName)}"
                  ${!available || quantity >= stock ? 'disabled' : ''}
                >
                  +
                </button>

              </div>

            </div>
            <button
              class="cart-item-remove"
              type="button"
              data-cart-action="remove"
              data-cart-index="${index}"
              aria-label="Remover ${escapeHtml(productName)} do carrinho"
            >
              Remover
            </button>

          </div>
        `
  }).join('')

  const cartIsValid = productsGrid.dataset.source === 'api' &&
    cart.every((item) => {
      const product = currentProduct(item)
      return product && Number(item.quantity) <= Number(product.estoque)
    })
  checkoutContinueButton.disabled = !cartIsValid
  renderCheckoutSummary()
}

function renderCheckoutSummary() {
  const total = cart.reduce((sum, item) => {
    const product = currentProduct(item)
    return product
      ? sum + currentProductPrice(product) * Number(item.quantity)
      : sum
  }, 0)
  const formattedTotal = formatCurrency(total)
  const summaryItems = cart.map((item) => {
    const product = currentProduct(item)
    if (!product) return ''

    return `
      <div class="checkout-summary-item">
        <span>${escapeHtml(product.nome)} <b>× ${Number(item.quantity)}</b></span>
        <strong>${formatCurrency(currentProductPrice(product) * Number(item.quantity))}</strong>
      </div>
    `
  }).join('')

  document.querySelectorAll('.checkout-summary-items, .checkout-review-items').forEach((element) => {
    element.innerHTML = summaryItems || '<p class="cart-empty">Seu carrinho está vazio.</p>'
  })
  document.querySelectorAll('.checkout-summary-total strong, [data-review-subtotal], [data-review-total]').forEach((element) => {
    element.textContent = formattedTotal
  })
  const discount = document.querySelector('[data-review-discount]')
  if (discount) discount.textContent = formatCurrency(0)
}

function getDeliveryValues() {
  return Object.fromEntries(new FormData(checkoutForm).entries())
}

function renderCheckoutReview() {
  const address = getDeliveryValues()
  const addressContainer = document.querySelector('.checkout-review-address')
  if (!addressContainer) return

  const addressLines = [
    address.nome_destinatario,
    address.telefone,
    `${address.rua}, ${address.numero}`,
    address.complemento,
    address.bairro,
    `${address.cidade} - ${address.estado}`,
    `CEP ${address.cep}`,
  ].filter(Boolean)

  addressContainer.replaceChildren()
  for (const line of addressLines) {
    const paragraph = document.createElement('p')
    paragraph.textContent = line
    addressContainer.append(paragraph)
  }
  renderCheckoutSummary()
}

function setCheckoutStep(step) {
  checkoutStep = step
  document.querySelectorAll('[data-checkout-step]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.checkoutStep) !== step
  })
  const review = document.querySelector('[data-checkout-review]')
  if (review) review.hidden = Boolean(currentOrder)
  document.querySelectorAll('[data-progress-step]').forEach((item) => {
    const itemStep = Number(item.dataset.progressStep)
    if (itemStep === step) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
    item.classList.toggle('is-complete', itemStep < step)
  })
  sessionStorage.setItem('amanda_checkout_step', String(step))
  if (step === 3 && !currentOrder) renderCheckoutReview()
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
  document.body.classList.add('cart-open')
  previouslyFocusedElement = document.activeElement
  cartDrawer.querySelector('.cart-close')?.focus()
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
  document.body.classList.remove('cart-open')
  previouslyFocusedElement?.focus?.()
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

featuredProductsGrid?.addEventListener('click', (event) => {
  const addButton = event.target.closest('.product-add')
  if (addButton) {
    addToCart(addButton.closest('.product-card'))
    return
  }

  const heartButton = event.target.closest('.product-heart')
  if (heartButton) {
    heartButton.classList.toggle('active')
    heartButton.textContent = heartButton.classList.contains('active') ? '♥' : '♡'
  }
})


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

    if (button.dataset.cartAction === 'remove') {
      cart.splice(index, 1)
    } else if (button.dataset.cartAction === 'increase') {
      item.quantity += 1
    } else if (button.dataset.cartAction === 'decrease') {
      item.quantity -= 1
      if (item.quantity <= 0) cart.splice(index, 1)
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
      checkoutForm.reset()
      sessionStorage.removeItem('amanda_checkout_delivery')
      orderConfirmation.hidden = true
      orderConfirmation.replaceChildren()
      checkoutFeedback.textContent = ''
      setCheckoutStep(1)
    }
  )

checkoutForm?.addEventListener('input', (event) => {
  const field = event.target
  field.setCustomValidity?.('')
  if (field.name === 'telefone' || field.name === 'cep') {
    const digits = field.value.replace(/\D/g, '')
    const valid = field.name === 'telefone'
      ? digits.length >= 10 && digits.length <= 13
      : digits.length === 8
    const error = document.querySelector(`#${field.name}-error`)
    field.setAttribute('aria-invalid', String(!valid))
    if (error && valid) error.textContent = ''
  }
  persistDeliveryForm()
})

checkoutForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  document.querySelector('[data-next-step="3"]')?.click()
})

cartDrawer?.addEventListener('click', (event) => {
  const nextButton = event.target.closest('[data-next-step]')
  if (nextButton) {
    const nextStep = Number(nextButton.dataset.nextStep)
    if (nextStep === 2) {
      const valid = productsGrid.dataset.source === 'api' &&
        cart.length > 0 &&
        cart.every((item) => {
          const product = currentProduct(item)
          return product && Number(item.quantity) <= Number(product.estoque)
        })
      if (!valid) {
        checkoutFeedback.textContent = 'Confira a disponibilidade dos produtos no carrinho.'
        setCheckoutStep(1)
        return
      }
    }
    if (nextStep === 3 && !validateDeliveryForm()) return
    if (nextStep === 4 && !currentOrder) return
    checkoutFeedback.textContent = ''
    setCheckoutStep(nextStep)
    return
  }

  const previousButton = event.target.closest('[data-previous-step], [data-edit-step]')
  if (previousButton) {
    const step = Number(
      previousButton.dataset.previousStep || previousButton.dataset.editStep
    )
    checkoutFeedback.textContent = ''
    setCheckoutStep(step)
  }
})

function validateDeliveryForm() {
  const phone = checkoutForm.elements.telefone
  const cep = checkoutForm.elements.cep
  const phoneError = document.querySelector('#telefone-error')
  const cepError = document.querySelector('#cep-error')
  const phoneDigits = phone.value.replace(/\D/g, '')
  const cepDigits = cep.value.replace(/\D/g, '')
  const phoneIsValid = phoneDigits.length >= 10 && phoneDigits.length <= 13
  const cepIsValid = cepDigits.length === 8

  phone.setCustomValidity(
    phoneIsValid ? '' : 'Informe um WhatsApp válido com DDD.'
  )
  cep.setCustomValidity(
    cepIsValid ? '' : 'Informe um CEP com 8 números.'
  )
  phone.setAttribute('aria-invalid', String(!phoneIsValid))
  cep.setAttribute('aria-invalid', String(!cepIsValid))
  phoneError.textContent = phoneIsValid ? '' : 'Informe um número com DDD.'
  cepError.textContent = cepIsValid ? '' : 'O CEP deve conter 8 números.'

  const valid = checkoutForm.reportValidity()
  if (!valid) return false

  persistDeliveryForm()
  renderCheckoutReview()
  return true
}


function createIdempotencyKey() {
  if (window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function getCheckoutIdempotencyKey(requestBody) {
  const fingerprint = JSON.stringify(requestBody)
  let previousAttempt = null

  try {
    previousAttempt = JSON.parse(
      localStorage.getItem('amanda_checkout_attempt') || 'null'
    )
  } catch {
    localStorage.removeItem('amanda_checkout_attempt')
  }

  if (
    previousAttempt?.fingerprint === fingerprint &&
    typeof previousAttempt.key === 'string'
  ) {
    return previousAttempt.key
  }

  const key = createIdempotencyKey()
  localStorage.setItem(
    'amanda_checkout_attempt',
    JSON.stringify({ fingerprint, key })
  )
  return key
}

function paymentStatusLabel(status) {
  return {
    pendente: 'Aguardando confirmação do Pix',
    processando: 'Pagamento em processamento',
    aprovado: 'Pagamento confirmado pela loja',
    recusado: 'Pagamento recusado',
    cancelado: 'Pagamento cancelado',
    estornado: 'Pagamento estornado',
  }[status] || 'Status de pagamento indisponível'
}

function orderStatusLabel(status, paymentStatus) {
  if (status === 'pago' && paymentStatus !== 'aprovado') {
    return 'Aguardando confirmação do pagamento'
  }
  return {
    pendente: 'Pendente',
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pago',
    processando: 'Em preparação',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  }[status] || 'Em acompanhamento'
}

function orderCreatedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function renderOrderConfirmation(data) {
  const { pedido, itens, pagamento, endereco } = data
  if (!pedido?.numero_pedido || !Array.isArray(itens) || !itens.length) {
    throw new Error('A API não retornou os dados completos do pedido.')
  }
  const total = Number(pedido.total)
  const paymentValue = Number(pagamento?.valor)
  if (
    pagamento?.metodo !== 'pix' ||
    !Number.isFinite(total) ||
    !Number.isFinite(paymentValue) ||
    Math.round(total * 100) !== Math.round(paymentValue * 100)
  ) {
    throw new Error('Os dados do pagamento Pix não correspondem ao total registrado.')
  }
  if (pagamento.status === 'pendente' && !pagamento.codigo_copia_cola) {
    throw new Error('Pedido registrado, mas o código Pix ainda não está disponível. Tente recuperar o pagamento.')
  }

  currentOrder = data
  orderConfirmation.replaceChildren()
  orderConfirmation.hidden = false
  const review = document.querySelector('[data-checkout-review]')
  if (review) review.hidden = true

  const heading = document.createElement('p')
  heading.className = 'order-confirmation-heading'
  heading.textContent = `${formatOrderNumber(pedido)} registrado`
  const orderTime = document.createElement('p')
  orderTime.textContent = `Data: ${orderCreatedAt(pedido.criado_em)}`
  orderConfirmation.append(heading, orderTime)

  const paymentStatus = document.createElement('p')
  paymentStatus.className = 'payment-status-notice'
  paymentStatus.textContent = paymentStatusLabel(pagamento.status)
  orderConfirmation.append(paymentStatus)

  if (pagamento.status === 'pendente') {
    const pixPanel = document.createElement('section')
    pixPanel.className = 'pix-payment-panel'
    const title = document.createElement('h3')
    title.textContent = 'Pague com Pix'
    const amount = document.createElement('strong')
    amount.className = 'pix-payment-value'
    amount.textContent = formatCurrency(pagamento.valor)
    const instructions = document.createElement('p')
    instructions.textContent = 'Abra o aplicativo do seu banco, escolha Pix e escaneie o QR Code ou copie e cole o código abaixo.'
    const qrStatus = document.createElement('p')
    qrStatus.className = 'pix-qr-status'
    qrStatus.setAttribute('role', 'status')

    try {
      const qrImage = document.createElement('img')
      qrImage.className = 'pix-qr-code'
      qrImage.alt = 'QR Code Pix do pedido'
      qrImage.src = await QRCode.toDataURL(pagamento.codigo_copia_cola, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
      })
      pixPanel.append(qrImage)
    } catch (error) {
      console.error('Não foi possível gerar o QR Code Pix:', error)
      qrStatus.textContent = 'QR Code indisponível; copie o código Pix para concluir o pagamento.'
    }

    const codeLabel = document.createElement('label')
    codeLabel.textContent = 'Pix copia e cola'
    const code = document.createElement('textarea')
    code.className = 'pix-copy-code'
    code.readOnly = true
    code.rows = 4
    code.value = pagamento.codigo_copia_cola
    const copyButton = document.createElement('button')
    copyButton.className = 'pix-copy-button'
    copyButton.type = 'button'
    copyButton.textContent = 'Copiar código Pix'
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.value)
        qrStatus.textContent = 'Código Pix copiado.'
      } catch (error) {
        console.warn('A cópia automática do Pix não está disponível:', error)
        code.focus()
        code.select()
        qrStatus.textContent = 'Selecione e copie o código Pix.'
      }
    })

    pixPanel.prepend(title, amount, instructions)
    pixPanel.append(codeLabel, code, copyButton, qrStatus)
    orderConfirmation.append(pixPanel)
  }

  try {
    const orderMessage = buildOrderMessage({
      order: pedido,
      items: itens,
      address: endereco || {},
      customer: data.cliente,
      payment: pagamento,
    })
    const whatsappLink = document.createElement('a')
    whatsappLink.className = 'whatsapp-order-link'
    whatsappLink.href = createWhatsAppOrderUrl(orderMessage, WHATSAPP_BUSINESS_NUMBER)
    whatsappLink.target = '_blank'
    whatsappLink.rel = 'noopener noreferrer'
    whatsappLink.textContent = 'Falar com a Amanda no WhatsApp'
    orderConfirmation.append(whatsappLink)
  } catch (error) {
    console.error('Não foi possível montar o link do pedido para WhatsApp:', error)
  }

  const whatsappHelp = document.createElement('p')
  whatsappHelp.className = 'whatsapp-order-help'
  whatsappHelp.textContent = 'O WhatsApp é opcional para registrar o pedido. O frete será confirmado por lá; abrir a conversa não confirma o pagamento.'
  const trackingButton = document.createElement('button')
  trackingButton.className = 'cart-checkout'
  trackingButton.type = 'button'
  trackingButton.dataset.nextStep = '4'
  trackingButton.textContent = 'Acompanhar pedido'
  orderConfirmation.append(whatsappHelp, trackingButton)
  renderOrderTracking(data)
}

function renderOrderTracking(data) {
  if (!orderTracking) return

  const { pedido, itens, pagamento, endereco } = data
  const paymentStatus = paymentStatusLabel(pagamento?.status)
  const products = itens.map((item) => `
    <div class="tracking-item">
      <span>${escapeHtml(item.nome_produto)} <b>× ${Number(item.quantidade)}</b></span>
      <strong>${formatCurrency(item.subtotal)}</strong>
    </div>
  `).join('')
  const addressLines = endereco
    ? [
      endereco.nome_destinatario,
      endereco.telefone,
      `${endereco.rua}, ${endereco.numero}`,
      endereco.complemento,
      endereco.bairro,
      `${endereco.cidade} - ${endereco.estado}`,
      endereco.cep && `CEP ${endereco.cep}`,
    ].filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('')
    : '<p>Dados de entrega não disponíveis.</p>'
  const freight = Number(pedido.frete) > 0
    ? formatCurrency(pedido.frete)
    : 'A confirmar pelo WhatsApp'
  const discount = Number(pedido.desconto) > 0
    ? formatCurrency(pedido.desconto)
    : formatCurrency(0)

  orderTracking.innerHTML = `
    <section class="tracking-card">
      <h4>${escapeHtml(formatOrderNumber(pedido))}</h4>
      <p>Registrado em ${escapeHtml(orderCreatedAt(pedido.criado_em))}</p>
      <div class="tracking-status">
        <span>Status do pedido</span><strong>${escapeHtml(orderStatusLabel(pedido.status, pagamento?.status))}</strong>
        <span>Status do pagamento</span><strong>${escapeHtml(paymentStatus)}</strong>
      </div>
    </section>
    <section class="tracking-card">
      <h4>Produtos</h4>
      ${products}
      <div class="tracking-total"><span>Subtotal dos produtos</span><strong>${formatCurrency(pedido.subtotal)}</strong></div>
      <div class="tracking-total"><span>Desconto</span><strong>${discount}</strong></div>
      <div class="tracking-total"><span>Frete</span><strong>${freight}</strong></div>
      <div class="tracking-total tracking-grand-total"><span>Total registrado</span><strong>${formatCurrency(pedido.total)}</strong></div>
    </section>
    <section class="tracking-card">
      <h4>Entrega</h4>
      ${addressLines}
      <p class="shipping-pending-note">A Amanda confirmará o valor do frete pelo WhatsApp.</p>
    </section>
  `
}

async function requestCustomerOrder(id) {
  const customerToken = localStorage.getItem('amanda_customer_token')
  if (!customerToken) {
    closeCart()
    window.location.hash = '#login'
    throw new Error('Entre com sua conta para recuperar o pedido.')
  }

  const response = await fetch(`${apiUrl}/pedidos/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.mensagem || 'Não foi possível carregar o pedido.')
  }
  return data
}

async function restoreSavedOrder() {
  if (!currentOrderId) {
    setCheckoutStep(checkoutStep)
    return
  }

  openCart()
  setCheckoutStep(checkoutStep >= 3 ? checkoutStep : 3)
  try {
    const data = await requestCustomerOrder(currentOrderId)
    currentOrder = data
    await renderOrderConfirmation(data)
    renderOrderTracking(data)
    setCheckoutStep(checkoutStep)
  } catch (error) {
    checkoutFeedback.textContent = error.message || 'Não foi possível recuperar o pedido.'
    setCheckoutStep(checkoutStep >= 3 ? checkoutStep : 3)
  }
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

checkoutButton?.addEventListener('click', async () => {
  if (isCreatingOrder) return
  isCreatingOrder = true
  checkoutButton.disabled = true
  checkoutButton.textContent = currentOrderId ? 'Recuperando Pix...' : 'Registrando pedido...'
  checkoutFeedback.textContent = ''

  try {
    let data
    if (currentOrderId) {
      data = await requestCustomerOrder(currentOrderId)
    } else {
      const customerToken = localStorage.getItem('amanda_customer_token')
      if (!customerToken) {
        closeCart()
        window.location.hash = '#login'
        showAuthFeedback('Entre com Google para registrar seu pedido.', true)
        throw new Error('Entre com sua conta para registrar o pedido.')
      }

      const requestBody = {
        items: cart.map((item) => ({
          id: Number(item.id),
          quantity: Number(item.quantity),
        })),
        endereco: getDeliveryValues(),
      }
      const idempotencyKey = getCheckoutIdempotencyKey(requestBody)
      const response = await fetch(apiUrl + '/pedidos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(requestBody),
      })
      data = await response.json()
      if (!response.ok) {
        throw new Error(data.mensagem || 'Não foi possível registrar o pedido.')
      }
    }

    const orderId = Number(data.pedido?.id)
    if (Number.isSafeInteger(orderId) && orderId > 0) {
      currentOrderId = orderId
      sessionStorage.setItem('amanda_checkout_order_id', String(orderId))
      sessionStorage.setItem('amanda_checkout_step', '3')
    }

    await renderOrderConfirmation(data)
    cart.splice(0, cart.length)
    saveCart()
    currentOrder = data
    renderOrderTracking(data)
    setCheckoutStep(3)
  } catch (error) {
    console.error('Falha ao registrar ou recuperar o pedido:', error)
    checkoutFeedback.textContent = error.message || 'Não foi possível concluir o pedido. Tente novamente.'
  } finally {
    isCreatingOrder = false
    checkoutButton.disabled = false
    checkoutButton.innerHTML = currentOrderId
      ? 'Tentar recuperar Pix <span aria-hidden="true">↻</span>'
      : 'Registrar pedido e gerar Pix <span aria-hidden="true">→</span>'
  }
})

document.querySelector('[data-refresh-order]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget
  if (!currentOrderId || button.disabled) return

  button.disabled = true
  checkoutFeedback.textContent = ''
  try {
    const data = await requestCustomerOrder(currentOrderId)
    currentOrder = data
    await renderOrderConfirmation(data)
    renderOrderTracking(data)
    setCheckoutStep(4)
  } catch (error) {
    checkoutFeedback.textContent = error.message || 'Não foi possível atualizar o pedido.'
  } finally {
    button.disabled = false
  }
})


renderCart()
restoreSavedOrder()


// =====================================================
// AUTENTICAÇÃO GOOGLE
// =====================================================

const authFeedback =
  document.querySelector(
    '.auth-feedback'
  )

const authFeedbackMessage =
  authFeedback?.querySelector('.auth-feedback-message')

const authShoppingLink =
  authFeedback?.querySelector('.auth-shopping-link')

const googleButton =
  document.querySelector(
    '.google-button'
  )

const phoneRegistrationDialog =
  document.querySelector('.phone-registration-dialog')

const phoneRegistrationForm =
  document.querySelector('.phone-registration-form')

const phoneRegistrationInput =
  document.querySelector('#registration-phone')

const phoneRegistrationError =
  document.querySelector('#registration-phone-error')

let resolvePhoneRegistration

const authApiUrl =
  apiUrl


function requestPhoneRegistration() {
  return new Promise((resolve) => {
    resolvePhoneRegistration = resolve
    phoneRegistrationForm.reset()
    phoneRegistrationError.textContent = ''
    phoneRegistrationDialog.showModal()
    phoneRegistrationInput.focus()
  })
}


phoneRegistrationDialog?.addEventListener('close', () => {
  if (!resolvePhoneRegistration) {
    return
  }

  const phone = phoneRegistrationDialog.returnValue === 'submit'
    ? phoneRegistrationInput.value.trim()
    : null
  const resolve = resolvePhoneRegistration

  resolvePhoneRegistration = null
  resolve(phone)
})


phoneRegistrationForm?.addEventListener('submit', (event) => {
  event.preventDefault()

  const phone = phoneRegistrationInput.value.trim()
  const digits = phone.replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 13) {
    phoneRegistrationError.textContent =
      'Confira o número com DDD. Use de 10 a 13 dígitos.'
    phoneRegistrationInput.focus()
    return
  }

  phoneRegistrationError.textContent = ''
  phoneRegistrationDialog.close('submit')
})


phoneRegistrationDialog
  ?.querySelector('.phone-registration-cancel')
  .addEventListener('click', () => {
    phoneRegistrationDialog.close('cancel')
  })


function showAuthFeedback(
  message,
  isError = false,
  showShoppingLink = false
) {

  if (!authFeedback || !authFeedbackMessage || !authShoppingLink) {
    return
  }

  authFeedbackMessage.textContent =
    message

  authFeedback.classList.toggle(
    'error',
    isError
  )
  authShoppingLink.hidden = !showShoppingLink
}


function loadExternalScript(src) {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

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

  if (!data.token || !data.cliente) {
    throw new Error('A API não retornou os dados da sessão Google.')
  }

  localStorage.setItem(
    'amanda_customer_token',
    data.token
  )
  localStorage.setItem(
    'amanda_customer_user',
    JSON.stringify(data.cliente)
  )
  prefillDeliveryContact(data.cliente)

  if (currentOrderId) {
    await restoreSavedOrder()
  } else if (cart.length) {
    openCart()
  }

  showAuthFeedback(
    'Olá, ' +
      data.cliente.nome +
      '! Que tal conhecer nossos produtos?',
    false,
    true
  )


}


// =====================================================
// BOTÃO GOOGLE
// =====================================================

async function handleGoogleCredential({ credential }) {
  if (!credential) {
    showAuthFeedback('O Google não retornou o token de autenticação.', true)
    return
  }

  try {
    await loginGoogle(credential)
  } catch (error) {
    console.error('Erro no login Google:', error)

    if (error.status === 400) {
      const telefone = await requestPhoneRegistration()

      if (!telefone) {
        showAuthFeedback('O telefone é necessário para concluir o cadastro.', true)
        return
      }

      try {
        await loginGoogle(credential, telefone)
      } catch (retryError) {
        console.error('Erro ao concluir o cadastro Google:', retryError)
        showAuthFeedback(
          retryError.message || 'Não foi possível concluir o cadastro.',
          true
        )
      }

      return
    }

    showAuthFeedback(error.message || 'Não foi possível entrar com Google.', true)
  }
}

async function initializeGoogleLogin() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!googleButton) return

  if (!clientId) {
    showAuthFeedback('Configure VITE_GOOGLE_CLIENT_ID para ativar o login Google.', true)
    return
  }

  try {
    await loadExternalScript('https://accounts.google.com/gsi/client')

    if (!window.google?.accounts?.id) {
      throw new Error('Biblioteca do Google não foi carregada.')
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
    })
    window.google.accounts.id.renderButton(googleButton, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: Math.min(400, Math.floor(googleButton.getBoundingClientRect().width || 320)),
    })
  } catch (error) {
    console.error('Erro ao carregar login Google:', error)
    showAuthFeedback(
      error.message || 'Não foi possível carregar o login Google.',
      true
    )
  }
}

initializeGoogleLogin()
