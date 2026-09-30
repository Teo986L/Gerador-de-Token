📋 Código exato adicionado ao entry-engine.js

Aqui está o delta completo — só o que foi novo ou substituído, sem o resto do ficheiro. Ordenado pela sequência em que foi adicionado.

---

🔧 DELTA 1 — analisarCorrecaoHistograma (função nova)

Onde vive: entre detectarDivergenciaMacro e getEntryTrigger
FIX: #63 rev3 — detetor de correção real vs reversão

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ FIX #63 rev3 — Detector de CORREÇÃO REAL vs REVERSÃO
// Distingue pullback que retoma a tendência vs falsa correção que a inverte.
// Usa 4 dimensões quantificáveis + limiares numéricos universais.
// ═══════════════════════════════════════════════════════════════════════════

function analisarCorrecaoHistograma(tfKey, trendDirection, mtfManager, PRO_CONFIG) {
  const tfData = getTFData(tfKey, mtfManager, true);
  if (!tfData) return { tipo: 'SEM_DADOS' };

  const hist = tfData.hist;
  const prevHist = tfData.prevHist;
  const rsi = tfData.rsi;
  const adx = tfData.adx;

  // Não está em pullback? É continuação normal
  const isPullback = (trendDirection === 'DOWN' && hist > 0)
                  || (trendDirection === 'UP'   && hist < 0);

  if (!isPullback) {
    return { tipo: 'CONTINUACAO', histograma: hist, rsi, adx };
  }

  // ── DIM 1 — Slope (Δ hist) ──
  const slope = (hist != null && prevHist != null) ? (hist - prevHist) : 0;
  const correcaoAIntensificar = (trendDirection === 'DOWN' && slope > 0)
                             || (trendDirection === 'UP'   && slope < 0);
  const correcaoATerminar     = (trendDirection === 'DOWN' && slope < 0)
                             || (trendDirection === 'UP'   && slope > 0);

  // ── DIM 2 — ADX do trigger ──
  const adxForte = adx >= 25;
  const adxFraco = adx < 18;

  // ── DIM 3 — RSI (profundidade) ──
  const rsiSuperficial = (trendDirection === 'DOWN' && rsi < 50)
                      || (trendDirection === 'UP'   && rsi > 50);
  const rsiModerado    = (trendDirection === 'DOWN' && rsi >= 50 && rsi < 55)
                      || (trendDirection === 'UP'   && rsi > 45 && rsi <= 50);
  const rsiProfundo    = (trendDirection === 'DOWN' && rsi >= 60)
                      || (trendDirection === 'UP'   && rsi <= 40);

  // ── DIM 4 — Alinhamento macro/confirm ──
  const macroTF   = PRO_CONFIG?.macroTF;
  const confirmTF = PRO_CONFIG?.confirmTF;
  const macroData   = macroTF   ? getTFData(macroTF,   mtfManager, true) : null;
  const confirmData = confirmTF ? getTFData(confirmTF, mtfManager, true) : null;

  const macroNaTendencia = macroData && (
       (trendDirection === 'DOWN' && macroData.hist < 0)
    || (trendDirection === 'UP'   && macroData.hist > 0)
  );
  const confirmNaTendencia = confirmData && (
       (trendDirection === 'DOWN' && confirmData.hist < 0)
    || (trendDirection === 'UP'   && confirmData.hist > 0)
  );

  // ── Pontuação ponderada ──
  let pontosCorrecao = 0;
  let pontosReversao = 0;
  const razoesCorrecao = [];
  const razoesReversao = [];

  if (correcaoATerminar) {
    pontosCorrecao += 30;
    razoesCorrecao.push('slope a terminar');
  }
  if (correcaoAIntensificar) {
    pontosReversao += 30;
    razoesReversao.push('slope a intensificar');
  }
  if (adxForte) {
    pontosCorrecao += 25;
    razoesCorrecao.push(`ADX ${adx.toFixed(0)} forte`);
  }
  if (adxFraco) {
    pontosReversao += 20;
    razoesReversao.push(`ADX ${adx.toFixed(0)} fraco`);
  }
  if (rsiSuperficial) {
    pontosCorrecao += 25;
    razoesCorrecao.push(`RSI ${rsi.toFixed(0)} superficial`);
  } else if (rsiModerado) {
    pontosCorrecao += 10;
    razoesCorrecao.push(`RSI ${rsi.toFixed(0)} moderado`);
  } else if (rsiProfundo) {
    pontosReversao += 30;
    razoesReversao.push(`RSI ${rsi.toFixed(0)} profundo`);
  }
  if (macroNaTendencia) {
    pontosCorrecao += 20;
    razoesCorrecao.push(`${macroTF} ainda na tendência`);
  } else if (macroData) {
    pontosReversao += 25;
    razoesReversao.push(`${macroTF} já virou`);
  }
  if (confirmNaTendencia) {
    pontosCorrecao += 15;
    razoesCorrecao.push(`${confirmTF} ainda na tendência`);
  } else if (confirmData) {
    pontosReversao += 20;
    razoesReversao.push(`${confirmTF} já virou`);
  }

  // ── Classificação ──
  let tipo = 'INDEFINIDO';
  if (pontosCorrecao >= 60 && pontosCorrecao > pontosReversao + 15) {
    tipo = 'CORRECAO_REAL';
  } else if (pontosReversao >= 55 && pontosReversao > pontosCorrecao + 10) {
    tipo = 'REVERSAO';
  }

  return {
    tipo,
    histograma: hist,
    prevHist,
    slope,
    rsi,
    adx,
    correcaoAIntensificar,
    correcaoATerminar,
    macroNaTendencia,
    confirmNaTendencia,
    pontosCorrecao,
    pontosReversao,
    razoesCorrecao,
    razoesReversao,
    mensagem: `${tfKey}: ${tipo} — correção ${pontosCorrecao}pts | reversão ${pontosReversao}pts — ${(tipo === 'REVERSAO' ? razoesReversao : razoesCorrecao).join(', ')}`
  };
}
```

---

🔧 DELTA 2 — Bloco em getEntryTrigger (substituição)

Onde vive: dentro de getEntryTrigger, no else final do bloco do pullback
FIX: #63 rev3 — usa a função do delta 1 para classificar correções

Antes (código original):

```javascript
  } else {
    if (trendDirection === 'UP' && hist !== null && hist < 0) {
      return { ok: false, reason: `${triggerTF} em pullback — histograma ainda negativo (${hist.toFixed(4)}) — aguarda flip para CALL`, triggerTF, pullback: true };
    }
    if (trendDirection === 'DOWN' && hist !== null && hist > 0) {
      return { ok: false, reason: `${triggerTF} em pullback — histograma ainda positivo (${hist.toFixed(4)}) — aguarda flip para PUT`, triggerTF, pullback: true };
    }
  }
