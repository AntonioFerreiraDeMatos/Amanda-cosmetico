// Leitura de código de barras no painel.
//
// 1) Pistola USB/Bluetooth: funciona como um teclado que digita o código muito
//    rápido e aperta Enter. Capturamos isso em qualquer lugar da tela, sem
//    precisar clicar num campo antes.
// 2) Câmera do celular/computador: usa o leitor nativo do navegador quando
//    existe (Android/Chrome) e, se não, a biblioteca ZXing (iPhone/Safari).

import { openDialog, esc } from './ui.js'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code']

export function cleanCode(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

// ---------- som e vibração de confirmação ----------
let audioCtx
export function feedback(ok = true) {
  try {
    navigator.vibrate?.(ok ? 40 : [60, 50, 60])
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = ok ? 1320 : 220
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (ok ? 0.12 : 0.3))
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + (ok ? 0.13 : 0.32))
  } catch { /* sem áudio: segue só com o visual */ }
}

/**
 * Captura leituras da pistola em qualquer lugar da página.
 * A pistola "digita" muitos caracteres em menos de ~40ms cada; uma pessoa não.
 * Campos marcados com data-scan-input recebem a leitura normalmente.
 * Retorna uma função para parar de escutar.
 */
export function listenHardwareScanner(onCode, { minLength = 4, maxGap = 45 } = {}) {
  let buffer = ''
  let last = 0
  let timer

  function reset() {
    buffer = ''
    clearTimeout(timer)
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return
    const target = event.target
    const typingInField = target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) &&
      !target.hasAttribute('data-scan-input')
    if (typingInField) return

    const now = performance.now()
    if (now - last > maxGap * 3) buffer = ''
    last = now

    if (event.key === 'Enter' || event.key === 'Tab') {
      const code = cleanCode(buffer)
      if (code.length >= minLength) {
        event.preventDefault()
        reset()
        onCode(code, 'pistola')
      }
      reset()
      return
    }
    if (event.key.length === 1) {
      buffer += event.key
      clearTimeout(timer)
      timer = setTimeout(reset, 400)
    }
  }

  window.addEventListener('keydown', onKeyDown, true)
  return () => {
    window.removeEventListener('keydown', onKeyDown, true)
    reset()
  }
}

/**
 * Abre a câmera numa janela e chama onCode a cada código lido.
 * continuous=true mantém a câmera aberta (contagem de vários produtos).
 */
export function openCameraScanner({ onCode, continuous = false, title = 'Ler código pela câmera' }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Este navegador não permite usar a câmera. Use o Chrome ou o Safari atualizados, em https.')
    return
  }

  const { body, close } = openDialog({
    title,
    size: 'md',
    content: `
      <div class="scan-camera">
        <video playsinline muted></video>
        <div class="scan-frame" aria-hidden="true"><span></span></div>
        <p class="scan-status" role="status" aria-live="polite">Abrindo a câmera…</p>
      </div>
      <div class="scan-camera-footer">
        <p class="muted small">Aponte para o código de barras. ${continuous ? 'A câmera continua aberta para você ler vários produtos.' : ''}</p>
        <ul class="scan-camera-log" aria-label="Últimas leituras"></ul>
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-torch hidden>Lanterna</button>
          <button class="btn btn-primary" type="button" data-close>Concluir</button>
        </div>
      </div>`,
    onClose: stop,
  })

  const video = body.querySelector('video')
  const status = body.querySelector('.scan-status')
  const log = body.querySelector('.scan-camera-log')
  let stream
  let stopped = false
  let zxingControls
  let lastCode = ''
  let lastAt = 0

  function stop() {
    stopped = true
    try { zxingControls?.stop() } catch { /* ignore */ }
    stream?.getTracks().forEach((t) => t.stop())
  }

  function handle(raw) {
    const code = cleanCode(raw)
    const now = Date.now()
    if (!code || (code === lastCode && now - lastAt < 1800)) return
    lastCode = code
    lastAt = now
    body.querySelector('.scan-frame').classList.remove('is-hit')
    void body.querySelector('.scan-frame').offsetWidth
    body.querySelector('.scan-frame').classList.add('is-hit')
    const li = document.createElement('li')
    li.innerHTML = `<code>${esc(code)}</code>`
    log.prepend(li)
    while (log.children.length > 4) log.lastChild.remove()
    const result = onCode(code, 'camera')
    if (!continuous && result !== false) {
      stop()
      close()
    }
  }

  ;(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      if (stopped) return stop()
      video.srcObject = stream
      await video.play()

      const track = stream.getVideoTracks()[0]
      if (track?.getCapabilities?.().torch) {
        const torchBtn = body.querySelector('[data-torch]')
        let on = false
        torchBtn.hidden = false
        torchBtn.addEventListener('click', async () => {
          on = !on
          try { await track.applyConstraints({ advanced: [{ torch: on }] }) } catch { /* ignore */ }
          torchBtn.classList.toggle('is-active', on)
        })
      }

      let detector = null
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          const formats = FORMATS.filter((f) => supported.includes(f))
          if (formats.length) detector = new window.BarcodeDetector({ formats })
        } catch { detector = null }
      }

      status.textContent = 'Procurando código…'

      if (detector) {
        const loop = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) handle(codes[0].rawValue)
          } catch { /* quadro ainda não pronto */ }
          setTimeout(loop, 120)
        }
        loop()
      } else {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped) return
        const reader = new BrowserMultiFormatReader()
        // Reaproveita o vídeo já aberto em vez de abrir a câmera de novo.
        zxingControls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) handle(result.getText())
        })
      }
    } catch (error) {
      const denied = error?.name === 'NotAllowedError'
      status.textContent = denied
        ? 'A câmera foi bloqueada. Libere o acesso à câmera nas configurações do navegador.'
        : 'Não foi possível abrir a câmera neste aparelho.'
      status.classList.add('is-error')
    }
  })()

  return { close: () => { stop(); close() } }
}
