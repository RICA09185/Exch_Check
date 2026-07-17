/**
 * 환율 판단 서비스 (Exchange Rate Judgment Service) MVP
 * Frankfurter API v2 / v1 Fallback 수신 구조 적용
 */

// State Store
let appState = {
  base: 'USD',
  target: 'KRW',
  targetRate: null,
  latestRateData: null,
  historicalData: {} // Period mapped data
};

// DOM Elements
const elements = {
  baseCurrencySelect: document.getElementById('baseCurrency'),
  targetCurrencySelect: document.getElementById('targetCurrency'),
  swapCurrencyBtn: document.getElementById('swapCurrencyBtn'),
  errorContainer: document.getElementById('errorContainer'),
  currencyPairLabel: document.getElementById('currencyPairLabel'),
  lastUpdatedTime: document.getElementById('lastUpdatedTime'),
  currentRateValue: document.getElementById('currentRateValue'),
  currentRateUnit: document.getElementById('currentRateUnit'),
  currentRateStatement: document.getElementById('currentRateStatement'),
  judgementCard: document.getElementById('judgementCard'),
  judgementLabel: document.getElementById('judgementLabel'),
  judgementMessage: document.getElementById('judgementMessage'),
  avgComparisonGrid: document.getElementById('avgComparisonGrid'),
  targetRateInput: document.getElementById('targetRateInput'),
  targetInputUnit: document.getElementById('targetInputUnit'),
  targetComparisonResult: document.getElementById('targetComparisonResult'),
  rateChartCanvas: document.getElementById('rateChart'),
  debugInfoBox: document.getElementById('debugInfoBox')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  loadFromLocalStorage();
  
  // Set initial select values
  elements.baseCurrencySelect.value = appState.base;
  elements.targetCurrencySelect.value = appState.target;
  if (appState.targetRate) {
    elements.targetRateInput.value = appState.targetRate;
  }
  
  updateUnitLabels();

  // Event Listeners
  elements.baseCurrencySelect.addEventListener('change', (e) => {
    appState.base = e.target.value;
    onCurrencyChange();
  });

  elements.targetCurrencySelect.addEventListener('change', (e) => {
    appState.target = e.target.value;
    onCurrencyChange();
  });

  elements.swapCurrencyBtn.addEventListener('click', () => {
    const temp = appState.base;
    appState.base = appState.target;
    appState.target = temp;
    
    elements.baseCurrencySelect.value = appState.base;
    elements.targetCurrencySelect.value = appState.target;
    onCurrencyChange();
  });

  elements.targetRateInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    appState.targetRate = isNaN(val) ? null : val;
    saveToLocalStorage(appState);
    if (appState.latestRateData) {
      renderTargetComparison(appState.latestRateData.rate, appState.targetRate);
    }
  });

  window.addEventListener('resize', debounce(() => {
    if (appState.historicalData['1Y'] && appState.historicalData['1Y'].length > 0 && appState.latestRateData) {
      const rates = appState.historicalData['1Y'];
      const avg = calculateAverage(rates);
      drawChart(elements.rateChartCanvas, rates, avg);
    }
  }, 200));

  // Initial load
  loadExchangeData();
}

function updateUnitLabels() {
  elements.currentRateUnit.textContent = appState.target;
  elements.targetInputUnit.textContent = appState.target;
}

function onCurrencyChange() {
  if (appState.base === appState.target) {
    showError("기준 통화와 대상 통화는 다르게 선택해주세요.");
    return;
  }
  hideError();
  updateUnitLabels();
  saveToLocalStorage(appState);
  loadExchangeData();
}

/**
 * 2. fetchCurrentRate(base, target) - Fallback 구조 (Requirement 1 & 2)
 */