```

Depois (com FIX #63 rev3):

```javascript
  } else {
    // ⭐ FIX #63 rev3 — usa o detector de correção vs reversão
    if ((trendDirection === 'UP' && hist !== null && hist < 0) ||
        (trendDirection === 'DOWN' && hist !== null && hist > 0)) {

      const analiseCorr = analisarCorrecaoHistograma(triggerTF, trendDirection, mtfManager, PRO_CONFIG);

      if (analiseCorr.tipo === 'REVERSAO') {
        console.log(`🔄 [FIX #63 rev3] ${analiseCorr.mensagem}`);
        return {
          ok: false,
          reason: `${triggerTF} em REVERSÃO — ${analiseCorr.mensagem}`,
          triggerTF,
          reversao: true,
          analiseCorrecao: analiseCorr
        };
      }

      // CORRECAO_REAL ou INDEFINIDO → aguarda flip (comportamento anterior)
      const histSinal = hist > 0 ? 'positivo' : 'negativo';
      const flipAlvo = trendDirection === 'DOWN' ? 'PUT' : 'CALL';
      return {
        ok: false,
        reason: `${triggerTF} em pullback (${histSinal}, ${analiseCorr.tipo}) — histograma ${hist.toFixed(4)} — aguarda flip para ${flipAlvo}`,
        triggerTF,
        pullback: true,
        analiseCorrecao: analiseCorr
      };
    }
  }
