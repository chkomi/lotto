/**
 * 메인 애플리케이션 로직
 */

// Global variables
let analyzer = null;
let backtester = null;
let currentAnalysis = null;
let currentBacktest = null;
let ensembleAnalyzer = null;

// Charts
let scoresChart = null;
let backtestChart = null;
let hitDistributionChart = null;
let frequencyChart = null;
let sectionChart = null;
let oddEvenChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Lotto Analysis System...');
    loadData();
});

/**
 * Load data (from embedded JavaScript file)
 */
function loadData() {
    console.log('Loading lotto data...');

    // Show loading indicator
    showLoading(true);

    try {
        // Check if LOTTO_DATA is available (from lotto-data.js)
        if (typeof LOTTO_DATA === 'undefined') {
            throw new Error('LOTTO_DATA가 로드되지 않았습니다. lotto-data.js 파일을 확인하세요.');
        }

        console.log(`LOTTO_DATA found: ${LOTTO_DATA.length} rounds`);

        // Initialize analyzer with direct data
        analyzer = new LottoAnalyzer();
        analyzer.data = LOTTO_DATA;

        console.log(`Data loaded successfully`);
        console.log(`Total rounds: ${analyzer.data.length}`);
        console.log(`First round: ${analyzer.data[0].round} (${analyzer.data[0].date})`);
        console.log(`Last round: ${analyzer.data[analyzer.data.length - 1].round} (${analyzer.data[analyzer.data.length - 1].date})`);

        backtester = new Backtester(analyzer);
        ensembleAnalyzer = new EnsembleAnalyzer();
        // 앙상블: 엔트로피 + TOPSIS만 사용
        ensembleAnalyzer.setMethodsConfig({
            entropy: { enabled: true, weight: 0.5 },
            topsis: { enabled: true, weight: 0.5 },
            randomForest: { enabled: false, weight: 0 },
            association: { enabled: false, weight: 0 }
        });

        // Initialize statistics tab
        updateStatistics();

        // Run initial analysis
        runNextRoundPrediction();

        // Hide loading indicator
        showLoading(false);

        // Show success message
        showMessage('데이터 로드 완료! 분석이 자동으로 시작되었습니다.', 'success');

    } catch (error) {
        console.error('Error loading data:', error);
        showLoading(false);

        const errorMsg = `
데이터 로딩 실패: ${error.message}

문제:
- lotto-data.js 파일이 제대로 로드되지 않았을 수 있습니다.

해결 방법:
1. 브라우저 콘솔(F12)을 열어 오류 메시지 확인
2. index.html에서 lotto-data.js가 제대로 포함되었는지 확인
3. 파일 경로: js/lotto-data.js

서버 없이 바로 실행:
- 그냥 index.html을 더블클릭하여 열면 됩니다!
        `;

        alert(errorMsg);

        // Show error on page
        document.body.insertAdjacentHTML('afterbegin', `
            <div style="background: #fee; border: 2px solid #c00; padding: 20px; margin: 20px; border-radius: 8px;">
                <h2 style="color: #c00;">⚠️ 데이터 로딩 오류</h2>
                <pre style="white-space: pre-wrap;">${errorMsg}</pre>
            </div>
        `);
    }
}

/**
 * Show/hide loading indicator
 */
function showLoading(show, message = '데이터 로딩 중...') {
    let loader = document.getElementById('global-loader');

    if (show && !loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.5); display: flex; align-items: center;
                        justify-content: center; z-index: 9999;">
                <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; min-width: 300px;">
                    <div class="spinner"></div>
                    <p style="margin-top: 20px; font-size: 1.1rem;">${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(loader);
    } else if (show && loader) {
        // 메시지 업데이트
        const messageEl = loader.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
    } else if (!show && loader) {
        loader.remove();
    }
}

/**
 * Show progress indicator with percentage
 */
