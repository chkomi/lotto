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
document.addEventListener('DOMContentLoaded', function () {
    console.log('Initializing Lotto Analysis System...');
    loadData();
});

/**
 * Load data from CSV file (automatically finds the latest CSV)
 */
async function loadData() {
    console.log('Loading lotto data from CSV...');

    // Show loading indicator
    showLoading(true);

    try {
        // Find the latest CSV file
        const csvFiles = await findLatestCSV();
        if (!csvFiles.latest) {
            throw new Error('CSV 파일을 찾을 수 없습니다. data 폴더에 lotto_*.csv 파일이 있는지 확인하세요.');
        }

        console.log(`Loading CSV: ${csvFiles.latest}`);

        // Load CSV file
        const response = await fetch(csvFiles.latest);
        if (!response.ok) {
            throw new Error(`CSV 파일 로드 실패: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();

        // Parse CSV using analyzer
        analyzer = new LottoAnalyzer();
        analyzer.loadData(csvText);

        console.log(`Data loaded successfully`);
        console.log(`Total rounds: ${analyzer.data.length}`);
        console.log(`First round: ${analyzer.data[0].round} (${analyzer.data[0].date})`);
        console.log(`Last round: ${analyzer.data[analyzer.data.length - 1].round} (${analyzer.data[analyzer.data.length - 1].date})`);

        // Update UI with current data info
        updateDataInfo();

        // 업데이트 필요 여부 확인
        checkForUpdates();

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

        const lastRound = analyzer.data[analyzer.data.length - 1].round;
        showMessage(`데이터 로드 완료! (최신 회차: ${lastRound}회) 다음 회차(${lastRound + 1}회) 예측을 시작합니다.`, 'success');

    } catch (error) {
        console.error('Error loading data:', error);
        showLoading(false);

        // Try fallback to LOTTO_DATA if available
        if (typeof LOTTO_DATA !== 'undefined' && LOTTO_DATA.length > 0) {
            console.log('Falling back to embedded LOTTO_DATA...');
            analyzer = new LottoAnalyzer();
            analyzer.data = LOTTO_DATA;
            backtester = new Backtester(analyzer);
            updateStatistics();
            runNextRoundPrediction();
            showLoading(false);
            showMessage('CSV 파일을 찾을 수 없어 내장 데이터를 사용합니다. CSV 파일을 data 폴더에 추가하면 자동으로 업데이트됩니다.', 'warning');
            return;
        }

        const errorMsg = `
데이터 로딩 실패: ${error.message}

문제:
- CSV 파일을 찾을 수 없거나 로드할 수 없습니다.

해결 방법:
1. data 폴더에 lotto_*.csv 파일이 있는지 확인
2. 서버를 사용하여 실행 (python3 -m http.server 8000)
3. 브라우저 콘솔(F12)을 열어 오류 메시지 확인
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
 * Find the latest CSV file in data directory
 */
async function findLatestCSV() {
    // Always use the fixed filename lotto_data.csv
    const csvFile = 'data/lotto_data.csv';

    try {
        const response = await fetch(csvFile, { method: 'HEAD' });
        if (response.ok) {
            return { latest: csvFile, found: true };
        }
    } catch (e) {
        console.error('Error loading lotto_data.csv:', e);
    }

    // If file not found, return null (will fallback to LOTTO_DATA)
    return { latest: null, found: false };
}

/**
 * Update data info display
 */
function updateDataInfo() {
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) return;

    const lastRound = analyzer.data[analyzer.data.length - 1];

    // 자동 회차 계산 기능 사용
    let nextRoundInfo;
    if (typeof getNextRoundInfo !== 'undefined') {
        nextRoundInfo = getNextRoundInfo(analyzer);
    }

    const nextRound = nextRoundInfo ? nextRoundInfo.nextRound : lastRound.round + 1;

    // Update any data info displays if they exist
    const dataInfoEl = document.getElementById('data-info');
    if (dataInfoEl) {
        if (nextRoundInfo) {
            const drawInfo = nextRoundInfo.isDrawToday
                ? ` (오늘 추첨일!)`
                : ` (${nextRoundInfo.daysUntilDraw}일 후)`;
            dataInfoEl.textContent = `최신 회차: ${lastRound.round}회 (${lastRound.date}) → 예측 대상: ${nextRound}회${drawInfo}`;
        } else {
            dataInfoEl.textContent = `최신 회차: ${lastRound.round}회 (${lastRound.date}) → 예측 대상: ${nextRound}회`;
        }
    }

    // 다음 회차 정보를 전역 변수로 저장 (다른 함수에서 사용)
    window.nextRoundInfo = nextRoundInfo || { nextRound: nextRound };
}

/**
 * 업데이트 필요 여부 확인 및 UI 표시
 */
function checkForUpdates() {
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) return;

    const lastRound = analyzer.data[analyzer.data.length - 1];
    const lastRoundNum = lastRound.round;
    const lastDateStr = lastRound.date;

    // 마지막 회차 날짜 파싱
    const [year, month, day] = lastDateStr.split('.').map(Number);
    const lastDate = new Date(year, month - 1, day, 21, 0, 0, 0);
    const now = new Date();

    // 마지막 추첨일 이후 경과한 주 수 계산 (토요일 기준)
    let expectedLatestRound = lastRoundNum;
    let currentDate = new Date(lastDate);

    // 마지막 추첨일 다음 토요일부터 시작
    currentDate.setDate(currentDate.getDate() + 7);

    // 현재 날짜 이전의 모든 토요일을 세어서 예상 최신 회차 계산
    while (currentDate <= now) {
        expectedLatestRound++;
        currentDate.setDate(currentDate.getDate() + 7);
    }

    const missingRounds = expectedLatestRound - lastRoundNum;

    const updateCard = document.getElementById('update-info-card');
    const statusEl = document.getElementById('update-status');

    if (missingRounds > 0) {
        // 누락된 회차가 있음
        updateCard.style.display = 'block';
        statusEl.innerHTML = `
            <div style="color: var(--warning-color); font-weight: 600; margin-bottom: 8px;">
                ⚠️ ${missingRounds}개 회차가 누락되었습니다.
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                현재: ${lastRoundNum}회 → 예상 최신: ${expectedLatestRound}회
            </div>
        `;
    } else {
        // 최신 데이터임
        updateCard.style.display = 'block';
        statusEl.innerHTML = `
            <div style="color: var(--success-color); font-weight: 600; margin-bottom: 8px;">
                ✅ 최신 데이터입니다.
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                현재: ${lastRoundNum}회 (최신)
            </div>
        `;
    }
}

/**
 * 최신 회차 확인 및 업데이트 (사용자가 버튼 클릭 시)
 */
function checkAndUpdateData() {
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) {
        showMessage('데이터가 로드되지 않았습니다.', 'error');
        return;
    }

    const lastRound = analyzer.data[analyzer.data.length - 1];
    const lastRoundNum = lastRound.round;
    const lastDateStr = lastRound.date;

    // 마지막 회차 날짜 파싱
    const [year, month, day] = lastDateStr.split('.').map(Number);
    const lastDate = new Date(year, month - 1, day, 21, 0, 0, 0);
    const now = new Date();

    // 마지막 추첨일 이후 경과한 주 수 계산 (토요일 기준)
    let expectedLatestRound = lastRoundNum;
    let currentDate = new Date(lastDate);

    // 마지막 추첨일 다음 토요일부터 시작
    currentDate.setDate(currentDate.getDate() + 7);

    // 현재 날짜 이전의 모든 토요일을 세어서 예상 최신 회차 계산
    while (currentDate <= now) {
        expectedLatestRound++;
        currentDate.setDate(currentDate.getDate() + 7);
    }

    const missingRounds = expectedLatestRound - lastRoundNum;

    if (missingRounds <= 0) {
        showMessage('이미 최신 데이터입니다!', 'success');
        return;
    }

    // 누락된 회차 입력 UI 표시
    showMissingRoundsInput(lastRoundNum, expectedLatestRound, missingRounds);
}

/**
 * 누락된 회차 입력 UI 표시
 */
function showMissingRoundsInput(startRound, endRound, count) {
    // 모달 또는 입력 폼 생성
    const modal = document.createElement('div');
    modal.id = 'update-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;

    let html = `
        <h2 style="margin: 0 0 16px 0; color: var(--primary-color);">📥 누락된 회차 데이터 입력</h2>
        <p style="margin: 0 0 20px 0; color: var(--text-secondary);">
            ${count}개 회차(${startRound + 1}회 ~ ${endRound}회)의 데이터를 입력해주세요.
        </p>
        <div id="rounds-input-container" style="margin-bottom: 20px;">
    `;

    // 각 회차별 입력 필드 생성
    for (let round = startRound + 1; round <= endRound; round++) {
        html += `
            <div class="round-input-group" style="margin-bottom: 16px; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary-color);">
                    ${round}회차
                </div>
                <div style="display: grid; grid-template-columns: 1fr 6fr; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 0.875rem;">날짜:</label>
                    <input type="text" class="round-date" data-round="${round}" 
                           placeholder="YYYY.MM.DD" 
                           style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 6fr; gap: 8px; align-items: center;">
                    <label style="font-size: 0.875rem;">번호:</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${[1, 2, 3, 4, 5, 6].map(i => `
                            <input type="number" class="round-number" data-round="${round}" data-index="${i}" 
                                   min="1" max="45" placeholder="${i}" 
                                   style="width: 50px; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;">
                        `).join('')}
                        <span style="align-self: center; color: var(--text-secondary);">보너스:</span>
                        <input type="number" class="round-bonus" data-round="${round}" 
                               min="1" max="45" placeholder="B" 
                               style="width: 50px; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;">
                    </div>
                </div>
            </div>
        `;
    }

    html += `
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="closeUpdateModal()" style="padding: 10px 20px;">
                취소
            </button>
            <button class="btn btn-primary" onclick="generateUpdateCSV()" style="padding: 10px 20px;">
                CSV 생성 및 다운로드
            </button>
        </div>
    `;

    modalContent.innerHTML = html;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeUpdateModal();
        }
    });
}

