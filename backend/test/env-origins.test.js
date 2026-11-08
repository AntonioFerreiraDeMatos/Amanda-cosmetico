const test = require('node:test');
const assert = require('node:assert');
const { allowedOrigins } = require('../src/config/env');

test('domínios oficiais com e sem www continuam permitidos com FRONTEND_URL definido', () => {
    const prev = { env: process.env.NODE_ENV, url: process.env.FRONTEND_URL };
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://amandacosmeticos.com.br,https://extra.example';
    try {
        const origins = allowedOrigins();
        assert.ok(origins.includes('https://www.amandacosmeticos.com.br'));
        assert.ok(origins.includes('https://amandacosmeticos.com.br'));
        assert.ok(origins.includes('https://extra.example'));
        assert.ok(!origins.includes('http://localhost:5173'));
    } finally {
        process.env.NODE_ENV = prev.env;
        if (prev.url === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev.url;
    }
});