function showProgress(show, options = {}) {
    const {
        message = '처리 중...',
        progress = 0,
        current = 0,
        total = 0,
        detail = ''
    } = options;

    let progressLoader = document.getElementById('progress-loader');

    if (show && !progressLoader) {
        progressLoader = document.createElement('div');
        progressLoader.id = 'progress-loader';
        progressLoader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;
        document.body.appendChild(progressLoader);
    }

    if (progressLoader) {
        const progressPercent = Math.min(100, Math.max(0, progress));
        const currentText = total > 0 ? `${current} / ${total}` : '';
        const detailText = detail ? ` (${detail})` : '';

        progressLoader.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; 
                        min-width: 320px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <div class="spinner" style="margin: 0 auto 20px;"></div>
                <p style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 16px;">
                    ${message}
                </p>
                ${currentText ? `<p style="font-size: 0.9rem; color: #64748b; margin-bottom: 12px;">${currentText}${detailText}</p>` : ''}
                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 16px;">
                    <div style="background: linear-gradient(90deg, #2563eb, #8b5cf6); height: 100%; 
                                width: ${progressPercent}%; transition: width 0.3s ease; border-radius: 4px;"></div>
                </div>
                <p style="font-size: 0.875rem; color: #64748b; margin-top: 12px; font-weight: 600;">
                    ${progressPercent.toFixed(1)}%
                </p>
            </div>
        `;
    }

    if (!show && progressLoader) {
        progressLoader.remove();
    }
}

/**
 * Update progress
 */
function updateProgress(options) {
    showProgress(true, options);
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
    const colors = {
        success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
    };

    const color = colors[type] || colors.info;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${color.bg}; border: 2px solid ${color.border};
        color: ${color.text}; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    msgDiv.textContent = message;

    document.body.appendChild(msgDiv);

    setTimeout(() => {
        msgDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => msgDiv.remove(), 300);
    }, 3000);
}

// Add animation styles
if (!document.getElementById('msg-animations')) {
    const style = document.createElement('style');
    style.id = 'msg-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

/**
 * Get method name in Korean
 */
function getMethodName(method) {
    const methodNames = {
        'entropy': '엔트로피 가중치법',
        'topsis': 'TOPSIS 방법',
        'randomForest': 'Random Forest',
        'association': '연관 규칙 분석',
        'ensemble': '앙상블'
    };
    return methodNames[method] || method;
}

/**
 * Get selected analysis method
 */
function getSelectedMethod() {
    const methodSelect = document.getElementById('analysis-method');
    return methodSelect ? methodSelect.value : 'entropy';
}

/**
 * Run analysis with selected method
 */
function runAnalysis() {
    if (!analyzer) {
        alert('데이터가 로드되지 않았습니다.');
        return;
    }

    const method = getSelectedMethod();
    const rounds = parseInt(document.getElementById('analyze-rounds').value);
    const predictCount = parseInt(document.getElementById('predict-count').value);

    analyzer.params.recentWindow = rounds;
    updateCurrentWindowDisplay(rounds);

    // 분석 시작 (랜덤포레스트 등 시간이 걸리는 경우를 위해)
    const isSlowMethod = method === 'randomForest' || method === 'association' || method === 'ensemble';
    if (isSlowMethod) {
        showProgress(true, {
            message: `${getMethodName(method)} 분석 진행 중...`,
            progress: 50,
            detail: '데이터 처리 중...'
        });
    }

    const lastRound = analyzer.data[analyzer.data.length - 1].round;
    
    try {
        // 선택된 방법에 따라 분석 실행
        currentAnalysis = runAnalysisByMethod(method, lastRound, rounds);
        
        if (isSlowMethod) {
            showProgress(false);
        }
    } catch (error) {
        if (isSlowMethod) {
            showProgress(false);
        }
        showMessage(`분석 중 오류 발생: ${error.message}`, 'error');
        console.error('Analysis error:', error);
        return;
    }

    const nextRound = lastRound + 1;
    document.getElementById('next-round-info').textContent =
        `${nextRound}회차 예측 (${getMethodName(method)}, 최근 ${rounds}회차 데이터 기반)`;

    displayPredictions(currentAnalysis, predictCount);
    displayWeights(currentAnalysis);
    displayScoresChart(currentAnalysis);

    showMessage(`${getMethodName(method)} 분석이 완료되었습니다.`, 'success');
}

/**
 * Run next round prediction
 */
function runNextRoundPrediction() {
    if (!analyzer) return;

    const method = getSelectedMethod();
    const rounds = parseInt(document.getElementById('analyze-rounds').value) || 50;
    const predictCount = parseInt(document.getElementById('predict-count').value) || 10;

    analyzer.params.recentWindow = rounds;
    updateCurrentWindowDisplay(rounds);

    const lastRound = analyzer.data[analyzer.data.length - 1].round;

    // 분석 시작 (랜덤포레스트 등 시간이 걸리는 경우를 위해)
    const isSlowMethod = method === 'randomForest' || method === 'association' || method === 'ensemble';
    if (isSlowMethod) {
        showProgress(true, {
            message: `${getMethodName(method)} 분석 진행 중...`,
            progress: 50,
            detail: '데이터 처리 중...'
        });
    }

    try {
        // 선택된 방법에 따라 분석 실행
        currentAnalysis = runAnalysisByMethod(method, lastRound, rounds);
        
        if (isSlowMethod) {
            showProgress(false);
        }
    } catch (error) {
        if (isSlowMethod) {
            showProgress(false);
        }
        console.error('Analysis error:', error);
        return;
    }

    const nextRound = lastRound + 1;
    document.getElementById('next-round-info').textContent =
        `${nextRound}회차 예측 (${getMethodName(method)}, 최근 ${rounds}회차 데이터 기반)`;

    displayPredictions(currentAnalysis, predictCount);
    displayWeights(currentAnalysis);
    displayScoresChart(currentAnalysis);
}

/**
 * Run analysis by selected method
 */
function runAnalysisByMethod(method, upToRound, rounds) {
    switch(method) {
        case 'entropy':
            return runEntropyAnalysis(upToRound, rounds);
        case 'topsis':
            return runTOPSISAnalysis(upToRound, rounds);
        case 'randomForest':
            return runRandomForestAnalysis(upToRound, rounds);
        case 'association':
            return runAssociationAnalysis(upToRound, rounds);
        case 'ensemble':
            return runEnsembleAnalysis(upToRound, rounds);
        default:
            return runEntropyAnalysis(upToRound, rounds);
    }
}

/**
 * Run Entropy analysis
 */
function runEntropyAnalysis(upToRound, rounds) {
    analyzer.params.recentWindow = rounds;
    return analyzer.analyze(upToRound);
}

/**
 * Run TOPSIS analysis
 */
function runTOPSISAnalysis(upToRound, rounds) {
    const analysisData = analyzer.data.filter(d => d.round <= upToRound);
    analyzer.params.recentWindow = rounds;
    
    // 각 번호의 특성 계산
    const numberFeatures = [];
    for (let num = 1; num <= 45; num++) {
        const features = analyzer.calculateFeatures(num, analysisData);
        numberFeatures.push({
            number: num,
            features: features
        });
    }

    // 특성 행렬 구성
    const featureMatrix = numberFeatures.map(nf =>
        analyzer.features.map(fname => nf.features[fname])
    );

    // 엔트로피 가중치 계산
    const entropyResult = EntropyWeightMethod.calculate(featureMatrix, analyzer.features);
    const weights = entropyResult.weights;

    // 모든 기준을 이익형으로 설정
    const benefitCriteria = new Array(analyzer.features.length).fill(true);

    // TOPSIS 분석
    const topsisResult = TOPSIS.analyze(featureMatrix, weights, benefitCriteria);

    // 결과 정리
    const predictions = [];
    for (let i = 0; i < 45; i++) {
        predictions.push({
            number: i + 1,
            score: topsisResult.scores[i],
            rank: topsisResult.ranks[i],
            features: numberFeatures[i].features
        });
    }

    predictions.sort((a, b) => b.score - a.score);

    return {
        predictions: predictions,
        weights: weights,
        weightMap: entropyResult.weightMap,
        featureNames: analyzer.features,
        analyzedRound: upToRound,
        dataCount: analysisData.length,
        method: 'TOPSIS'
    };
}

/**
 * Run Random Forest analysis
 */
function runRandomForestAnalysis(upToRound, rounds) {
    const analysisData = analyzer.data.filter(d => d.round <= upToRound);
    analyzer.params.recentWindow = rounds;

    // 각 번호의 특성 계산
    const numberFeatures = [];
    for (let num = 1; num <= 45; num++) {
        const features = analyzer.calculateFeatures(num, analysisData);
        numberFeatures.push({
            number: num,
            features: features
        });
    }

    // Random Forest로 특성 중요도 계산
    const recentData = analysisData.slice(-Math.min(100, analysisData.length));
    const rfResult = LottoRandomForest.analyzeFeatureImportance(
        recentData,
        numberFeatures,
        analyzer.features
    );

    // RF 가중치로 각 번호 점수 계산
    const predictions = [];
    for (let i = 0; i < 45; i++) {
        const num = i + 1;
        const featureValues = analyzer.features.map(fname => numberFeatures[i].features[fname]);
        const score = EntropyWeightMethod.calculateWeightedScore(featureValues, rfResult.weights);

        predictions.push({
            number: num,
            score: score,
            rank: 0,
            features: numberFeatures[i].features
        });
    }

    predictions.sort((a, b) => b.score - a.score);
    predictions.forEach((p, idx) => p.rank = idx + 1);

    // 가중치 맵 생성
    const weightMap = {};
    analyzer.features.forEach((name, idx) => {
        weightMap[name] = rfResult.weights[idx];
    });

    return {
        predictions: predictions,
        weights: rfResult.weights,
        weightMap: weightMap,
        featureNames: analyzer.features,
        analyzedRound: upToRound,
        dataCount: analysisData.length,
        method: 'Random Forest',
        featureImportance: rfResult.importance
    };
}

/**
 * Run Association Rules analysis
 */
function runAssociationAnalysis(upToRound, rounds) {
    const analysisData = analyzer.data.filter(d => d.round <= upToRound);
    analyzer.params.recentWindow = rounds;

    // 연관 규칙 분석
    const recentData = analysisData.slice(-Math.min(rounds, analysisData.length));
    const assocScores = LottoAssociationAnalysis.analyzeAndScore(recentData, recentData.length);

    // 결과 정리
    const predictions = [];
    for (let num = 1; num <= 45; num++) {
        const scoreObj = assocScores[num] || { totalScore: 0 };
        predictions.push({
            number: num,
            score: scoreObj.totalScore,
            rank: 0,
            features: {}
        });
    }

    predictions.sort((a, b) => b.score - a.score);
    predictions.forEach((p, idx) => p.rank = idx + 1);

    return {
        predictions: predictions,
        weights: [],
        weightMap: {},
        featureNames: [],
        analyzedRound: upToRound,
        dataCount: analysisData.length,
        method: 'Association Rules'
    };
}

/**
 * Run Ensemble analysis
 */
function runEnsembleAnalysis(upToRound, rounds) {
    analyzer.params.recentWindow = rounds;
    const result = ensembleAnalyzer.analyze(analyzer, upToRound);

    // 앙상블 결과를 표준 형식으로 변환
    return {
        predictions: result.predictions.map(p => ({
            number: p.number,
            score: p.finalScore,
            rank: p.rank,
            features: p.details || {},
            methodScores: p.scores || {}
        })),
        weights: result.methodResults.entropy ? result.methodResults.entropy.weights : [],
        weightMap: result.methodResults.entropy ? result.methodResults.entropy.weightMap : {},
        featureNames: analyzer.features,
        analyzedRound: upToRound,
        dataCount: analyzer.data.filter(d => d.round <= upToRound).length,
        method: 'Ensemble',
        methodConfig: result.methods
    };
}

/**
 * Update current window display
 */
function updateCurrentWindowDisplay(rounds) {
    const display = document.getElementById('current-window');
    if (display) {
        display.textContent = rounds;
    }
}

/**
 * Display predictions
 */
function displayPredictions(analysis, count) {
    const container = document.getElementById('prediction-results');
    container.innerHTML = '';

    const predictions = analysis.predictions.slice(0, count);

    predictions.forEach((pred, idx) => {
        const item = document.createElement('div');
        item.className = 'prediction-item';

        const ball = document.createElement('div');
        ball.className = `prediction-number lotto-ball ${getBallColorClass(pred.number)}`;
        ball.textContent = pred.number;

        const score = document.createElement('div');
        score.className = 'prediction-score';
        score.textContent = `점수: ${(pred.score * 100).toFixed(1)}`;

        const rank = document.createElement('div');
        rank.className = 'prediction-rank';
        rank.textContent = `#${pred.rank}`;

        item.appendChild(ball);
        item.appendChild(score);
        item.appendChild(rank);

        container.appendChild(item);
    });
}