```

---

🔧 DELTA 3 — resolveSignal (substituição completa)

Onde vive: função resolveSignal inteira
FIX: #63 rev + rev2 + rev4 combinados

Antes (original):

```javascript
function resolveSignal(trendState, structureState, entryState, mode) {
  if (trendState.direction === 'NEUTRAL') {
    return { signal: 'HOLD', strength: 'NONE' };
  }

  const PRO_CONFIG = require('./config').PRO_ENGINE.MODES[mode];
  const reqAlign = PRO_CONFIG?.REQUIRE_ALIGNMENT
    || { 'SNIPER': 3, 'CAÇADOR': 3, 'PESCADOR': 3, 'BALEEIRO': 3 }[mode]
    || 3;

  let alignCount = 0;
  if (trendState.aligned) alignCount += 2;
  if (structureState.active && structureState.type !== 'NEUTRAL') alignCount += 1;
  if (entryState.ok) alignCount += 1;

  if (alignCount >= reqAlign) {
    return { signal: trendState.direction === 'UP' ? 'CALL' : 'PUT', strength: 'STRONG' };
  }
  if (entryState.ok && structureState.type === 'PULLBACK') {
    return { signal: trendState.direction === 'UP' ? 'CALL' : 'PUT', strength: 'WEAK' };
  }
  return { signal: 'HOLD', strength: 'NONE' };
}
```

Depois (com FIX #63 rev + rev2 + rev4):

```javascript
function resolveSignal(trendState, structureState, entryState, mode) {
  // ⭐ FIX #1e — NEUTRAL nunca gera sinal
  if (trendState.direction === 'NEUTRAL') {
    return { signal: 'HOLD', strength: 'NONE' };
  }

  const reason = entryState?.reason || '';

  // ═══════════════════════════════════════════════════════════════════
  // TRAVA 1 (FIX #63 rev) — Trigger EXPLICITAMENTE contra a direção
  // ═══════════════════════════════════════════════════════════════════
  const triggerContra =
       (trendState.direction === 'DOWN' && /direção=UP/i.test(reason))
    || (trendState.direction === 'UP'   && /direção=DOWN/i.test(reason))
    || /contra tendência/i.test(reason);

  if (triggerContra) {
    console.log(`⛔ [FIX #63 rev] resolveSignal bloqueado — trigger TF contra a direção (${reason})`);
    return { signal: 'HOLD', strength: 'NONE' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRAVA 2 (FIX #63 rev2) — Trigger em PULLBACK à espera de flip
  // ═══════════════════════════════════════════════════════════════════
  const triggerEsperaFlip =
       entryState?.pullback === true
    || /aguarda flip/i.test(reason)
    || (trendState.direction === 'DOWN' && /histograma ainda positivo/i.test(reason))
    || (trendState.direction === 'UP'   && /histograma ainda negativo/i.test(reason))
    || /em pullback \(/i.test(reason)
    || /em REVERSÃO/i.test(reason);

  if (triggerEsperaFlip) {
    console.log(`⏸️ [FIX #63 rev2] resolveSignal suspende — trigger aguarda flip do histograma (${reason})`);
    return { signal: 'HOLD', strength: 'NONE' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRAVA 3 (FIX #63 rev4) — Trigger AMBÍGUO (sem condições / NEUTRAL)
  // ═══════════════════════════════════════════════════════════════════
  const triggerAmbiguo =
       /sem condições de entrada/i.test(reason)
    || /NEUTRAL — sem direção/i.test(reason);

  if (triggerAmbiguo) {
    console.log(`⏸️ [FIX #63 rev4] resolveSignal suspende — trigger ambíguo/sem direção (${reason})`);
    return { signal: 'HOLD', strength: 'NONE' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // LÓGICA NORMAL (inalterada)
  // ═══════════════════════════════════════════════════════════════════
  const PRO_CONFIG = require('./config').PRO_ENGINE.MODES[mode];
  const reqAlign = PRO_CONFIG?.REQUIRE_ALIGNMENT
    || { 'SNIPER': 3, 'CAÇADOR': 3, 'PESCADOR': 3, 'BALEEIRO': 3 }[mode]
    || 3;

  let alignCount = 0;
  if (trendState.aligned) alignCount += 2;
  if (structureState.active && structureState.type !== 'NEUTRAL') alignCount += 1;
  if (entryState.ok) alignCount += 1;

  if (alignCount >= reqAlign) {
    return { signal: trendState.direction === 'UP' ? 'CALL' : 'PUT', strength: 'STRONG' };
  }
  if (entryState.ok && structureState.type === 'PULLBACK') {
    return { signal: trendState.direction === 'UP' ? 'CALL' : 'PUT', strength: 'WEAK' };
  }
  return { signal: 'HOLD', strength: 'NONE' };
}
```

---

🔧 DELTA 4 — calcularParametrosRiscoDinamicos (substituição)

Onde vive: função inteira
FIX: #55 rev — margem + R:R mode-aware

Antes (original):

```javascript
function calcularParametrosRiscoDinamicos(tipoAtivo, motorScore, motorZona) {
  const MARGEM_BASE = {
    'forex':            0.0015,
    'indice_normal':    0.0025,
    'commodity':        0.0030,
    'step_index':       0.0030,
    'volatility_index': 0.0035,
    'criptomoeda':      0.0045,
    'boom_index':       0.0080,
    'crash_index':      0.0080,
    'jump_index':       0.0080
  };
  // ... resto com margem única por tipo de ativo
}
```

Depois (com FIX #55 rev):

```javascript
function calcularParametrosRiscoDinamicos(tipoAtivo, motorScore, motorZona, mode = 'CAÇADOR') {

  const MARGEM_BASE_POR_MODO = {
    'SNIPER': {
      'forex': 0.0006, 'indice_normal': 0.0008, 'commodity': 0.0010,
      'step_index': 0.0010, 'volatility_index': 0.0012, 'criptomoeda': 0.0015,
      'boom_index': 0.0030, 'crash_index': 0.0030, 'jump_index': 0.0030
    },
    'CAÇADOR': {
      'forex': 0.0010, 'indice_normal': 0.0014, 'commodity': 0.0016,
      'step_index': 0.0014, 'volatility_index': 0.0018, 'criptomoeda': 0.0022,
      'boom_index': 0.0050, 'crash_index': 0.0050, 'jump_index': 0.0050
    },
    'PESCADOR': {
      'forex': 0.0020, 'indice_normal': 0.0030, 'commodity': 0.0035,
      'step_index': 0.0030, 'volatility_index': 0.0040, 'criptomoeda': 0.0050,
      'boom_index': 0.0090, 'crash_index': 0.0090, 'jump_index': 0.0090
    },
    'BALEEIRO': {
      'forex': 0.0040, 'indice_normal': 0.0060, 'commodity': 0.0070,
      'step_index': 0.0060, 'volatility_index': 0.0080, 'criptomoeda': 0.0100,
      'boom_index': 0.0150, 'crash_index': 0.0150, 'jump_index': 0.0150
    }
  };

  const tabelaModo = MARGEM_BASE_POR_MODO[mode] || MARGEM_BASE_POR_MODO['CAÇADOR'];
  const margemBase = tabelaModo[tipoAtivo] ?? tabelaModo['indice_normal'];

  let scoreFactor;
  if (motorScore >= 90)      scoreFactor = 1.25;
  else if (motorScore >= 80) scoreFactor = 1.18;
  else if (motorScore >= 70) scoreFactor = 1.10;
  else if (motorScore >= 60) scoreFactor = 1.03;
  else if (motorScore >= 50) scoreFactor = 1.00;
  else if (motorScore >= 40) scoreFactor = 0.92;
  else                       scoreFactor = 0.85;

  const margemMin = margemBase * 0.70;
  const margemMax = margemBase * 1.30;
  const margem = Math.max(margemMin, Math.min(margemMax, margemBase * scoreFactor));

  const R_R_POR_MODO = {
    'SNIPER':   { base: 1.5, max: 2.0 },
    'CAÇADOR':  { base: 1.7, max: 2.3 },
    'PESCADOR': { base: 2.0, max: 2.8 },
    'BALEEIRO': { base: 2.2, max: 3.2 }
  };
  const rr = R_R_POR_MODO[mode] || R_R_POR_MODO['CAÇADOR'];

  const isPulso = ['boom_index','crash_index','jump_index'].includes(tipoAtivo);

  let riscoMult;
  if (motorScore >= 80)      riscoMult = rr.max;
  else if (motorScore >= 70) riscoMult = rr.base + (rr.max - rr.base) * 0.75;
  else if (motorScore >= 60) riscoMult = rr.base + (rr.max - rr.base) * 0.5;
  else if (motorScore >= 50) riscoMult = rr.base + (rr.max - rr.base) * 0.25;
  else                       riscoMult = rr.base;

  if (isPulso) riscoMult = Math.max(1.4, riscoMult * 0.75);

  return {
    margem: parseFloat(margem.toFixed(6)),
    riscoMult: parseFloat(riscoMult.toFixed(2)),
    margemBase: parseFloat(margemBase.toFixed(6)),
    scoreFactor: parseFloat(scoreFactor.toFixed(3)),
    isPulso,
    mode
  };
}
```

---

🔧 DELTA 5 — calcularStopTakePorModo (2 linhas alteradas)

Onde vive: dentro de calcularStopTakePorModo

Linha 1 — chamada da função de parâmetros:

```javascript
// ANTES:
const params = calcularParametrosRiscoDinamicos(tipoAtivo, motorScore, motorZona);

// DEPOIS:
const params = calcularParametrosRiscoDinamicos(tipoAtivo, motorScore, motorZona, mode);
```

Linha 2 — mensagem do log:

```javascript
// ANTES:
console.log(`📏 [FIX #55] ${tipoAtivo} | score=${motorScore} zona=${motorZona} → margem=... | R:R=1:${riscoMult}`);

// DEPOIS:
console.log(`📏 [FIX #55 rev] ${mode} | ${tipoAtivo} | score=${motorScore} zona=${motorZona} → margem=... | R:R=1:${riscoMult}`);
```

---

🔧 DELTA 6 — module.exports (1 linha nova)

Onde vive: no final do ficheiro

```javascript
module.exports = {
  // ... (todos os exports existentes) ...

  // ⭐ FIX #63 rev3 — NOVO
  analisarCorrecaoHistograma,

  // ... (restantes exports) ...
};
```

---

📊 Resumo do que foi tocado

Delta Função Tipo FIX
1 analisarCorrecaoHistograma NOVA #63 rev3
2 getEntryTrigger (bloco else final) Substituição #63 rev3
3 resolveSignal Substituição total #63 rev + rev2 + rev4
4 calcularParametrosRiscoDinamicos Substituição total #55 rev
5 calcularStopTakePorModo (2 linhas) Ajuste #55 rev
6 module.exports +1 linha #63 rev3

---

🚨 O que NÃO foi alterado

· getTrendState
· getStructureState
· detectarReversaoTendencia
· validarPerdendoForca
· detectarDivergenciaMacro
· getMicroTiming
· detectarPontoInflexao
· detectarRespiracao
· calcularPenalizacaoDemarkerExtremo
· calcularPenalizacaoDemarkerMultiTF
· calcularFatorNearExtreme
· calcularSubScoreTF
· calcularScorePonderadoPorTF
· calcularContextoMagnitude
· detectarAceleracaoSpread
· calcularPontoFranco
· buildTimingResult / calcularTiming*
· calcularAnaliseManualMN1 / calcularFallbackBasico

---

Analisa os 6 deltas e diz-me se queres avançar com o envio dos outros ficheiros (config.js, analyze-handler.js, multi-timeframe-manager.js) para eu fazer a análise profunda que pediste. 🎯
