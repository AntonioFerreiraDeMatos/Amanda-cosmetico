/**
 * Períodos de relatório no fuso da loja.
 *
 * A conexão com o banco usa UTC (ver config/database.js). As datas
 * escolhidas no painel (dd/mm/aaaa, horário de Brasília) são convertidas
 * aqui em limites UTC, e os agrupamentos por dia somam o deslocamento
 * do fuso antes de extrair a data.
 */
const DEFAULT_OFFSET = '-03:00';
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

function storeOffset() {
    const value = String(process.env.STORE_UTC_OFFSET || DEFAULT_OFFSET).trim();
    return /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value) ? value : DEFAULT_OFFSET;
}

function offsetMinutes() {
    const [, sign, hours, minutes] = storeOffset().match(/^([+-])(\d{2}):(\d{2})$/);
    const total = Number(hours) * 60 + Number(minutes);
    return sign === '-' ? -total : total;
}

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(dateText, days) {
    const date = new Date(`${dateText}T00:00:00.000Z`);
    return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(start, end) {
    return Math.round(
        (new Date(`${end}T00:00:00.000Z`) - new Date(`${start}T00:00:00.000Z`)) / DAY_MS
    ) + 1;
}

function todayInStore(now = new Date()) {
    return new Date(now.getTime() + offsetMinutes() * 60000).toISOString().slice(0, 10);
}

/** Início do dia local (00:00 no fuso da loja) como texto UTC para o MySQL. */
function startOfDayUtc(dateText) {
    const instant = new Date(`${dateText}T00:00:00.000${storeOffset()}`);
    return instant.toISOString().slice(0, 19).replace('T', ' ');
}

/** Texto UTC "YYYY-MM-DD HH:MM:SS" para um instante JS. */
function toUtcSql(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function rangeFor(start, end) {
    return {
        inicio: start,
        fim: end,
        dias: daysBetween(start, end),
        inicioUtc: startOfDayUtc(start),
        fimExclusivoUtc: startOfDayUtc(addDays(end, 1))
    };
}

/**
 * Interpreta ?periodo=7|30|90|personalizado&inicio=YYYY-MM-DD&fim=YYYY-MM-DD.
 * Retorna { erro } quando os filtros são inválidos.
 */
function resolverPeriodo(query = {}, { padrao = '30', now = new Date() } = {}) {
    const periodo = typeof query.periodo === 'string' && query.periodo
        ? query.periodo
        : (query.inicio || query.fim ? 'personalizado' : padrao);
    const hoje = todayInStore(now);
    let inicio;
    let fim;

    if (['7', '30', '90'].includes(periodo)) {
        fim = hoje;
        inicio = addDays(hoje, -(Number(periodo) - 1));
    } else if (periodo === 'personalizado') {
        inicio = query.inicio;
        fim = query.fim;
        if (!isValidDate(inicio) || !isValidDate(fim)) {
            return { erro: 'Informe as datas inicial e final do período.' };
        }
        if (inicio > fim) {
            return { erro: 'A data inicial precisa ser anterior ou igual à final.' };
        }
        if (daysBetween(inicio, fim) > MAX_DAYS) {
            return { erro: `O período pode ter no máximo ${MAX_DAYS} dias.` };
        }
    } else {
        return { erro: 'Período inválido. Use 7, 30, 90 ou personalizado.' };
    }

    const atual = rangeFor(inicio, fim);
    const fimAnterior = addDays(inicio, -1);
    const inicioAnterior = addDays(fimAnterior, -(atual.dias - 1));

    return {
        periodo,
        atual,
        anterior: rangeFor(inicioAnterior, fimAnterior)
    };
}

/** Lista de datas (YYYY-MM-DD) entre início e fim, inclusive. */
function listarDias(start, end) {
    const days = [];
    for (let current = start; current <= end; current = addDays(current, 1)) {
        days.push(current);
    }
    return days;
}

/** Converte um valor de data do banco em YYYY-MM-DD (o banco já devolve a data local). */
function dateKey(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || '').slice(0, 10);
}

function pad(value) {
    return String(value).padStart(2, '0');
}

/** Formata um instante como dd/mm/aaaa HH:mm no fuso da loja. */
function formatarDataHora(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const local = new Date(date.getTime() + offsetMinutes() * 60000);
    return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

function formatarData(value) {
    return formatarDataHora(value).slice(0, 10);
}

module.exports = {
    storeOffset,
    offsetMinutes,
    isValidDate,
    addDays,
    daysBetween,
    todayInStore,
    startOfDayUtc,
    toUtcSql,
    resolverPeriodo,
    listarDias,
    dateKey,
    formatarDataHora,
    formatarData
};