/**
 * Display feature weights
 */
function displayWeights(analysis) {
    const container = document.getElementById('weights-display');
    container.innerHTML = '';

    // weights가 없거나 featureNames가 없는 경우 (예: Association Rules)
    if (!analysis.weights || analysis.weights.length === 0 || !analysis.featureNames || analysis.featureNames.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">이 분석 방법은 특성 가중치를 제공하지 않습니다.</p>';
        return;
    }

    const featureLabels = {
        'recentFrequency': '최근 출현 빈도',
        'absencePeriod': '미출현 기간',
        'intervalPattern': '출현 간격 패턴',
        'oddEvenBalance': '홀짝 균형도',
        'sectionDistribution': '구간 분포',
        'consecutivePattern': '연속 번호 패턴',
        'bonusHistory': '보너스 이력',
        'meanReversion': '평균 회귀'
    };

    analysis.featureNames.forEach((name, idx) => {
        const weight = analysis.weights[idx] || 0;
        const label = featureLabels[name] || name;

        const item = document.createElement('div');
        item.className = 'weight-item';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'weight-label';
        labelDiv.textContent = label;

        const bar = document.createElement('div');
        bar.className = 'weight-bar';

        const fill = document.createElement('div');
        fill.className = 'weight-fill';
        fill.style.width = `${weight * 100}%`;

        const value = document.createElement('span');
        value.className = 'weight-value';
        value.textContent = `${(weight * 100).toFixed(1)}%`;
        fill.appendChild(value);

        bar.appendChild(fill);
        item.appendChild(labelDiv);
        item.appendChild(bar);

        container.appendChild(item);
    });

    // 앙상블 방법인 경우 추가 정보 표시
    if (analysis.method === 'Ensemble' && analysis.methodConfig) {
        const ensembleInfo = document.createElement('div');
        ensembleInfo.style.cssText = 'margin-top: 20px; padding: 16px; background: #f0f9ff; border-radius: 8px;';
        ensembleInfo.innerHTML = '<strong>앙상블 가중치:</strong><br>';
        
        Object.entries(analysis.methodConfig).forEach(([method, config]) => {
            if (config.enabled) {
                const methodName = getMethodName(method);
                ensembleInfo.innerHTML += `${methodName}: ${(config.weight * 100).toFixed(1)}%<br>`;
            }
        });

        container.appendChild(ensembleInfo);
    }
}

