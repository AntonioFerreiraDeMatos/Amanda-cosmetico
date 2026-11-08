import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOrderMessage,
  createWhatsAppOrderUrl,
} from '../src/order-message.js'

test('formats a complete, readable order message using server-calculated values', () => {
  const message = buildOrderMessage({
    order: {
      id: 1,
      numero_exibicao: 'AM-000001',
      numero_pedido: 'AM-20261101-123456',
      criado_em: '2026-11-01T14:30:00-03:00',
      total: 49.8,
    },
    items: [
      {
        nome_produto: 'Hidratante Corporal',
        quantidade: 2,
        preco_unitario: 24.9,
        subtotal: 49.8,
      },
    ],
    address: {
      nome_destinatario: 'Cliente Teste',
      telefone: '85999999999',
      rua: 'Rua de Teste',
      numero: '35',
      complemento: 'Apto 2',
      bairro: 'Barra do Ceará',
      cidade: 'Fortaleza',
      estado: 'CE',
      cep: '60331020',
    },
  })

  assert.match(message, /AM-000001/)
  assert.match(message, /Data: 01\/11\/2026/)
  assert.match(message, /Hidratante Corporal/)
  assert.match(message, /Quantidade: 2 x R\$\s*24,90/)
  assert.match(message, /Subtotal: R\$\s*49,80/)
  assert.match(message, /Nome do cliente: Cliente Teste/)
  assert.match(message, /Endereço: Rua de Teste, 35/)
  assert.match(message, /CEP: 60331020/)
  assert.match(message, /TOTAL DOS PRODUTOS: R\$\s*49,80/)
  assert.match(message, /Frete: a confirmar.*não incluído/)
  assert.match(message, /Total final com frete: será informado após a cotação/)
  assert.match(message, /Pagamento Pix: aguardando confirmação/)

  const url = new URL(createWhatsAppOrderUrl(message))
  assert.equal(url.origin + url.pathname, 'https://wa.me/558586180449')
  assert.equal(url.searchParams.get('text'), message)
})

test('includes the payment status and opens the confirmed business WhatsApp number', () => {
  const message = buildOrderMessage({
    order: { numero_pedido: 'AM-123', total: 25 },
    items: [{
      nome_produto: 'Sérum',
      quantidade: 1,
      preco_unitario: 25,
      subtotal: 25,
    }],
    address: { nome_destinatario: 'Amanda Teste', telefone: '85999999999' },
    payment: { status: 'aprovado', valor: 25 },
  })

  assert.match(message, /Nome do cliente: Amanda Teste/)
  assert.match(message, /Pagamento Pix: aprovado pela loja/)
  assert.match(message, /Valor Pix registrado: R\$\s*25,00/)
  assert.throws(
    () => createWhatsAppOrderUrl(message, 'not-a-phone'),
    /número comercial/
  )
})

test('rejects invalid item data instead of composing an incomplete order', () => {
  assert.throws(() => buildOrderMessage({
    order: { numero_pedido: 'AM-123', total: 10 },
    items: [{
      nome_produto: '',
      quantidade: 1,
      preco_unitario: 10,
      subtotal: 10,
    }],
    address: {},
  }), /item inválido/)
})