/**
 * 업데이트 모달 닫기
 */
function closeUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * 업데이트된 CSV 생성 및 다운로드
 */
function generateUpdateCSV() {
    const roundsData = [];
    const inputGroups = document.querySelectorAll('.round-input-group');

    inputGroups.forEach(group => {
        const roundInput = group.querySelector('.round-date');
        const round = parseInt(roundInput.dataset.round);
        const date = roundInput.value.trim();

        const numbers = [];
        for (let i = 1; i <= 6; i++) {
            const numInput = group.querySelector(`.round-number[data-index="${i}"]`);
            const num = parseInt(numInput.value);
            if (!num || num < 1 || num > 45) {
                showMessage(`${round}회차의 ${i}번째 번호를 올바르게 입력해주세요. (1-45)`, 'error');
                return;
            }
            numbers.push(num);
        }

        const bonusInput = group.querySelector('.round-bonus');
        const bonus = parseInt(bonusInput.value);
        if (!bonus || bonus < 1 || bonus > 45) {
            showMessage(`${round}회차의 보너스 번호를 올바르게 입력해주세요. (1-45)`, 'error');
            return;
        }

        if (!date || !/^\d{4}\.\d{2}\.\d{2}$/.test(date)) {
            showMessage(`${round}회차의 날짜를 올바르게 입력해주세요. (YYYY.MM.DD 형식)`, 'error');
            return;
        }

        // 중복 번호 체크
        const allNumbers = [...numbers, bonus];
        if (new Set(allNumbers).size !== allNumbers.length) {
            showMessage(`${round}회차에 중복된 번호가 있습니다.`, 'error');
            return;
        }

        // 번호 정렬 (보너스 제외)
        numbers.sort((a, b) => a - b);

        roundsData.push({
            round: round,
            date: date,
            numbers: numbers,
            bonus: bonus
        });
    });

    // 기존 CSV 데이터 가져오기
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) {
        showMessage('기존 데이터를 찾을 수 없습니다.', 'error');
        return;
    }

    // 기존 CSV 헤더와 데이터
    const header = '회차,날짜,번호1,번호2,번호3,번호4,번호5,번호6,보너스\n';
    let csvContent = header;

    // 기존 데이터 추가
    analyzer.data.forEach(row => {
        csvContent += `${row.round},${row.date},${row.numbers.join(',')},${row.bonus}\n`;
    });

    // 새 데이터 추가 (회차 순으로 정렬)
    roundsData.sort((a, b) => a.round - b.round);
    roundsData.forEach(row => {
        csvContent += `${row.round},${row.date},${row.numbers.join(',')},${row.bonus}\n`;
    });

    // CSV 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = 'lotto_data.csv';

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showMessage(`${roundsData.length}개 회차 데이터가 포함된 CSV 파일이 다운로드되었습니다.`, 'success');
    closeUpdateModal();

    // 파일 다운로드 후 페이지 새로고침 안내
    setTimeout(() => {
        if (confirm('새 CSV 파일을 data 폴더에 저장하셨나요? 저장하셨다면 페이지를 새로고침하여 업데이트된 데이터를 로드할 수 있습니다.')) {
            location.reload();
        }
    }, 1000);
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
        'mathConstants': '수학적 상수 분석 (e, π, φ)',
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
    const methodName = getMethodName(method);
    const nextRoundInfoEl = document.getElementById('next-round-info');
    if (nextRoundInfoEl) {
        nextRoundInfoEl.innerHTML = `
            <span style="font-size: 0.875rem; font-weight: 600; color: #004EA2;">${nextRound}회차</span>
        `;
    }
    updateDataInfo();

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

    // 다음 회차 자동 계산
    let nextRoundInfo;
    if (typeof getNextRoundInfo !== 'undefined') {
        nextRoundInfo = getNextRoundInfo(analyzer);
    }
    const nextRound = nextRoundInfo ? nextRoundInfo.nextRound : lastRound + 1;

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

    const methodName = getMethodName(method);
    const nextRoundInfoEl = document.getElementById('next-round-info');
    if (nextRoundInfoEl) {
        let drawDateInfo = '';
        if (nextRoundInfo) {
            if (nextRoundInfo.isDrawToday) {
                drawDateInfo = '<br><span style="font-size: 0.8rem; color: #dc3545; font-weight: 600;">🎯 오늘 추첨일입니다!</span>';
            } else {
                drawDateInfo = `<br><span style="font-size: 0.8rem; color: #64748b;">📅 추첨일: ${nextRoundInfo.nextDrawDate} (${nextRoundInfo.daysUntilDraw}일 후)</span>`;
            }
        }
        nextRoundInfoEl.innerHTML = `
            <span style="font-size: 1.1rem; font-weight: 600; color: #1e40af;">${nextRound}회차 예측</span><br>
            <span style="font-size: 0.9rem; color: #64748b;">${methodName} | 최근 ${rounds}회차 데이터 사용</span>
            ${drawDateInfo}
        `;
    }
    updateDataInfo();

    displayPredictions(currentAnalysis, predictCount);
    displayWeights(currentAnalysis);
    displayScoresChart(currentAnalysis);
}

/**
 * Run analysis by selected method
 */