/**
 * Display scores chart
 */
function displayScoresChart(analysis) {
    const ctx = document.getElementById('scores-chart');

    if (scoresChart) {
        scoresChart.destroy();
    }

    const numbers = analysis.predictions.map(p => p.number);
    const scores = analysis.predictions.map(p => p.score * 100);
    const colors = numbers.map(n => getBallColor(n));

    scoresChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: numbers,
            datasets: [{
                label: '출현 가능성 점수',
                data: scores,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '점수'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '번호'
                    }
                }
            }
        }
    });
}

/**
 * Get selected backtest method
 */
function getSelectedBacktestMethod() {
    const methodSelect = document.getElementById('backtest-method');
    return methodSelect ? methodSelect.value : 'entropy';
}

/**
 * Run backtest
 */
function runBacktest() {
    if (!backtester) {
        alert('데이터가 로드되지 않았습니다.');
        return;
    }

    const startRound = parseInt(document.getElementById('backtest-start').value);
    const endRound = parseInt(document.getElementById('backtest-end').value);
    const topN = parseInt(document.getElementById('backtest-topn').value);
    const method = getSelectedBacktestMethod();
    const rounds = analyzer.params.recentWindow || 50;

    if (startRound >= endRound) {
        alert('시작 회차는 종료 회차보다 작아야 합니다.');
        return;
    }

    console.log(`Running backtest: ${startRound} - ${endRound} with method: ${method}`);

    // 진행율 표시 시작
    const totalRounds = endRound - startRound + 1;
    showProgress(true, {
        message: `${getMethodName(method)} 백테스팅 진행 중...`,
        progress: 0,
        current: 0,
        total: totalRounds,
        detail: '초기화 중...'
    });

    // 선택된 방법에 따라 분석 함수 생성
    const analysisFunction = (upToRound) => {
        return runAnalysisByMethod(method, upToRound, rounds);
    };

    // 진행율 콜백 함수
    const progressCallback = (progress, current, total, detail) => {
        updateProgress({
            message: `${getMethodName(method)} 백테스팅 진행 중...`,
            progress: progress,
            current: current,
            total: total,
            detail: detail
        });
    };

    try {
        currentBacktest = backtester.run(startRound, endRound, topN, method, analysisFunction, progressCallback);
    } catch (error) {
        showProgress(false);
        showMessage(`백테스트 중 오류 발생: ${error.message}`, 'error');
        console.error('Backtest error:', error);
        return;
    }

    // 진행율 표시 종료
    showProgress(false);

    displayBacktestStats(currentBacktest);
    displayBacktestChart(currentBacktest);
    displayHitDistribution(currentBacktest);
    displayBacktestTable(currentBacktest);
    
    showMessage(`${getMethodName(method)} 백테스트가 완료되었습니다.`, 'success');
}

