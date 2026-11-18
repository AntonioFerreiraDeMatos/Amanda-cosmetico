// Pasta das imagens dos produtos.
//
// Na Hostinger cada publicação cria uma pasta nova para o código ("versions/...").
// Se as fotos ficassem dentro dela, toda atualização da API apagaria as imagens.
// Por isso, em produção, elas ficam numa pasta fixa na home da hospedagem.
// Ordem: UPLOADS_DIR (se configurada) → produção: ~/amanda-cosmeticos-uploads
// → desenvolvimento: backend/uploads.

const fs = require('fs');
const os = require('os');
const path = require('path');

const pastaDoCodigo = path.resolve(__dirname, '../../uploads');

function escolherPasta() {
    if (process.env.UPLOADS_DIR) return path.resolve(process.env.UPLOADS_DIR);
    if (process.env.NODE_ENV === 'production') {
        // Na Hostinger o HOME do Node aponta para .../domains/<site>/public_html,
        // que é apagado a cada publicação do site. Usamos a raiz da conta (/home/<usuário>).
        const home = os.homedir();
        const raizConta = home.match(/^\/home\/[^/]+/)?.[0] || home;
        return path.join(raizConta, 'amanda-cosmeticos-uploads');
    }
    return pastaDoCodigo;
}

const UPLOADS_ROOT = escolherPasta();
const PRODUTOS_DIR = path.join(UPLOADS_ROOT, 'produtos');

fs.mkdirSync(PRODUTOS_DIR, { recursive: true });

// Leva para a pasta fixa as imagens que vieram junto do código (sem sobrescrever).
if (UPLOADS_ROOT !== pastaDoCodigo) {
    const origem = path.join(pastaDoCodigo, 'produtos');
    try {
        for (const nome of fs.readdirSync(origem)) {
            if (nome.startsWith('.')) continue;
            const destino = path.join(PRODUTOS_DIR, nome);
            if (!fs.existsSync(destino)) fs.copyFileSync(path.join(origem, nome), destino);
        }
    } catch {
        // Sem imagens no pacote: nada a copiar.
    }
}

// Recria a pasta se ela tiver sido apagada com o servidor ligado.
function garantirPastaProdutos() {
    fs.mkdirSync(PRODUTOS_DIR, { recursive: true });
    return PRODUTOS_DIR;
}

module.exports = { UPLOADS_ROOT, PRODUTOS_DIR, garantirPastaProdutos };