async function fetchCurrentRate(base, target) {
  if (base === target) {
    return {
      rate: 1.0,
      date: new Date().toISOString().slice(0, 10),
      sourceUrl: 'self'
    };
  }

  const urls = [
    `https://api.frankfurter.dev/v2/rate/${base}/${target}`,
    `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${target}`,
    `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      console.log("API success:", url, data);

      const parsed = parseRateResponse(data, target);

      if (parsed && parsed.rate && parsed.rate > 0) {
        return {
          rate: parsed.rate,
          date: parsed.date,
          sourceUrl: url
        };
      }
    } catch (error) {
      console.error("API failed:", url, error);
    }
  }

  throw new Error("All exchange rate APIs failed");
}

/**
 * 3. parseRateResponse(data, target) (Requirement 3 & 4)
 */
function parseRateResponse(data, target) {
  if (!data) return null;

  // Frankfurter v2 /rate/USD/KRW 형태
  if (typeof data.rate === "number") {
    return {
      rate: data.rate,
      date: data.date || data.updated_at || new Date().toISOString().slice(0, 10)
    };
  }

  // Frankfurter v2 /rates 또는 v1 /latest 형태
  if (data.rates && typeof data.rates[target] === "number") {
    return {
      rate: data.rates[target],
      date: data.date || new Date().toISOString().slice(0, 10)
    };
  }

  return null;
}

/**
 * Historical rates fetch with Fallback
 */
async function fetchHistoricalRates(base, target, period) {
  if (base === target) {
    return [{ date: new Date().toISOString().slice(0, 10), rate: 1.0 }];
  }

  const periodDays = {
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730,
    '3Y': 1095
  };

  const days = periodDays[period] || 365;
  const toDateObj = new Date();
  const fromDateObj = new Date();
  fromDateObj.setDate(fromDateObj.getDate() - days);

  const toDateStr = toDateObj.toISOString().slice(0, 10);
  const fromDateStr = fromDateObj.toISOString().slice(0, 10);

  const urls = [
    `https://api.frankfurter.dev/v2/rates?from=${fromDateStr}&to=${toDateStr}&base=${base}&quotes=${target}`,
    `https://api.frankfurter.dev/v1/${fromDateStr}..${toDateStr}?base=${base}&symbols=${target}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();

      const ratesList = [];
      if (data && data.rates) {
        const sortedDates = Object.keys(data.rates).sort();
        sortedDates.forEach(dateStr => {
          const dayData = data.rates[dateStr];
          if (dayData && typeof dayData[target] === 'number' && !isNaN(dayData[target]) && dayData[target] > 0) {
            ratesList.push({
              date: dateStr,
              rate: dayData[target]
            });
          }
        });
      }

      if (ratesList.length > 0) {
        return ratesList;
      }
    } catch (e) {
      console.warn(`Historical fetch failed for ${url}:`, e);
    }
  }

  throw new Error(`Historical rate fetch failed for ${period}`);
}

/**
 * Helper calculation functions
 */
function calculateAverage(rates) {
  if (!rates || rates.length === 0) return 0;
  const values = rates.map(r => typeof r === 'number' ? r : r.rate);
  const sum = values.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / values.length).toFixed(2));
}

function calculatePercentDiff(current, average) {
  if (!average || average === 0) return 0;
  const diff = ((current - average) / average) * 100;
  return parseFloat(diff.toFixed(2));
}

function getJudgement(percentDiff) {
  if (percentDiff <= -3) {
    return {
      label: "저렴한 편",
      message: "최근 1년 평균보다 저렴한 편입니다.",
      type: "positive"
    };
  }

  if (percentDiff >= 3) {
    return {
      label: "비싼 편",
      message: "최근 1년 평균보다 비싼 편입니다.",
      type: "negative"
    };
  }

  let message = "최근 1년 평균과 비슷한 수준입니다.";
  if (percentDiff > 0) {
    message = `최근 1년 평균보다 +${percentDiff.toFixed(2)}% 높습니다.`;
  } else if (percentDiff < 0) {
    message = `최근 1년 평균보다 ${percentDiff.toFixed(2)}% 낮습니다.`;
  }

  return {
    label: "평균 수준",
    message: message,
    type: "neutral"
  };
}

function renderCurrentRate(data) {
  elements.currencyPairLabel.textContent = `${appState.base} / ${appState.target}`;
  elements.lastUpdatedTime.textContent = `기준일: ${data.date}`;
  elements.currentRateValue.textContent = formatNumber(data.rate);
  elements.currentRateUnit.textContent = appState.target;
  elements.currentRateStatement.textContent = `1 ${appState.base} = ${formatNumber(data.rate)} ${appState.target}`;
}

function renderAverageComparison(periodsData) {
  elements.avgComparisonGrid.innerHTML = '';
  
  const currentRate = appState.latestRateData.rate;
  const periodsOrder = [
    { key: '3M', label: '최근 3개월 평균' },
    { key: '6M', label: '최근 6개월 평균' },
    { key: '1Y', label: '최근 1년 평균' },
    { key: '2Y', label: '최근 2년 평균' },
    { key: '3Y', label: '최근 3년 평균' }
  ];

  periodsOrder.forEach(p => {
    const rates = periodsData[p.key];
    if (!rates || rates.length === 0) return;
    
    const avg = calculateAverage(rates);
    const diff = calculatePercentDiff(currentRate, avg);
    
    let diffClass = 'similar';
    let diffText = `현재는 ${p.label.split(' ')[1]} 평균과 비슷한 수준입니다.`;
    
    if (diff > 0) {
      diffClass = 'higher';
      diffText = `현재는 ${p.label.split(' ')[1]} 평균보다 +${diff.toFixed(2)}% 높습니다.`;
    } else if (diff < 0) {
      diffClass = 'lower';
      diffText = `현재는 ${p.label.split(' ')[1]} 평균보다 ${diff.toFixed(2)}% 낮습니다.`;
    }

    const itemEl = document.createElement('div');
    itemEl.className = 'avg-item';
    itemEl.innerHTML = `
      <div class="avg-item-period">${p.label}</div>
      <div class="avg-item-right">
        <div class="avg-item-val">${formatNumber(avg)} ${appState.target}</div>
        <div class="avg-item-diff ${diffClass}">${diffText}</div>
      </div>
    `;
    elements.avgComparisonGrid.appendChild(itemEl);
  });
}

function renderTargetComparison(currentRate, targetRate) {
  if (!targetRate || isNaN(targetRate) || targetRate <= 0) {
    elements.targetComparisonResult.innerHTML = `<p class="placeholder-text">목표 환율을 입력하면 차이를 계산해 드립니다.</p>`;
    return;
  }

  const diffVal = parseFloat((currentRate - targetRate).toFixed(2));
  const diffPercent = parseFloat(((Math.abs(diffVal) / targetRate) * 100).toFixed(2));
  
  let statusText = '';
  if (diffVal > 0) {
    statusText = `현재 환율은 목표보다 ${formatNumber(diffVal)} ${appState.target} 높습니다.`;
  } else if (diffVal < 0) {
    statusText = `현재 환율은 목표보다 ${formatNumber(Math.abs(diffVal))} ${appState.target} 낮습니다.`;
  } else {
    statusText = `현재 환율이 목표 환율과 정확히 도달했습니다!`;
  }

  elements.targetComparisonResult.innerHTML = `
    <div class="target-result-details">
      <div class="target-result-main">목표 환율: ${formatNumber(targetRate)} ${appState.target}</div>
      <div class="target-result-main">${statusText}</div>
      <div class="target-result-sub">목표까지 약 ${diffPercent}% 차이가 있습니다.</div>
    </div>
  `;
}

function drawChart(canvas, rates, average) {
  if (!canvas || !rates || rates.length === 0) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 15, bottom: 25, left: 15 };

  ctx.clearRect(0, 0, width, height);

  const values = rates.map(r => r.rate);
  const minVal = Math.min(...values, average) * 0.99;
  const maxVal = Math.max(...values, average) * 1.01;

  const getX = (index) => padding.left + (index / (rates.length - 1)) * (width - padding.left - padding.right);
  const getY = (val) => height - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

  // Draw 1-Year Average reference line (Orange/Amber)
  const avgY = getY(average);
  ctx.beginPath();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.moveTo(padding.left, avgY);
  ctx.lineTo(width - padding.right, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Gradient fill under curve
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(values[0]));
  for (let i = 1; i < rates.length; i++) {
    ctx.lineTo(getX(i), getY(values[i]));
  }
  ctx.lineTo(getX(rates.length - 1), height - padding.bottom);
  ctx.lineTo(getX(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw main exchange rate trend line (Primary Blue)
  ctx.beginPath();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.moveTo(getX(0), getY(values[0]));
  for (let i = 1; i < rates.length; i++) {
    ctx.lineTo(getX(i), getY(values[i]));
  }
  ctx.stroke();
}

function saveToLocalStorage(data) {
  try {
    const payload = {
      base: data.base,
      target: data.target,
      targetRate: data.targetRate,
      cachedLatest: data.latestRateData,
      cachedHistorical: data.historicalData
    };
    localStorage.setItem('exchange_app_v3_cache', JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('exchange_app_v3_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.base) appState.base = parsed.base;
      if (parsed.target) appState.target = parsed.target;
      if (parsed.targetRate) appState.targetRate = parsed.targetRate;
      if (parsed.cachedLatest) appState.latestRateData = parsed.cachedLatest;
      if (parsed.cachedHistorical) appState.historicalData = parsed.cachedHistorical;
    }
  } catch (e) {
    console.warn("Failed to load from localStorage:", e);
  }
}

/**
 * 6 & 7. Main Data Coordinator with Error Isolation (Requirement 5, 6, 7)
 */
async function loadExchangeData() {
  showLoadingState();
  hideError();

  let currentSuccess = false;

  // 1. Attempt Current Rate Fetch (Fallback chain)
  try {
    const latest = await fetchCurrentRate(appState.base, appState.target);
    appState.latestRateData = latest;
    currentSuccess = true;

    // Requirement 5: Console Debug Log
    console.log("base:", appState.base);
    console.log("target:", appState.target);
    console.log("rate:", latest.rate);
    console.log("source:", latest.sourceUrl);

    // Render Current Rate & Target Comparison immediately
    renderCurrentRate(latest);
    renderTargetComparison(latest.rate, appState.targetRate);
    renderDebugInfo(latest);

  } catch (err) {
    console.error("All current exchange rate APIs failed:", err);
    
    // Attempt cache restoration
    if (appState.latestRateData) {
      renderCurrentRate(appState.latestRateData);
      renderTargetComparison(appState.latestRateData.rate, appState.targetRate);
      renderDebugInfo(appState.latestRateData, true);
      showError("최신 API 호출에 실패하여 저장된 최근 환율을 표시합니다.");
      currentSuccess = true;
    } else {
      // Show exact required message if completely failed (Requirement 1)
      showError("환율 데이터를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요.");
      elements.judgementMessage.textContent = "환율 데이터를 불러오지 못했습니다.";
      elements.avgComparisonGrid.innerHTML = `<div class="error-placeholder">환율 데이터를 불러오지 못했습니다.</div>`;
      return;
    }
  }

  // 2. Requirement 6: Historical average fetch ONLY after current rate succeeds!
  if (currentSuccess) {
    try {
      const periods = ['3M', '6M', '1Y', '2Y', '3Y'];
      const historicalPromises = periods.map(p => fetchHistoricalRates(appState.base, appState.target, p));
      const historicalResults = await Promise.all(historicalPromises);
      
      periods.forEach((p, index) => {
        appState.historicalData[p] = historicalResults[index];
      });

      saveToLocalStorage(appState);

      const rates1Y = appState.historicalData['1Y'];
      const avg1Y = calculateAverage(rates1Y);
      const percentDiff1Y = calculatePercentDiff(appState.latestRateData.rate, avg1Y);

      updateJudgementUI(getJudgement(percentDiff1Y));
      renderAverageComparison(appState.historicalData);
      drawChart(elements.rateChartCanvas, rates1Y, avg1Y);

    } catch (histErr) {
      // Requirement 7: Isolated failure handling for historical data!
      console.error("Historical averages fetch failed:", histErr);
      elements.avgComparisonGrid.innerHTML = `<div class="error-placeholder">과거 평균 데이터를 불러오지 못했습니다.</div>`;
      elements.judgementMessage.textContent = "현재 환율 정보가 정상 조회되었습니다. (과거 평균 정보 미수신)";
      elements.judgementCard.className = 'card judgement-card neutral';
      elements.judgementLabel.textContent = '정보 조회 완료';
    }
  }
}

function renderDebugInfo(data, isCached = false) {
  if (elements.debugInfoBox) {
    elements.debugInfoBox.innerHTML = `
      <div><strong>사용 API:</strong> ${data.sourceUrl || '로컬 캐시'} ${isCached ? '(캐시됨)' : ''}</div>
      <div><strong>응답 날짜:</strong> ${data.date}</div>
      <div><strong>현재 환율:</strong> 1 ${appState.base} = ${formatNumber(data.rate)} ${appState.target}</div>
    `;
  }
}

function updateJudgementUI(judgement) {
  elements.judgementCard.className = `card judgement-card ${judgement.type}`;
  elements.judgementLabel.textContent = judgement.label;
  elements.judgementMessage.textContent = judgement.message;
}

function showLoadingState() {
  elements.judgementMessage.textContent = "환율 데이터를 불러오는 중...";
}

function showError(msg) {
  elements.errorContainer.textContent = msg;
  elements.errorContainer.classList.remove('hidden');
}

function hideError() {
  elements.errorContainer.classList.add('hidden');
}

// Helper Utilities
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '---';
  return num.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