/**
 * Display backtest statistics
 */
function displayBacktestStats(backtest) {
    const container = document.getElementById('backtest-stats');
    container.innerHTML = '';

    const stats = backtest.statistics;
    const methodName = getMethodName(backtest.method) || backtest.method || '알 수 없음';

    const statCards = [
        { label: '분석 방법', value: methodName, highlight: true },
        { label: '평균 적중 개수', value: stats.averageHits.toFixed(2) },
        { label: 'Top 6 정확도', value: `${(stats.top6Accuracy * 100).toFixed(1)}%` },
        { label: 'Top 10 정확도', value: `${(stats.top10Accuracy * 100).toFixed(1)}%` },
        { label: '평균 순위', value: stats.averageRank.toFixed(1) },
        { label: '3개 이상 적중률', value: `${(stats.hit3PlusRate * 100).toFixed(1)}%` },
        { label: '보너스 적중률', value: `${(stats.bonusHitRate * 100).toFixed(1)}%` }
    ];

    statCards.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-box';
        if (stat.highlight) {
            card.style.background = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
            card.style.border = '2px solid #3b82f6';
        }
        card.innerHTML = `
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        container.appendChild(card);
    });
}

/**
 * Display backtest chart
 */
function displayBacktestChart(backtest) {
    const ctx = document.getElementById('backtest-chart');

    if (backtestChart) {
        backtestChart.destroy();
    }

    const rounds = backtest.results.map(r => r.round);
    const hits = backtest.results.map(r => r.hits);
    const avgRanks = backtest.results.map(r => r.avgRank);

    backtestChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rounds,
            datasets: [
                {
                    label: '적중 개수',
                    data: hits,
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    yAxisID: 'y'
                },
                {
                    label: '평균 순위',
                    data: avgRanks,
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '적중 개수'
                    },
                    min: 0,
                    max: 6
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '평균 순위'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

/**
 * Display hit distribution
 */
function displayHitDistribution(backtest) {
    const ctx = document.getElementById('hit-distribution-chart');

    if (hitDistributionChart) {
        hitDistributionChart.destroy();
    }

    const dist = backtest.statistics.hitDistribution;
    const labels = Object.keys(dist);
    const values = Object.values(dist);

    hitDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => `${l}개`),
            datasets: [{
                label: '회차 수',
                data: values,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '회차 수'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '적중 개수'
                    }
                }
            }
        }
    });
}

/**
 * Display backtest table
 */
function displayBacktestTable(backtest) {
    const tbody = document.querySelector('#backtest-table tbody');
    tbody.innerHTML = '';

    // Show last 20 results
    const results = backtest.results.slice(-20);

    results.forEach(r => {
        const row = document.createElement('tr');

        const predictedHTML = r.predicted.map(n =>
            `<span class="lotto-ball ${getBallColorClass(n)}" style="width:30px;height:30px;font-size:0.8rem;display:inline-flex;align-items:center;justify-content:center;margin:2px;">${n}</span>`
        ).join('');

        const actualHTML = r.actual.map(n =>
            `<span class="lotto-ball ${getBallColorClass(n)}" style="width:30px;height:30px;font-size:0.8rem;display:inline-flex;align-items:center;justify-content:center;margin:2px;">${n}</span>`
        ).join('');

        row.innerHTML = `
            <td>${r.round}</td>
            <td>${predictedHTML}</td>
            <td>${actualHTML}</td>
            <td style="font-weight:bold;color:${r.hits >= 3 ? 'var(--success-color)' : 'var(--text-secondary)'}">${r.hits}개</td>
            <td>${r.avgRank.toFixed(1)}</td>
        `;

        tbody.appendChild(row);
    });
}

/**
 * Export backtest results
 */
function exportBacktestResults() {
    if (!currentBacktest) {
        alert('먼저 백테스트를 실행해주세요.');
        return;
    }

    const csv = backtester.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `backtest_results_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Update statistics
 */
function updateStatistics() {
    if (!analyzer) return;

    const stats = analyzer.getStatistics();

    // Total rounds
    document.getElementById('total-rounds').textContent = stats.totalRounds;

    // Most/Least frequent
    let maxFreq = 0;
    let minFreq = Infinity;
    let mostFrequent = [];
    let leastFrequent = [];

    Object.entries(stats.numberFrequency).forEach(([num, freq]) => {
        if (freq > maxFreq) {
            maxFreq = freq;
            mostFrequent = [num];
        } else if (freq === maxFreq) {
            mostFrequent.push(num);
        }

        if (freq < minFreq) {
            minFreq = freq;
            leastFrequent = [num];
        } else if (freq === minFreq) {
            leastFrequent.push(num);
        }
    });

    document.getElementById('most-frequent').textContent =
        `${mostFrequent.join(', ')} (${maxFreq}회)`;
    document.getElementById('least-frequent').textContent =
        `${leastFrequent.join(', ')} (${minFreq}회)`;

    // Charts
    displayFrequencyChart(stats);
    displaySectionChart(stats);
    displayOddEvenChart(stats);
}

/**
 * Display frequency chart
 */
function displayFrequencyChart(stats) {
    const ctx = document.getElementById('frequency-chart');

    if (frequencyChart) {
        frequencyChart.destroy();
    }

    const numbers = Object.keys(stats.numberFrequency).map(n => parseInt(n));
    const frequencies = numbers.map(n => stats.numberFrequency[n]);
    const colors = numbers.map(n => getBallColor(n));

    frequencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: numbers,
            datasets: [{
                label: '출현 횟수',
                data: frequencies,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '출현 횟수'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '번호'
                    }
                }
            }
        }
    });
}

