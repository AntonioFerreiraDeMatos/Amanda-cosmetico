export const WHATSAPP_BUSINESS_NUMBER = '558586180449'

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function formatOrderNumber(order) {
  return cleanText(order?.numero_exibicao || order?.numero_pedido)
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function buildOrderMessage({
  order,
  items,
  address,
  customer = {},
  payment = {},
}) {
  const customerName = cleanText(customer.nome) || cleanText(address.nome_destinatario)
  const recipient = cleanText(address.nome_destinatario)
  const phone = cleanText(address.telefone) || cleanText(customer.telefone)
  const accountPhone = cleanText(customer.telefone)
  const street = [cleanText(address.rua), cleanText(address.numero)]
    .filter(Boolean)
    .join(', ')
  const complement = cleanText(address.complemento)
  const neighborhood = cleanText(address.bairro)
  const city = [cleanText(address.cidade), cleanText(address.estado)]
    .filter(Boolean)
    .join(' - ')
  const postalCode = cleanText(address.cep)
  const itemLines = items.map((item, index) => {
    const name = cleanText(item.nome_produto)
    const quantity = Number(item.quantidade)
    const unitPrice = Number(item.preco_unitario)
    const subtotal = Number(item.subtotal)

    if (
      !name ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      !Number.isFinite(subtotal)
    ) {
      throw new Error('A API retornou um item inválido no pedido.')
    }

    return [
      `${index + 1}. ${name}`,
      `   Quantidade: ${quantity} x ${formatCurrency(unitPrice)}`,
      `   Subtotal: ${formatCurrency(subtotal)}`,
    ].join('\n')
  })
  const total = Number(order.total)

  if (!Number.isFinite(total) || total < 0) {
    throw new Error('A API retornou um total inválido para o pedido.')
  }

  const deliveryLines = [
    customerName && `Nome do cliente: ${customerName}`,
    recipient && recipient !== customerName && `Destinatário: ${recipient}`,
    phone && `WhatsApp: ${phone}`,
    accountPhone && accountPhone !== phone && `Telefone cadastrado: ${accountPhone}`,
    street && `Endereço: ${street}`,
    complement && `Complemento: ${complement}`,
    neighborhood && `Bairro: ${neighborhood}`,
    city && `Cidade/UF: ${city}`,
    postalCode && `CEP: ${postalCode}`,
  ].filter(Boolean)

  const paymentStatus = cleanText(payment.status || 'pendente')
  const paymentStatusLabel = {
    pendente: 'aguardando confirmação do recebimento',
    aprovado: 'aprovado pela loja',
    processando: 'em processamento',
    recusado: 'recusado',
    cancelado: 'cancelado',
    estornado: 'estornado',
  }[paymentStatus] || paymentStatus
  const paymentValue = Number(payment.valor ?? total)
  if (!Number.isFinite(paymentValue) || paymentValue < 0) {
    throw new Error('A API retornou um valor inválido para o pagamento Pix.')
  }

  return [
    'Olá, Amanda! Fiz um pedido na loja Amanda Cosméticos.',
    '',
    formatOrderNumber(order),
    ...(order.criado_em
      ? [`Data: ${new Date(order.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`]
      : []),
    '',
    'CLIENTE E ENTREGA',
    ...(deliveryLines.length ? deliveryLines : ['Dados de contato/entrega não informados.']),
    '',
    'PRODUTOS',
    ...itemLines,
    '',
    `TOTAL DOS PRODUTOS: ${formatCurrency(total)}`,
    'Frete: a confirmar pelo WhatsApp (não incluído no Pix).',
    'Total final com frete: será informado após a cotação.',
    `Pagamento Pix: ${paymentStatusLabel}.`,
    `Valor Pix registrado: ${formatCurrency(paymentValue)}.`,
  ].join('\n')
}

export function createWhatsAppOrderUrl(message, phone = WHATSAPP_BUSINESS_NUMBER) {
  const number = String(phone || '').replace(/\D/g, '')
  if (!/^\d{10,15}$/.test(number)) {
    throw new Error('O número comercial do WhatsApp não está configurado corretamente.')
  }

  const url = new URL(`https://wa.me/${number}`)
  url.searchParams.set('text', message)
  return url.toString()
}