function runAnalysisByMethod(method, upToRound, rounds) {
    switch (method) {
        case 'entropy':
            return runEntropyAnalysis(upToRound, rounds);
        case 'topsis':
            return runTOPSISAnalysis(upToRound, rounds);
        case 'randomForest':
            return runRandomForestAnalysis(upToRound, rounds);
        case 'association':
            return runAssociationAnalysis(upToRound, rounds);
        case 'mathConstants':
            return runMathConstantsAnalysis(upToRound, rounds);
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
 * Run Mathematical Constants analysis (e, π, φ, etc.)
 * v2: 동적 특성 강화 버전
 */
function runMathConstantsAnalysis(upToRound, rounds) {
    const analysisData = analyzer.data.filter(d => d.round <= upToRound);

    // 수학적 상수 분석 실행
    const mathScores = MathConstantsAnalysis.analyze(analysisData, rounds);

    // 결과를 표준 형식으로 변환
    const result = MathConstantsAnalysis.formatResults(mathScores);

    // 수학적 상수 분석 방법들의 가중치 표시를 위한 정보 추가
    const methods = MathConstantsAnalysis.getMethods();
    const methodWeights = {
        // 동적 특성 (70%)
        exponentialDecay: 0.15,
        piCyclePhase: 0.12,
        goldenInterval: 0.10,
        harmonicPrediction: 0.12,
        eBasedMomentum: 0.08,
        logarithmicTrend: 0.08,
        sqrtVariance: 0.05,
        // 혼합 특성 (30%)
        fibonacciCorrelation: 0.10,
        primeBalance: 0.10,
        benfordDeviation: 0.10
    };

    return {
        predictions: result.predictions,
        weights: Object.values(methodWeights),
        weightMap: methodWeights,
        featureNames: Object.keys(methods),
        analyzedRound: upToRound,
        dataCount: analysisData.length,
        method: 'Mathematical Constants v2',
        methodDetails: methods
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

    // 컴팩트 그리드로 모든 번호 표시
    const grid = document.createElement('div');
    grid.className = 'prediction-grid-compact';
    grid.style.cssText = 'gap: 8px;';

    predictions.forEach((pred, idx) => {
        const item = createPredictionItem(pred, idx + 1, idx < 6);
        grid.appendChild(item);
    });

    container.appendChild(grid);
}

/**
 * Create a prediction item element (ultra compact version)
 */
function createPredictionItem(pred, displayRank, isTop6) {
    const item = document.createElement('div');
    item.className = 'prediction-item';
    item.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 4px 2px;
        background: ${isTop6 ? '#E6F2FF' : '#ffffff'};
        border: ${isTop6 ? '2px solid #004EA2' : '1px solid #e2e8f0'};
        border-radius: 4px;
        transition: all 0.2s ease;
    `;

    const ball = document.createElement('div');
    ball.className = `prediction-number lotto-ball ${getBallColorClass(pred.number)}`;
    ball.textContent = pred.number;
    ball.style.cssText = `
        font-size: 0.75rem;
        font-weight: 700;
        width: 32px;
        height: 32px;
        line-height: 32px;
    `;

    const rank = document.createElement('div');
    rank.style.cssText = `
        font-size: 0.6rem;
        font-weight: 600;
        color: ${isTop6 ? '#004EA2' : '#64748b'};
    `;
    rank.textContent = `#${displayRank}`;

    item.appendChild(ball);
    item.appendChild(rank);

    // 호버 효과
    if (window.matchMedia('(hover: hover)').matches) {
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#004EA2';
            item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = isTop6 ? '#004EA2' : '#e2e8f0';
            item.style.boxShadow = 'none';
        });
    }

    return item;
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
        'meanReversion': '평균 회귀',
        // 수학적 상수 분석 특성 v2
        'exponentialDecay': 'e 기반 지수 감쇠',
        'piCyclePhase': 'π 주기 위상',
        'goldenInterval': '황금 간격 (φ)',
        'harmonicPrediction': '조화 평균 예측',
        'eBasedMomentum': 'e 모멘텀',
        'logarithmicTrend': '로그 트렌드',
        'sqrtVariance': '√n 분산',
        'fibonacciCorrelation': '피보나치 상관',
        'primeBalance': '소수 균형',
        'benfordDeviation': '벤포드 편차'
    };

    analysis.featureNames.forEach((name, idx) => {
        const weight = analysis.weights[idx] || 0;
        const label = featureLabels[name] || name;

        const item = document.createElement('div');
        item.className = 'weight-item';
        item.style.cssText = 'margin-bottom: 6px;';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'weight-label';
        labelDiv.style.cssText = 'font-size: 0.7rem; margin-bottom: 3px;';
        labelDiv.textContent = label;

        const bar = document.createElement('div');
        bar.className = 'weight-bar';
        bar.style.cssText = 'height: 18px;';

        const fill = document.createElement('div');
        fill.className = 'weight-fill';
        fill.style.cssText = `width: ${weight * 100}%; height: 18px; padding-right: 4px; font-size: 0.65rem;`;

        const value = document.createElement('span');
        value.className = 'weight-value';
        value.style.cssText = 'font-size: 0.65rem;';
        value.textContent = `${(weight * 100).toFixed(0)}%`;
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
 * Toggle backtest mode UI
 */
function toggleBacktestMode() {
    const mode = document.getElementById('backtest-mode').value;
    const wfConfig = document.getElementById('walkforward-config');

    if (mode === 'walkforward') {
        wfConfig.style.display = 'block';
    } else {
        wfConfig.style.display = 'none';
    }
}

/**
 * Run backtest (standard or walk-forward)
 */
function runBacktest() {
    if (!backtester || !analyzer) {
        alert('데이터가 로드되지 않았습니다.');
        return;
    }

    const mode = document.getElementById('backtest-mode').value;

    if (mode === 'walkforward') {
        runWalkForwardBacktest();
    } else {
        runStandardBacktest();
    }
}

/**
 * Run standard backtest
 */
function runStandardBacktest() {
    const startRound = parseInt(document.getElementById('backtest-start').value);
    const endRound = parseInt(document.getElementById('backtest-end').value);
    const topN = parseInt(document.getElementById('backtest-topn').value);
    const method = getSelectedBacktestMethod();
    const rounds = analyzer.params.recentWindow || 50;

    if (startRound >= endRound) {
        alert('시작 회차는 종료 회차보다 작아야 합니다.');
        return;
    }

    console.log(`Running standard backtest: ${startRound} - ${endRound} with method: ${method}`);

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
 * Run Walk-Forward backtest
 */
function runWalkForwardBacktest() {
    if (typeof WalkForwardBacktester === 'undefined') {
        alert('Walk-Forward 백테스터 모듈이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        return;
    }

    const method = getSelectedBacktestMethod();
    const rounds = analyzer.params.recentWindow || 50;
    const trainSize = parseInt(document.getElementById('wf-train-size').value) || 100;
    const testSize = parseInt(document.getElementById('wf-test-size').value) || 50;
    const windowType = document.getElementById('wf-window-type').value || 'rolling';

    console.log(`Running Walk-Forward backtest with method: ${method}, trainSize: ${trainSize}, testSize: ${testSize}`);

    // Walk-Forward 설정
    const config = {
        trainSize: trainSize,
        testSize: testSize,
        stepSize: 1,
        windowType: windowType,
        minTrainSize: 50
    };

    // Walk-Forward 백테스터 생성
    const wfBacktester = new WalkForwardBacktester(analyzer.data, config);

    // 진행율 표시 시작
    showProgress(true, {
        message: `Walk-Forward 백테스팅 진행 중...`,
        progress: 0,
        current: 0,
        total: 100,
        detail: '초기화 중...'
    });

    // 전략 함수 생성
    const strategyFunction = (trainData, testRounds) => {
        // trainData의 마지막 회차까지로 분석
        const lastTrainRound = trainData[trainData.length - 1].round;
        const analysis = runAnalysisByMethod(method, lastTrainRound, rounds);

        // 상위 10개 번호 반환
        return analysis.predictions.slice(0, 10).map(p => p.number);
    };

    // 진행율 콜백
    const progressCallback = (progress, current, total, detail) => {
        updateProgress({
            message: `Walk-Forward 백테스팅 진행 중...`,
            progress: progress,
            current: current,
            total: total,
            detail: detail
        });
    };

    try {
        const wfResult = wfBacktester.run(strategyFunction, progressCallback);

        // 결과를 기존 백테스트 형식으로 변환
        const allResults = [];
        wfResult.foldResults.forEach(fold => {
            if (fold.results && fold.results.length > 0) {
                fold.results.forEach(result => {
                    allResults.push({
                        round: result.round,
                        predicted: result.predicted,
                        actual: result.actual,
                        bonus: result.bonus,
                        hits: result.hits,
                        bonusHit: result.predicted.includes(result.bonus),
                        actualRanks: result.actualRanks,
                        avgRank: result.avgRank,
                        top6Accuracy: result.hits / 6,
                        method: method
                    });
                });
            }
        });

        // metrics.js를 사용한 상세 지표 계산
        let detailedMetrics = null;
        if (typeof calculateMetrics !== 'undefined') {
            detailedMetrics = calculateMetrics(allResults);
        }

        // 기존 백테스트 결과 형식으로 변환
        currentBacktest = {
            results: allResults,
            statistics: detailedMetrics || wfResult.aggregateMetrics,
            topN: 10,
            totalRounds: allResults.length,
            method: method,
            wfResult: wfResult,
            isWalkForward: true
        };

    } catch (error) {
        showProgress(false);
        showMessage(`Walk-Forward 백테스트 중 오류 발생: ${error.message}`, 'error');
        console.error('Walk-Forward backtest error:', error);
        return;
    }

    // 진행율 표시 종료
    showProgress(false);

    displayBacktestStats(currentBacktest);
    displayBacktestChart(currentBacktest);
    displayHitDistribution(currentBacktest);
    displayBacktestTable(currentBacktest);

    showMessage(`Walk-Forward 백테스트가 완료되었습니다. (${wfResult.totalFolds}개 폴드)`, 'success');
}

/**
 * Display backtest statistics with improved UX
 */
function displayBacktestStats(backtest) {
    const container = document.getElementById('backtest-stats');
    container.innerHTML = '';

    const stats = backtest.statistics;
    const methodName = getMethodName(backtest.method) || backtest.method || '알 수 없음';
    const isWalkForward = backtest.isWalkForward || false;

    // 주요 성과 카드 (강조)
    const mainStats = document.createElement('div');
    mainStats.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;';

    const createStatCard = (label, value, description, highlight = false, color = '#3b82f6') => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: ${highlight ? `linear-gradient(135deg, ${color}15, ${color}25)` : '#ffffff'};
            border: ${highlight ? `2px solid ${color}` : '1px solid #e2e8f0'};
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        `;

        const valueDiv = document.createElement('div');
        valueDiv.style.cssText = `
            font-size: 2rem;
            font-weight: 700;
            color: ${color};
            margin-bottom: 8px;
        `;
        valueDiv.textContent = value;

        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = `
            font-size: 1rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
        `;
        labelDiv.textContent = label;

        const descDiv = document.createElement('div');
        descDiv.style.cssText = `
            font-size: 0.8rem;
            color: #64748b;
            line-height: 1.4;
        `;
        descDiv.textContent = description;

        card.appendChild(valueDiv);
        card.appendChild(labelDiv);
        if (description) card.appendChild(descDiv);

        return card;
    };

    // 평균 적중 개수 (가장 중요)
    const avgHits = stats.averageHits ? stats.averageHits.toFixed(2) : 'N/A';
    const avgHitsDesc = avgHits !== 'N/A' ? `무작위 선택 대비 ${(avgHits / 0.133).toFixed(1)}배` : '';
    mainStats.appendChild(createStatCard(
        '평균 적중 개수',
        avgHits !== 'N/A' ? avgHits + '개' : 'N/A',
        avgHitsDesc,
        true,
        '#10b981'
    ));

    // 3개 이상 적중률
    let hit3Rate, hit3Desc, hit3Lift;
    if (stats.hitRates && stats.hitRates[3] !== undefined) {
        hit3Rate = (stats.hitRates[3] * 100).toFixed(1);
        hit3Lift = stats.lifts && stats.lifts[3] ? stats.lifts[3] : null;
        hit3Desc = hit3Lift ? `무작위 대비 ${hit3Lift.toFixed(1)}배 높음` : '';
    } else if (stats.hit3PlusRate !== undefined) {
        hit3Rate = (stats.hit3PlusRate * 100).toFixed(1);
        hit3Desc = '3개 이상 맞춘 비율';
    } else {
        hit3Rate = 'N/A';
        hit3Desc = '';
    }
    mainStats.appendChild(createStatCard(
        '3개 이상 적중률',
        hit3Rate !== 'N/A' ? hit3Rate + '%' : 'N/A',
        hit3Desc,
        false,
        '#3b82f6'
    ));

    // 최대 적중 개수
    const maxHits = stats.maxHits !== undefined ? stats.maxHits : 'N/A';
    const maxHitsDesc = maxHits !== 'N/A' ? '한 번에 맞춘 최대 개수' : '';
    mainStats.appendChild(createStatCard(
        '최대 적중 개수',
        maxHits !== 'N/A' ? maxHits + '개' : 'N/A',
        maxHitsDesc,
        false,
        '#f59e0b'
    ));

    // 총 테스트 회차
    const totalRounds = stats.totalRounds || backtest.totalRounds || 0;
    mainStats.appendChild(createStatCard(
        '테스트 회차',
        totalRounds + '회',
        `총 ${totalRounds}회의 회차로 검증`,
        false,
        '#6366f1'
    ));

    container.appendChild(mainStats);

    // 상세 지표 섹션
    const detailSection = document.createElement('div');
    detailSection.style.cssText = 'background: #f8fafc; padding: 16px; border-radius: 12px; margin-top: 16px;';

    const detailHeader = document.createElement('h3');
    detailHeader.style.cssText = 'margin: 0 0 12px 0; font-size: 1rem; color: #475569;';
    detailHeader.textContent = '📈 상세 성과 지표';
    detailSection.appendChild(detailHeader);

    const detailGrid = document.createElement('div');
    detailGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;';

    const detailStats = [];

    // 4개 이상 적중률
    if (stats.hitRates && stats.hitRates[4] !== undefined) {
        const hit4Rate = (stats.hitRates[4] * 100).toFixed(2);
        const hit4Lift = stats.lifts && stats.lifts[4] ? stats.lifts[4].toFixed(1) : '';
        detailStats.push({ label: '4개 이상 적중', value: `${hit4Rate}%`, desc: hit4Lift ? `리프트 ${hit4Lift}x` : '' });
    }

    // 평균 순위
    if (stats.averageRank !== undefined && stats.averageRank !== null) {
        detailStats.push({ label: '평균 예측 순위', value: stats.averageRank.toFixed(1) + '위', desc: '낮을수록 좋음 (1위가 최고)' });
    }

    // 안정성 지수
    if (stats.sharpeLikeRatio !== undefined) {
        detailStats.push({ label: '안정성 지수', value: stats.sharpeLikeRatio.toFixed(2), desc: '높을수록 일관적' });
    }

    // 최대 연속 실패
    if (stats.drawdown !== undefined) {
        detailStats.push({ label: '최대 연속 실패', value: `${stats.drawdown}회차`, desc: '3개 미만 적중 연속 기간' });
    }

    // 보너스 적중률
    if (stats.bonusHitRate !== undefined) {
        detailStats.push({ label: '보너스 적중률', value: `${(stats.bonusHitRate * 100).toFixed(1)}%`, desc: '' });
    }

    // 백테스트 모드 및 분석 방법
    detailStats.push({ label: '테스트 방식', value: isWalkForward ? 'Walk-Forward' : '표준', desc: isWalkForward ? '시계열 검증' : '일반 검증' });
    detailStats.push({ label: '분석 방법', value: methodName, desc: '' });

    detailStats.forEach(stat => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        `;

        const valueDiv = document.createElement('div');
        valueDiv.style.cssText = 'font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 4px;';
        valueDiv.textContent = stat.value;

        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'font-size: 0.85rem; color: #64748b; margin-bottom: 2px;';
        labelDiv.textContent = stat.label;

        if (stat.desc) {
            const descDiv = document.createElement('div');
            descDiv.style.cssText = 'font-size: 0.75rem; color: #94a3b8;';
            descDiv.textContent = stat.desc;
            card.appendChild(descDiv);
        }

        card.appendChild(labelDiv);
        card.appendChild(valueDiv);
        detailGrid.appendChild(card);
    });

    detailSection.appendChild(detailGrid);
    container.appendChild(detailSection);
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
 * Run strategy optimization
 */
function runOptimization() {
    if (typeof StrategyOptimizer === 'undefined') {
        alert('최적화 모듈이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        return;
    }

    if (!analyzer || !backtester) {
        alert('데이터가 로드되지 않았습니다.');
        return;
    }

    // 설정 읽기
    const metric = document.getElementById('opt-metric').value;
    const startRound = parseInt(document.getElementById('opt-backtest-start').value);
    const endRound = parseInt(document.getElementById('opt-backtest-end').value);
    const method = getSelectedBacktestMethod();

    // 선택된 윈도우 크기
    const windowCheckboxes = document.querySelectorAll('input[name="opt-window"]:checked');
    if (windowCheckboxes.length === 0) {
        alert('최소 하나의 윈도우 크기를 선택해주세요.');
        return;
    }
    const windowSizes = Array.from(windowCheckboxes).map(cb => parseInt(cb.value));

    // 파라미터 그리드 생성
    const paramGrid = {
        recentWindow: windowSizes
    };

    console.log(`최적화 시작: 지표=${metric}, 윈도우=${windowSizes.join(',')}, 범위=${startRound}-${endRound}`);

    // 진행율 표시
    showProgress(true, {
        message: '파라미터 최적화 진행 중...',
        progress: 0,
        detail: '초기화 중...'
    });

    // 백테스트 함수 생성
    const backtestFunction = (params) => {
        const rounds = params.recentWindow;

        // 분석 함수
        const analysisFunction = (upToRound) => {
            return runAnalysisByMethod(method, upToRound, rounds);
        };

        // 백테스트 실행
        const result = backtester.run(startRound, endRound, 10, method, analysisFunction, null);

        // metrics.js로 상세 지표 계산
        if (typeof calculateMetrics !== 'undefined' && result.results) {
            const detailedMetrics = calculateMetrics(result.results);
            result.statistics = { ...result.statistics, ...detailedMetrics };
        }

        return result;
    };

    // 최적화 실행
    const optimizer = new StrategyOptimizer(backtestFunction, paramGrid);

    const progressCallback = (progress, current, total, detail) => {
        updateProgress({
            message: '파라미터 최적화 진행 중...',
            progress: progress,
            current: current,
            total: total,
            detail: detail
        });
    };

    try {
        const optimizationResult = optimizer.optimize(
            { metric: metric, verbose: false },
            progressCallback
        );

        showProgress(false);

        // 결과 표시
        displayOptimizationResults(optimizationResult);

        showMessage(`최적화가 완료되었습니다! 최적 윈도우: ${optimizationResult.bestParams.recentWindow}회차`, 'success');

    } catch (error) {
        showProgress(false);
        showMessage(`최적화 중 오류 발생: ${error.message}`, 'error');
        console.error('Optimization error:', error);
    }
}

/**
 * Display optimization results
 */
function displayOptimizationResults(result) {
    const container = document.getElementById('optimization-results');
    container.innerHTML = '';

    if (!result || !result.bestParams) {
        container.innerHTML = '<p style="color: #ef4444;">최적화 결과가 없습니다.</p>';
        return;
    }

    // 최적 파라미터 카드
    const bestCard = document.createElement('div');
    bestCard.style.cssText = `
        background: linear-gradient(135deg, #dbeafe, #bfdbfe);
        border: 2px solid #3b82f6;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    `;
    bestCard.innerHTML = `
        <h3 style="margin: 0 0 12px 0; color: #1e40af;">🏆 최적 파라미터</h3>
        <div style="font-size: 1.1rem; margin-bottom: 8px;">
            <strong>분석 윈도우:</strong> ${result.bestParams.recentWindow}회차
        </div>
        <div style="font-size: 1.1rem; margin-bottom: 8px;">
            <strong>최적 점수 (${result.metric}):</strong> ${result.bestScore.toFixed(4)}
        </div>
        <div style="font-size: 0.9rem; color: #64748b;">
            총 ${result.totalCombinations}개 조합 탐색 완료
        </div>
    `;
    container.appendChild(bestCard);

    // 상위 5개 결과 테이블
    const tableCard = document.createElement('div');
    tableCard.style.cssText = `
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    `;
    tableCard.innerHTML = `
        <h3 style="margin: 0 0 16px 0;">상위 5개 결과</h3>
        <div class="table-wrapper">
            <table class="backtest-table">
                <thead>
                    <tr>
                        <th>순위</th>
                        <th>윈도우 크기</th>
                        <th>${result.metric}</th>
                        <th>3개+ 적중률</th>
                        <th>평균 적중</th>
                        <th>리프트 (3개+)</th>
                    </tr>
                </thead>
                <tbody id="opt-results-tbody">
                </tbody>
            </table>
        </div>
    `;
    container.appendChild(tableCard);

    const tbody = document.getElementById('opt-results-tbody');
    const top5 = result.allResults.slice(0, 5);
    top5.forEach((item, idx) => {
        if (item.error) return;

        const metrics = item.metrics || {};
        const row = document.createElement('tr');
        row.style.cssText = idx === 0 ? 'background: #f0f9ff;' : '';
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${item.params.recentWindow}회차</td>
            <td><strong>${item.score.toFixed(4)}</strong></td>
            <td>${metrics.hit_rate_3 ? (metrics.hit_rate_3 * 100).toFixed(2) + '%' : 'N/A'}</td>
            <td>${metrics.average_hits ? metrics.average_hits.toFixed(2) : 'N/A'}</td>
            <td>${metrics.lift_3 ? metrics.lift_3.toFixed(2) + 'x' : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });

    // 파라미터 민감도 분석
    if (result.paramSensitivity && Object.keys(result.paramSensitivity).length > 0) {
        const sensitivityCard = document.createElement('div');
        sensitivityCard.style.cssText = `
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
        `;

        let sensitivityHTML = '<h3 style="margin: 0 0 16px 0;">📊 파라미터 민감도 분석</h3>';

        Object.keys(result.paramSensitivity).forEach(paramName => {
            const sens = result.paramSensitivity[paramName];
            sensitivityHTML += `
                <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                    <strong>${paramName === 'recentWindow' ? '분석 윈도우 크기' : paramName}</strong>
                    <div style="margin-top: 8px; font-size: 0.9rem;">
                        최적값: <strong>${sens.bestValue}</strong> (점수: ${sens.valueScores[sens.bestValue].mean.toFixed(4)})<br>
                        범위: ${sens.range.toFixed(4)} (상대 범위: ${(sens.relativeRange * 100).toFixed(1)}%)
                    </div>
                    <div style="margin-top: 8px;">
                        ${Object.keys(sens.valueScores).map(value => {
                const vs = sens.valueScores[value];
                return `${value}: ${vs.mean.toFixed(4)} (σ=${vs.std.toFixed(4)}, n=${vs.count})`;
            }).join(', ')}
                    </div>
                </div>
            `;
        });

        sensitivityCard.innerHTML = sensitivityHTML;
        container.appendChild(sensitivityCard);
    }
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
 * 조합 일치 테스트 실행 (범위 테스트)
 * 시작~종료 회차 범위에서 각 회차까지의 데이터로 분석하여 조합을 생성하고,
 * 다음 회차 당첨번호와 일치하는 조합이 나올 때까지 시도 횟수를 계산
 */
function runComboMatchTest() {
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) {
        alert('데이터가 로드되지 않았습니다.');
        return;
    }

    const startRound = parseInt(document.getElementById('combo-test-start').value);
    const endRound = parseInt(document.getElementById('combo-test-end').value);
    const topN = parseInt(document.getElementById('combo-test-topn').value);
    const maxAttempts = parseInt(document.getElementById('combo-test-max').value);
    const targetHits = parseInt(document.getElementById('combo-test-target').value);
    const method = document.getElementById('combo-test-method').value;

    if (startRound >= endRound) {
        alert('시작 회차는 종료 회차보다 작아야 합니다.');
        return;
    }

    // 종료 회차 다음 데이터 확인
    const lastTestRound = endRound;
    const nextRoundData = analyzer.data.find(d => d.round === lastTestRound + 1);

    if (!nextRoundData) {
        alert(`${lastTestRound + 1}회차 데이터가 없습니다. 종료 회차를 조정해주세요.`);
        return;
    }

    const totalRounds = endRound - startRound + 1;

    // 결과 표시 영역
    const resultsContainer = document.getElementById('combo-test-results');
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="loading-spinner"></div>
            <p style="margin-top: 10px; color: var(--text-secondary);">조합 일치 테스트 진행 중...</p>
            <p id="combo-test-progress" style="font-size: 0.875rem; color: #64748b;">0 / ${totalRounds} 회차 테스트 중</p>
        </div>
    `;

    // 진행 표시
    showProgress(true, {
        message: '조합 일치 테스트 진행 중...',
        progress: 0,
        detail: `${startRound}~${endRound}회차 테스트 준비 중...`
    });

    // 비동기로 실행 (UI 블로킹 방지)
    setTimeout(async () => {
        try {
            const results = await executeComboMatchTestRange(startRound, endRound, topN, maxAttempts, targetHits, method);
            showProgress(false);
            displayComboMatchResultsRange(results, startRound, endRound, targetHits, method);
        } catch (error) {
            showProgress(false);
            resultsContainer.innerHTML = `
                <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #dc2626;">
                    <strong>오류 발생:</strong> ${error.message}
                </div>
            `;
        }
    }, 100);
}

/**
 * 범위 테스트 실행
 */
async function executeComboMatchTestRange(startRound, endRound, topN, maxAttempts, targetHits, method) {
    const rounds = analyzer.params.recentWindow || 50;
    const results = {
        roundResults: [],
        summary: {
            totalRounds: 0,
            successCount: 0,
            totalAttempts: 0,
            avgAttempts: 0,
            avgBestHits: 0,
            hitDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            firstMatchAvg: { 3: [], 4: [], 5: [], 6: [] },
            poolMatchAvg: 0
        },
        method: method,
        topN: topN,
        maxAttempts: maxAttempts
    };

    const totalRounds = endRound - startRound + 1;
    const progressEl = document.getElementById('combo-test-progress');

    for (let testRound = startRound; testRound <= endRound; testRound++) {
        const currentIdx = testRound - startRound + 1;

        // 진행 상황 업데이트
        if (progressEl) {
            progressEl.textContent = `${currentIdx} / ${totalRounds} 회차 테스트 중 (${testRound}회차)`;
        }
        updateProgress({
            progress: (currentIdx / totalRounds) * 100,
            detail: `${testRound}회차 테스트 중... (${currentIdx}/${totalRounds})`
        });

        // 다음 회차 데이터 확인
        const nextRound = testRound + 1;
        const actualData = analyzer.data.find(d => d.round === nextRound);

        if (!actualData) {
            continue;
        }

        const actualNumbers = actualData.numbers;

        // 분석 실행
        const analysis = runAnalysisByMethod(method, testRound, rounds);

        if (!analysis || !analysis.predictions) {
            continue;
        }

        // 상위 N개 번호 추출
        const topNumbers = analysis.predictions.slice(0, topN).map(p => p.number);

        // 번호 풀과 실제 당첨번호 일치 개수
        const poolMatches = topNumbers.filter(n => actualNumbers.includes(n)).length;

        // 단일 회차 테스트 실행
        const roundResult = executeSingleRoundTest(topNumbers, actualNumbers, maxAttempts, targetHits);
        roundResult.round = testRound;
        roundResult.nextRound = nextRound;
        roundResult.actualNumbers = actualNumbers;
        roundResult.topNumbers = topNumbers;
        roundResult.poolMatches = poolMatches;

        results.roundResults.push(roundResult);

        // 요약 통계 업데이트
        results.summary.totalRounds++;
        if (roundResult.found) {
            results.summary.successCount++;
        }
        results.summary.totalAttempts += roundResult.attempts;
        results.summary.avgBestHits += roundResult.bestHits;
        results.summary.poolMatchAvg += poolMatches;

        // 히트 분포 누적
        for (let h = 0; h <= 6; h++) {
            results.summary.hitDistribution[h] += roundResult.hitDistribution[h];
        }

        // 첫 매치 시점 기록
        for (let h = 3; h <= 6; h++) {
            if (roundResult.firstMatchByHits[h] > 0) {
                results.summary.firstMatchAvg[h].push(roundResult.firstMatchByHits[h]);
            }
        }

        // UI 업데이트를 위한 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 평균 계산
    if (results.summary.totalRounds > 0) {
        results.summary.avgAttempts = results.summary.totalAttempts / results.summary.totalRounds;
        results.summary.avgBestHits = results.summary.avgBestHits / results.summary.totalRounds;
        results.summary.poolMatchAvg = results.summary.poolMatchAvg / results.summary.totalRounds;
    }

    return results;
}

/**
 * 단일 회차 조합 일치 테스트 (범위 테스트용)
 */
function executeSingleRoundTest(topNumbers, actualNumbers, maxAttempts, targetHits) {
    // 결과 저장
    const results = {
        attempts: 0,
        found: false,
        foundAttempt: -1,
        bestHits: 0,
        bestCombination: null,
        hitDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        firstMatchByHits: { 3: -1, 4: -1, 5: -1, 6: -1 }
    };

    // 조합 생성 및 테스트
    for (let i = 0; i < maxAttempts; i++) {
        results.attempts++;

        // 무작위 조합 생성 (topNumbers에서 6개 선택)
        const combination = generateRandomCombination(topNumbers);

        // 일치 개수 계산
        const hits = countMatches(combination, actualNumbers);

        // 히트 분포 업데이트
        results.hitDistribution[hits]++;

        // 최고 기록 갱신
        if (hits > results.bestHits) {
            results.bestHits = hits;
            results.bestCombination = [...combination];
        }

        // 각 일치 개수별 첫 번째 발생 기록
        if (hits >= 3 && results.firstMatchByHits[3] === -1) {
            results.firstMatchByHits[3] = i + 1;
        }
        if (hits >= 4 && results.firstMatchByHits[4] === -1) {
            results.firstMatchByHits[4] = i + 1;
        }
        if (hits >= 5 && results.firstMatchByHits[5] === -1) {
            results.firstMatchByHits[5] = i + 1;
        }
        if (hits >= 6 && results.firstMatchByHits[6] === -1) {
            results.firstMatchByHits[6] = i + 1;
        }

        // 목표 달성 확인
        if (hits >= targetHits) {
            results.found = true;
            results.foundAttempt = i + 1;
            results.bestCombination = [...combination];
            break;
        }
    }

    return results;
}

/**
 * topNumbers에서 6개를 무작위로 선택하여 조합 생성
 */
function generateRandomCombination(numbers) {
    const shuffled = [...numbers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6).sort((a, b) => a - b);
}

/**
 * 두 배열 간의 일치 개수 계산
 */
function countMatches(arr1, arr2) {
    return arr1.filter(n => arr2.includes(n)).length;
}

/**
 * 범위 조합 일치 테스트 결과 표시
 */
function displayComboMatchResultsRange(results, startRound, endRound, targetHits, method) {
    const resultsContainer = document.getElementById('combo-test-results');

    const hitLabels = { 3: '5등', 4: '4등', 5: '3등', 6: '1등' };
    const successRate = results.summary.totalRounds > 0
        ? (results.summary.successCount / results.summary.totalRounds * 100).toFixed(1)
        : 0;

    // 각 일치 개수별 평균 시도 횟수 계산
    const avgFirstMatch = {};
    for (let h = 3; h <= 6; h++) {
        const arr = results.summary.firstMatchAvg[h];
        avgFirstMatch[h] = arr.length > 0
            ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
            : -1;
    }

    let html = `
        <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: var(--primary-color);">📊 범위 테스트 결과 (${startRound}~${endRound}회차)</h3>
            
            <!-- 테스트 정보 -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                    <div>
                        <strong style="color: var(--text-secondary);">테스트 회차:</strong>
                        <span style="color: var(--primary-color); font-weight: 600;">${startRound}~${endRound}회 (${results.summary.totalRounds}개)</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">분석 방법:</strong>
                        <span style="color: var(--primary-color);">${getMethodName(method)}</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">예측 번호 풀:</strong>
                        <span style="color: var(--primary-color);">상위 ${results.topN}개</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">회차당 시도:</strong>
                        <span style="color: var(--primary-color);">${results.maxAttempts.toLocaleString()}회</span>
                    </div>
                </div>
            </div>
            
            <!-- 주요 통계 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div style="background: ${successRate > 0 ? '#dcfce7' : '#fef3c7'}; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${successRate > 0 ? '#16a34a' : '#d97706'};">
                        ${successRate}%
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">목표 달성률</div>
                    <div style="font-size: 0.75rem; color: #64748b;">(${results.summary.successCount}/${results.summary.totalRounds})</div>
                </div>
                <div style="background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">
                        ${Math.round(results.summary.avgAttempts).toLocaleString()}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">평균 시도 횟수</div>
                </div>
                <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #16a34a;">
                        ${results.summary.avgBestHits.toFixed(1)}개
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">평균 최대 일치</div>
                </div>
                <div style="background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">
                        ${results.summary.poolMatchAvg.toFixed(1)}개
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">번호풀 평균일치</div>
                </div>
            </div>
            
            <!-- 각 일치 개수별 평균 시도 횟수 -->
            <div style="margin-bottom: 16px;">
                <strong style="color: var(--text-secondary);">일치 개수별 평균 첫 발생 시도 횟수:</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 8px;">
                    ${[3, 4, 5, 6].map(hits => {
        const avg = avgFirstMatch[hits];
        const count = results.summary.firstMatchAvg[hits].length;
        return `
                            <div style="background: ${avg > 0 ? '#dcfce7' : '#f1f5f9'}; padding: 12px; border-radius: 6px; text-align: center;">
                                <div style="font-weight: 600; color: ${avg > 0 ? '#16a34a' : '#94a3b8'};">
                                    ${hits}개+ (${hitLabels[hits] || ''})
                                </div>
                                <div style="font-size: 1.125rem; font-weight: 700; color: ${avg > 0 ? '#16a34a' : '#94a3b8'};">
                                    ${avg > 0 ? avg.toLocaleString() + '회' : '-'}
                                </div>
                                <div style="font-size: 0.7rem; color: #64748b;">
                                    (${count}/${results.summary.totalRounds}회 달성)
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
            
            <!-- 전체 히트 분포 -->
            <div style="margin-bottom: 16px;">
                <strong style="color: var(--text-secondary);">전체 일치 개수 분포 (${results.summary.totalAttempts.toLocaleString()}회 시도):</strong>
                <div style="margin-top: 8px;">
                    ${[0, 1, 2, 3, 4, 5, 6].map(hits => {
        const count = results.summary.hitDistribution[hits];
        const percentage = results.summary.totalAttempts > 0 ? (count / results.summary.totalAttempts * 100).toFixed(3) : 0;
        const maxWidth = Math.max(...Object.values(results.summary.hitDistribution));
        const barWidth = maxWidth > 0 ? (count / maxWidth * 100) : 0;
        const barColor = hits >= targetHits ? '#22c55e' : '#3b82f6';
        return `
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="width: 60px; font-size: 0.875rem;">${hits}개:</span>
                                <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
                                    <div style="background: ${barColor}; height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
                                </div>
                                <span style="width: 130px; font-size: 0.75rem; text-align: right;">
                                    ${count.toLocaleString()}회 (${percentage}%)
                                </span>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
            
            <!-- 회차별 상세 결과 (접이식) -->
            <details style="margin-top: 16px;">
                <summary style="cursor: pointer; font-weight: 600; color: var(--primary-color); padding: 8px 0;">
                    📋 회차별 상세 결과 (클릭하여 펼치기)
                </summary>
                <div style="max-height: 400px; overflow-y: auto; margin-top: 12px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">회차</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">풀 일치</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">최대 일치</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">목표 달성</th>
                                <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">시도 횟수</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.roundResults.map(r => `
                                <tr style="background: ${r.found ? '#f0fdf4' : 'white'};">
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${r.round}→${r.nextRound}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${r.poolMatches}/6</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: ${r.bestHits >= 3 ? '#16a34a' : '#64748b'};">${r.bestHits}개</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${r.found ? '✅' : '❌'}</td>
                                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${r.found ? r.foundAttempt.toLocaleString() : r.attempts.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

/**
 * 단일 회차 조합 일치 테스트 결과 표시 (기존 함수 유지)
 */
function displayComboMatchResults(results, testRound, nextRound, actualNumbers, targetHits) {
    const resultsContainer = document.getElementById('combo-test-results');

    const hitLabels = { 3: '5등', 4: '4등', 5: '3등', 6: '1등' };
    const foundClass = results.found ? 'var(--success-color)' : 'var(--warning-color)';

    let html = `
        <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 16px 0; color: var(--primary-color);">📊 테스트 결과</h3>
            
            <!-- 테스트 정보 -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    <div>
                        <strong style="color: var(--text-secondary);">분석 기준 회차:</strong>
                        <span style="color: var(--primary-color); font-weight: 600;">${testRound}회차</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">실제 당첨 회차:</strong>
                        <span style="color: var(--primary-color); font-weight: 600;">${nextRound}회차</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">분석 방법:</strong>
                        <span style="color: var(--primary-color);">${getMethodName(results.method)}</span>
                    </div>
                </div>
            </div>
            
            <!-- 실제 당첨번호 -->
            <div style="margin-bottom: 16px;">
                <strong style="color: var(--text-secondary);">${nextRound}회차 실제 당첨번호:</strong>
                <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                    ${actualNumbers.map(n => `<div class="lotto-ball ${getBallColorClass(n)}" style="width: 36px; height: 36px; line-height: 36px; font-size: 0.875rem;">${n}</div>`).join('')}
                </div>
            </div>
            
            <!-- 예측 번호 풀 -->
            <div style="margin-bottom: 16px;">
                <strong style="color: var(--text-secondary);">예측 번호 풀 (상위 ${results.topNumbers.length}개):</strong>
                <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                    ${results.topNumbers.map(n => {
        const isMatch = actualNumbers.includes(n);
        return `<div class="lotto-ball ${getBallColorClass(n)}" style="width: 32px; height: 32px; line-height: 32px; font-size: 0.75rem; ${isMatch ? 'box-shadow: 0 0 0 3px #22c55e;' : 'opacity: 0.7;'}">${n}</div>`;
    }).join('')}
                </div>
                <small style="color: #64748b; display: block; margin-top: 4px;">
                    (초록색 테두리: 실제 당첨번호와 일치)
                </small>
            </div>
            
            <!-- 주요 결과 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div style="background: ${results.found ? '#dcfce7' : '#fef3c7'}; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${foundClass};">
                        ${results.found ? '✅ 성공' : '⚠️ 미달성'}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        ${targetHits}개+ 일치 목표
                    </div>
                </div>
                <div style="background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">
                        ${results.attempts.toLocaleString()}회
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">총 시도 횟수</div>
                </div>
                <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #16a34a;">
                        ${results.bestHits}개
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">최대 일치 개수</div>
                </div>
            </div>
            
            <!-- 최고 일치 조합 -->
            ${results.bestCombination ? `
            <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <strong style="color: #16a34a;">🏆 최고 일치 조합 (${results.bestHits}개 일치):</strong>
                <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                    ${results.bestCombination.map(n => {
        const isMatch = actualNumbers.includes(n);
        return `<div class="lotto-ball ${getBallColorClass(n)}" style="width: 36px; height: 36px; line-height: 36px; font-size: 0.875rem; ${isMatch ? 'box-shadow: 0 0 0 3px #22c55e;' : ''}">${n}</div>`;
    }).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- 각 일치 개수별 첫 발생 시점 -->
            <div style="margin-bottom: 16px;">
                <strong style="color: var(--text-secondary);">일치 개수별 첫 발생 시점:</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 8px;">
                    ${[3, 4, 5, 6].map(hits => {
        const attempt = results.firstMatchByHits[hits];
        return `
                            <div style="background: ${attempt > 0 ? '#dcfce7' : '#f1f5f9'}; padding: 12px; border-radius: 6px; text-align: center;">
                                <div style="font-weight: 600; color: ${attempt > 0 ? '#16a34a' : '#94a3b8'};">
                                    ${hits}개 일치 (${hitLabels[hits] || ''})
                                </div>
                                <div style="font-size: 1.125rem; font-weight: 700; color: ${attempt > 0 ? '#16a34a' : '#94a3b8'};">
                                    ${attempt > 0 ? attempt.toLocaleString() + '번째' : '-'}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
            
            <!-- 일치 개수 분포 -->
            <div>
                <strong style="color: var(--text-secondary);">일치 개수 분포:</strong>
                <div style="margin-top: 8px;">
                    ${[0, 1, 2, 3, 4, 5, 6].map(hits => {
        const count = results.hitDistribution[hits];
        const percentage = results.attempts > 0 ? (count / results.attempts * 100).toFixed(2) : 0;
        const maxWidth = Math.max(...Object.values(results.hitDistribution));
        const barWidth = maxWidth > 0 ? (count / maxWidth * 100) : 0;
        const barColor = hits >= targetHits ? '#22c55e' : '#3b82f6';
        return `
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="width: 60px; font-size: 0.875rem;">${hits}개 일치:</span>
                                <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
                                    <div style="background: ${barColor}; height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
                                </div>
                                <span style="width: 100px; font-size: 0.75rem; text-align: right;">
                                    ${count.toLocaleString()}회 (${percentage}%)
                                </span>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
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
 * Generate combinations from predicted numbers using the new combination engine
 */
function generateCombinations() {
    if (!currentAnalysis) {
        alert('먼저 분석을 실행해주세요.');
        return;
    }

    // 모듈 로드 확인
    if (typeof CombinationGenerator === 'undefined') {
        alert('조합 생성 모듈이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        return;
    }

    const combinationCount = parseInt(document.getElementById('combination-count').value) || 10;
    const poolSize = parseInt(document.getElementById('predict-count').value) || 10;

    // 번호별 점수 맵 생성
    const numberScores = {};
    currentAnalysis.predictions.forEach(pred => {
        numberScores[pred.number] = pred.score;
    });

    // 조합 생성기 초기화
    const constraintsConfig = (typeof getDefaultConstraints !== 'undefined') ? getDefaultConstraints() : {};
    const scoringConfig = (typeof getDefaultScoringConfig !== 'undefined') ? getDefaultScoringConfig() : {};

    const config = {
        poolSize: Math.max(12, poolSize), // 최소 12개 풀 사용
        maxAttempts: 50000,
        minConstraintScore: 0.7,
        strictConstraints: false,
        constraints: constraintsConfig,
        scoring: scoringConfig
    };

    const generator = new CombinationGenerator(numberScores, config);

    // 진행 표시
    showProgress(true, {
        message: '조합 생성 중...',
        progress: 0
    });

    // 조합 생성 (약간의 지연을 두어 UI가 업데이트될 시간 제공)
    setTimeout(() => {
        try {
            // 다양성을 고려한 조합 생성
            const combinations = generator.generateDiverse(combinationCount);

            updateProgress({
                message: '조합 생성 완료!',
                progress: 100
            });

            setTimeout(() => {
                showProgress(false);

                if (combinations.length === 0) {
                    showMessage('제약조건을 만족하는 조합을 생성하지 못했습니다. 풀 크기를 늘려보세요.', 'warning');
                    return;
                }

                console.log(`Generated ${combinations.length} combinations with constraints`);

                // Display combinations
                displayCombinations(combinations);

                showMessage(`${combinations.length}개 조합이 생성되었습니다! (제약조건 적용)`, 'success');
            }, 300);
        } catch (error) {
            showProgress(false);
            console.error('Error generating combinations:', error);
            showMessage('조합 생성 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }, 100);
}

/**
 * Display combinations as rows (no copy button, divider every 5 rows)
 */
function displayCombinations(combinations) {
    const container = document.getElementById('combinations-results');
    container.innerHTML = '';

    if (!combinations || combinations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 12px; font-size: 0.875rem;">조합을 생성할 수 없습니다.</p>';
        return;
    }

    // Create combination rows
    combinations.forEach((combo, idx) => {
        // 5줄마다 구분선 추가
        if (idx > 0 && idx % 5 === 0) {
            const divider = document.createElement('div');
            divider.style.cssText = `
                height: 1px;
                background: #e2e8f0;
                margin: 8px 0;
            `;
            container.appendChild(divider);
        }

        // 조합 행 생성
        const row = document.createElement('div');
        row.className = 'combination-row';
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        `;

        // 순번 표시
        const rank = document.createElement('div');
        rank.style.cssText = `
            font-weight: 600;
            color: #004EA2;
            font-size: 0.875rem;
            min-width: 32px;
            text-align: right;
        `;
        rank.textContent = `#${idx + 1}`;

        // 번호들
        const numbersDiv = document.createElement('div');
        numbersDiv.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; flex: 1;';

        const sortedNumbers = [...combo.numbers].sort((a, b) => a - b);

        sortedNumbers.forEach(num => {
            const ball = document.createElement('div');
            ball.className = `lotto-ball ${getBallColorClass(num)}`;
            ball.style.cssText = 'width: 32px; height: 32px; font-size: 0.875rem; line-height: 32px;';
            ball.textContent = num;

            // 클릭하면 복사
            ball.style.cursor = 'pointer';
            ball.title = '클릭하여 복사';
            ball.onclick = () => {
                const text = sortedNumbers.join(', ');
                navigator.clipboard.writeText(text).then(() => {
                    showMessage('번호가 복사되었습니다!', 'success');
                });
            };

            numbersDiv.appendChild(ball);
        });

        row.appendChild(rank);
        row.appendChild(numbersDiv);

        // 호버 효과
        if (window.matchMedia('(hover: hover)').matches) {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = '#f8f9fa';
            });

            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = 'transparent';
            });
        }

        container.appendChild(row);
    });
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
document.addEventListener('DOMContentLoaded', function () {
    const analyzeRoundsInput = document.getElementById('analyze-rounds');
    if (analyzeRoundsInput) {
        analyzeRoundsInput.addEventListener('change', updateAnalyzeRounds);
    }
});

// ============================================================
// 정밀 백테스팅 (Advanced Backtesting) 관련 함수들
// ============================================================

let advancedBacktester = null;
let probabilityScorer = null;
let probabilityStrategies = null;
let currentAdvancedBacktest = null;
let scorePerformanceChart = null;
let calibrationChart = null;

/**
 * 정밀 백테스트 실행
 */
function runAdvancedBacktest() {
    if (!analyzer || !analyzer.data) {
        showMessage('데이터가 로드되지 않았습니다.', 'error');
        return;
    }

    const startRound = parseInt(document.getElementById('adv-backtest-start').value);
    const endRound = parseInt(document.getElementById('adv-backtest-end').value);
    const topN = parseInt(document.getElementById('adv-backtest-topn').value);

    if (startRound >= endRound) {
        showMessage('시작 회차는 종료 회차보다 작아야 합니다.', 'error');
        return;
    }

    // 활성화된 전략 확인
    const enabledStrategies = {};
    document.querySelectorAll('input[name="strategy"]').forEach(checkbox => {
        enabledStrategies[checkbox.value] = checkbox.checked;
    });

    console.log(`[Advanced Backtest] Starting: ${startRound} - ${endRound}, topN: ${topN}`);
    console.log('[Advanced Backtest] Enabled strategies:', enabledStrategies);

    // 진행 표시
    showProgress(true, {
        message: '정밀 백테스트 진행 중...',
        progress: 0,
        detail: '초기화 중...'
    });

    // 약간의 지연 후 실행 (UI 업데이트를 위해)
    setTimeout(() => {
        try {
            // 모듈 초기화
            if (typeof ProbabilityScorer !== 'undefined') {
                probabilityScorer = new ProbabilityScorer();
            }

            if (typeof AdvancedBacktester !== 'undefined') {
                advancedBacktester = new AdvancedBacktester(analyzer.data);
            }

            if (typeof ProbabilityStrategies !== 'undefined') {
                probabilityStrategies = new ProbabilityStrategies();
                // 전략 활성화 상태 적용
                Object.entries(enabledStrategies).forEach(([key, enabled]) => {
                    probabilityStrategies.setStrategy(key, enabled);
                });
            }

            if (!advancedBacktester) {
                throw new Error('AdvancedBacktester 모듈을 로드할 수 없습니다.');
            }

            // 진행 콜백
            const progressCallback = (progress, current, total, detail) => {
                showProgress(true, {
                    message: '정밀 백테스트 진행 중...',
                    progress: progress,
                    current: current,
                    total: total,
                    detail: detail
                });
            };

            // 백테스트 실행
            currentAdvancedBacktest = advancedBacktester.runProbabilityBacktest(
                startRound, endRound, topN, progressCallback
            );

            showProgress(false);

            // 결과 표시
            displayAdvancedBacktestStats(currentAdvancedBacktest);
            displayScorePerformanceChart(currentAdvancedBacktest);
            displayCalibrationChart(currentAdvancedBacktest);
            displayStrategyComparison(currentAdvancedBacktest, enabledStrategies);
            displayAdvancedBacktestTable(currentAdvancedBacktest);

            showMessage('정밀 백테스트가 완료되었습니다!', 'success');

        } catch (error) {
            showProgress(false);
            console.error('Advanced backtest error:', error);
            showMessage(`백테스트 오류: ${error.message}`, 'error');
        }
    }, 100);
}

/**
 * 정밀 백테스트 통계 표시
 */
function displayAdvancedBacktestStats(backtest) {
    const container = document.getElementById('adv-backtest-stats');
    if (!container || !backtest || !backtest.statistics) return;

    const stats = backtest.statistics;
    const calibration = backtest.calibration;

    container.innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${stats.averageHits.toFixed(2)}</div>
            <div class="stat-label">평균 적중 수</div>
            <small style="color: ${stats.improvement.avgHits > 0 ? '#22c55e' : '#ef4444'}">
                무작위 대비 ${stats.improvement.avgHits > 0 ? '+' : ''}${stats.improvement.avgHits.toFixed(1)}%
            </small>
        </div>
        <div class="stat-box">
            <div class="stat-value">${(stats.hit3PlusRate * 100).toFixed(1)}%</div>
            <div class="stat-label">3개+ 적중률</div>
            <small style="color: ${stats.improvement.hit3PlusRate > 0 ? '#22c55e' : '#ef4444'}">
                무작위 대비 ${stats.improvement.hit3PlusRate > 0 ? '+' : ''}${stats.improvement.hit3PlusRate.toFixed(1)}%
            </small>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.averageActualScore.toFixed(1)}</div>
            <div class="stat-label">평균 실제 점수</div>
            <small>당첨 번호들의 평균 예측 점수</small>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.averageRank.toFixed(1)}</div>
            <div class="stat-label">평균 순위</div>
            <small>당첨 번호들의 평균 예측 순위</small>
        </div>
        <div class="stat-box">
            <div class="stat-value">${calibration ? calibration.brierScore.toFixed(4) : '-'}</div>
            <div class="stat-label">Brier Score</div>
            <small>낮을수록 좋음 (0이 완벽)</small>
        </div>
        <div class="stat-box">
            <div class="stat-value">${calibration ? calibration.ece.toFixed(2) : '-'}</div>
            <div class="stat-label">ECE</div>
            <small>캘리브레이션 오차</small>
        </div>
    `;
}

/**
 * 점수별 성과 차트 표시
 */
function displayScorePerformanceChart(backtest) {
    const canvas = document.getElementById('score-performance-chart');
    if (!canvas || !backtest || !backtest.scorePerformance) return;

    const ctx = canvas.getContext('2d');
    const performance = backtest.scorePerformance;

    // 기존 차트 제거
    if (scorePerformanceChart) {
        scorePerformanceChart.destroy();
    }

    const labels = performance.map(p => p.range);
    const accuracyData = performance.map(p => p.accuracy);
    const expectedData = performance.map(p => (6 / 45) * 100);  // 무작위 기대값

    scorePerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '실제 출현율 (%)',
                    data: accuracyData,
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: '무작위 기대값 (%)',
                    data: expectedData,
                    type: 'line',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '점수 구간별 실제 출현율 vs 무작위 기대값'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '출현율 (%)'
                    }
                }
            }
        }
    });

    // 테이블 표시
    const tableContainer = document.getElementById('score-performance-table');
    if (tableContainer) {
        let html = `
            <table class="backtest-table">
                <thead>
                    <tr>
                        <th>점수 구간</th>
                        <th>예측 횟수</th>
                        <th>실제 적중</th>
                        <th>출현율</th>
                        <th>리프트</th>
                    </tr>
                </thead>
                <tbody>
        `;

        performance.forEach(p => {
            const liftColor = p.lift > 1 ? '#22c55e' : p.lift < 1 ? '#ef4444' : '#64748b';
            html += `
                <tr>
                    <td><strong>${p.range}</strong></td>
                    <td>${p.predicted.toLocaleString()}</td>
                    <td>${p.hits.toLocaleString()}</td>
                    <td>${p.accuracy.toFixed(2)}%</td>
                    <td style="color: ${liftColor}; font-weight: 600;">
                        ${p.lift.toFixed(2)}x
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;
    }
}

/**
 * 캘리브레이션 차트 표시
 */
function displayCalibrationChart(backtest) {
    const canvas = document.getElementById('calibration-chart');
    if (!canvas || !backtest || !backtest.calibration) return;

    const ctx = canvas.getContext('2d');
    const calibration = backtest.calibration;

    // 기존 차트 제거
    if (calibrationChart) {
        calibrationChart.destroy();
    }

    // 캘리브레이션 데이터 준비
    const bins = calibration.bins.filter(b => b.totalPredictions > 0);
    const avgConfidence = bins.map(b => b.avgConfidence);
    const accuracy = bins.map(b => b.accuracy);

    // 완벽한 캘리브레이션 라인 (대각선)
    const perfectLine = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    calibrationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: '실제 캘리브레이션',
                    data: avgConfidence.map((c, i) => ({ x: c, y: accuracy[i] })),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    pointRadius: 8,
                    pointHoverRadius: 10
                },
                {
                    label: '완벽한 캘리브레이션',
                    data: perfectLine.map(v => ({ x: v, y: v })),
                    type: 'line',
                    borderColor: 'rgba(156, 163, 175, 0.5)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '캘리브레이션 플롯 (예측 확률 vs 실제 출현율)'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '예측 확률 (%)'
                    },
                    min: 0,
                    max: 100
                },
                y: {
                    title: {
                        display: true,
                        text: '실제 출현율 (%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });

    // 캘리브레이션 지표 표시
    const metricsContainer = document.getElementById('calibration-metrics');
    if (metricsContainer) {
        metricsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">${calibration.brierScore.toFixed(4)}</div>
                    <div style="font-size: 0.875rem; color: #64748b;">Brier Score</div>
                    <small style="color: #94a3b8;">0이 완벽, 낮을수록 좋음</small>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">${calibration.ece.toFixed(2)}</div>
                    <div style="font-size: 0.875rem; color: #64748b;">ECE (Expected Calibration Error)</div>
                    <small style="color: #94a3b8;">0이 완벽한 캘리브레이션</small>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">${calibration.totalPredictions.toLocaleString()}</div>
                    <div style="font-size: 0.875rem; color: #64748b;">총 예측 횟수</div>
                    <small style="color: #94a3b8;">분석된 번호-회차 조합 수</small>
                </div>
            </div>
        `;
    }
}

/**
 * 전략 성과 비교 표시
 */
function displayStrategyComparison(backtest, enabledStrategies) {
    const container = document.getElementById('strategy-comparison');
    if (!container || !backtest) return;

    const stats = backtest.statistics;

    // 전략 정보 생성
    const strategies = [
        { key: 'hotCold', name: '🔥 핫/콜드 전략', description: '최근 출현 빈도 기반' },
        { key: 'sectionBalance', name: '📊 구간 균형', description: '구간별 분산 최적화' },
        { key: 'oddEvenBalance', name: '⚖️ 홀짝 균형', description: '3:3 비율 유지' },
        { key: 'sumRange', name: '➕ 합계 범위', description: '100-170 집중' },
        { key: 'consecutiveLimit', name: '🔢 연속 제한', description: '2개 이하 유지' },
        { key: 'acValue', name: '📐 AC 값', description: '차이값 다양성' }
    ];

    let html = `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0;">현재 설정 결과</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="background: #f0fdf4; padding: 12px; border-radius: 8px;">
                    <div style="font-weight: 600; color: #166534;">평균 적중: ${stats.averageHits.toFixed(2)}개</div>
                </div>
                <div style="background: #eff6ff; padding: 12px; border-radius: 8px;">
                    <div style="font-weight: 600; color: #1e40af;">3개+ 적중률: ${(stats.hit3PlusRate * 100).toFixed(1)}%</div>
                </div>
            </div>
        </div>
        
        <h4 style="margin: 16px 0 8px 0;">활성화된 전략</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
    `;

    strategies.forEach(strategy => {
        const isEnabled = enabledStrategies[strategy.key];
        const bgColor = isEnabled ? '#dcfce7' : '#fee2e2';
        const textColor = isEnabled ? '#166534' : '#991b1b';
        const icon = isEnabled ? '✅' : '❌';

        html += `
            <div style="background: ${bgColor}; padding: 10px; border-radius: 6px;">
                <div style="font-weight: 600; color: ${textColor}; font-size: 0.875rem;">
                    ${icon} ${strategy.name}
                </div>
                <small style="color: #64748b;">${strategy.description}</small>
            </div>
        `;
    });

    html += '</div>';

    // 참고 정보
    html += `
        <div style="margin-top: 20px; padding: 12px; background: #fef3c7; border-radius: 8px;">
            <p style="margin: 0; font-size: 0.875rem; color: #92400e;">
                💡 <strong>참고:</strong> 무작위 기준선 - 평균 적중: ${stats.randomBaseline.avgHits.toFixed(2)}개, 
                3개+ 적중률: ${(stats.randomBaseline.hit3PlusRate * 100).toFixed(2)}%
            </p>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * 정밀 백테스트 결과 테이블 표시
 */
function displayAdvancedBacktestTable(backtest) {
    const tbody = document.querySelector('#adv-backtest-table tbody');
    if (!tbody || !backtest || !backtest.results) return;

    tbody.innerHTML = '';

    // 최근 50개만 표시 (성능을 위해)
    const displayResults = backtest.results.slice(-50);

    displayResults.forEach(result => {
        const row = document.createElement('tr');

        // 적중 개수에 따른 색상
        let hitClass = '';
        if (result.hits >= 4) hitClass = 'hit-high';
        else if (result.hits >= 3) hitClass = 'hit-medium';
        else if (result.hits >= 2) hitClass = 'hit-low';

        // 예측 번호 표시 (적중 번호 강조)
        const predictedHtml = result.predicted.map(num => {
            const isHit = result.actual.includes(num);
            return `<span class="number ${isHit ? 'hit' : ''}">${num}</span>`;
        }).join(' ');

        // 실제 번호 표시
        const actualHtml = result.actual.map(num => {
            const isPredicted = result.predicted.includes(num);
            return `<span class="number ${isPredicted ? 'predicted' : ''}">${num}</span>`;
        }).join(' ');

        row.innerHTML = `
            <td>${result.round}</td>
            <td>${predictedHtml}</td>
            <td>${actualHtml}</td>
            <td class="${hitClass}">${result.hits}개</td>
            <td>${result.avgActualScore.toFixed(1)}</td>
            <td>${result.avgRank.toFixed(1)}</td>
        `;

        tbody.appendChild(row);
    });
}