/**
 * Display section chart
 */
function displaySectionChart(stats) {
    const ctx = document.getElementById('section-chart');

    if (sectionChart) {
        sectionChart.destroy();
    }

    const labels = ['1-9', '10-18', '19-27', '28-36', '37-45'];

    sectionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: stats.sectionDistribution,
                backgroundColor: [
                    'rgba(251, 191, 36, 0.7)',
                    'rgba(96, 165, 250, 0.7)',
                    'rgba(248, 113, 113, 0.7)',
                    'rgba(156, 163, 175, 0.7)',
                    'rgba(52, 211, 153, 0.7)'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

/**
 * Display odd/even chart
 */
function displayOddEvenChart(stats) {
    const ctx = document.getElementById('oddeven-chart');

    if (oddEvenChart) {
        oddEvenChart.destroy();
    }

    oddEvenChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['홀수', '짝수'],
            datasets: [{
                data: [stats.oddEvenRatio.odd, stats.oddEvenRatio.even],
                backgroundColor: [
                    'rgba(139, 92, 246, 0.7)',
                    'rgba(37, 99, 235, 0.7)'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

/**
 * Get ball color by number range
 */
function getBallColorClass(num) {
    if (num <= 9) return 'range-1';
    if (num <= 18) return 'range-2';
    if (num <= 27) return 'range-3';
    if (num <= 36) return 'range-4';
    return 'range-5';
}

/**
 * Get ball color for charts
 */
function getBallColor(num) {
    if (num <= 9) return 'rgba(251, 191, 36, 0.7)';
    if (num <= 18) return 'rgba(96, 165, 250, 0.7)';
    if (num <= 27) return 'rgba(248, 113, 113, 0.7)';
    if (num <= 36) return 'rgba(156, 163, 175, 0.7)';
    return 'rgba(52, 211, 153, 0.7)';
}

/**
 * Generate combinations from predicted numbers
 */
function generateCombinations() {
    if (!currentAnalysis) {
        alert('먼저 분석을 실행해주세요.');
        return;
    }

    const combinationCount = parseInt(document.getElementById('combination-count').value) || 10;
    const poolSize = parseInt(document.getElementById('predict-count').value) || 10;

    // Get top N predicted numbers
    const topNumbers = currentAnalysis.predictions.slice(0, poolSize);

    console.log(`Generating combinations from top ${poolSize} numbers`);

    // Generate all possible 6-number combinations
    const allCombinations = [];
    const numbers = topNumbers.map(p => p.number);
    const scores = topNumbers.map(p => p.score);

    // Create score map for quick lookup
    const scoreMap = {};
    topNumbers.forEach(p => scoreMap[p.number] = p.score);

    // Generate combinations (C(n, 6))
    function combine(arr, size, start = 0, combo = []) {
        if (combo.length === size) {
            // Calculate combination score (average of selected numbers)
            const comboScore = combo.reduce((sum, num) => sum + scoreMap[num], 0) / combo.length;
            allCombinations.push({
                numbers: [...combo],
                score: comboScore
            });
            return;
        }

        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            combine(arr, size, i + 1, combo);
            combo.pop();
        }
    }

    combine(numbers, 6);

    // Sort by score (descending)
    allCombinations.sort((a, b) => b.score - a.score);

    // Take top N combinations
    const topCombinations = allCombinations.slice(0, combinationCount);

    console.log(`Generated ${allCombinations.length} total combinations, showing top ${topCombinations.length}`);

    // Display combinations
    displayCombinations(topCombinations);

    showMessage(`${topCombinations.length}개 조합이 생성되었습니다!`, 'success');
}

/**
 * Display combinations
 */
function displayCombinations(combinations) {
    const container = document.getElementById('combinations-results');
    container.innerHTML = '';

    if (!combinations || combinations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">조합을 생성할 수 없습니다.</p>';
        return;
    }

    // Create combination cards
    combinations.forEach((combo, idx) => {
        const card = document.createElement('div');
        card.className = 'combination-card';
        card.style.cssText = `
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.3s ease;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #cbd5e1;
        `;

        const rank = document.createElement('div');
        rank.style.cssText = 'font-weight: 700; color: #1e293b; font-size: 1.1rem;';
        rank.textContent = `#${idx + 1}`;

        const score = document.createElement('div');
        score.style.cssText = 'color: #64748b; font-size: 0.9rem;';
        score.textContent = `점수: ${(combo.score * 100).toFixed(1)}`;

        header.appendChild(rank);
        header.appendChild(score);

        // Numbers
        const numbersDiv = document.createElement('div');
        numbersDiv.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

        const sortedNumbers = [...combo.numbers].sort((a, b) => a - b);

        sortedNumbers.forEach(num => {
            const ball = document.createElement('div');
            ball.className = `lotto-ball ${getBallColorClass(num)}`;
            ball.textContent = num;
            numbersDiv.appendChild(ball);
        });

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-primary';
        copyBtn.style.cssText = 'margin-top: 12px; padding: 8px 16px; font-size: 0.9rem;';
        copyBtn.textContent = '📋 복사';
        copyBtn.onclick = () => {
            const text = sortedNumbers.join(', ');
            navigator.clipboard.writeText(text).then(() => {
                showMessage('번호가 클립보드에 복사되었습니다!', 'success');
            });
        };

        card.appendChild(header);
        card.appendChild(numbersDiv);
        card.appendChild(copyBtn);

        // Hover effect
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#2563eb';
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e2e8f0';
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        container.appendChild(card);
    });

    // Summary
    const summary = document.createElement('div');
    summary.style.cssText = `
        margin-top: 20px;
        padding: 16px;
        background: #dbeafe;
        border-radius: 8px;
        text-align: center;
        color: #1e40af;
    `;
    summary.innerHTML = `
        <strong>💡 팁:</strong> 상위 조합일수록 예측 점수가 높은 번호들로 구성되어 있습니다.<br>
        각 조합의 번호를 클릭하여 복사할 수 있습니다.
    `;

    container.appendChild(summary);
}

/**
 * Update analyze rounds parameter
 */
function updateAnalyzeRounds() {
    if (!analyzer) return;

    const rounds = parseInt(document.getElementById('analyze-rounds').value) || 50;
    analyzer.params.recentWindow = rounds;

    console.log(`Analysis window updated to ${rounds} rounds`);
    showMessage(`분석 회차가 ${rounds}회로 변경되었습니다.`, 'info');
}

// Add event listener for analyze rounds input
document.addEventListener('DOMContentLoaded', function() {
    const analyzeRoundsInput = document.getElementById('analyze-rounds');
    if (analyzeRoundsInput) {
        analyzeRoundsInput.addEventListener('change', updateAnalyzeRounds);
    }
});
