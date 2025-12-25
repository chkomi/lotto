/**
 * 백테스팅 성과 지표 계산 모듈
 * 
 * 다양한 통계적 지표를 계산하여 백테스팅 결과를 평가합니다.
 */

/**
 * 무작위 기준선 (Random Baselines)
 * 45C6 조합 중 k개 이상 일치할 확률
 */
const RANDOM_BASELINES = {
    3: 0.0177,    // 약 1.77%
    4: 0.000969,  // 약 0.097%
    5: 0.0000184, // 약 0.00184%
    6: 0.00000007 // 약 0.000007%
};

/**
 * 백테스트 결과 데이터 구조
 * @typedef {Object} BacktestResult
 * @property {number} round - 회차
 * @property {number[]} predicted - 예측된 번호 배열 (topN개)
 * @property {number[]} actual - 실제 당첨 번호 배열 (6개)
 * @property {number} hits - 적중 개수
 * @property {number[]} actualRanks - 실제 번호들의 예측 순위
 * @property {number} avgRank - 평균 순위
 */

/**
 * 조합 결과 데이터 구조 (조합 생성 기반 백테스트용)
 * @typedef {Object} CombinationResult
 * @property {number} round - 회차
 * @property {Array<{numbers: number[], score: number}>} combinations - 생성된 조합 배열
 * @property {number[]} actual - 실제 당첨 번호 배열
 * @property {Array<{combination: number[], hits: number}>} combinationHits - 각 조합의 적중 개수
 */

/**
 * 성과 지표 결과
 * @typedef {Object} PerformanceMetrics
 * @property {Object} hitRates - k개 이상 적중률 {3: 0.185, 4: 0.023, ...}
 * @property {number} averageHits - 평균 적중 개수
 * @property {number} maxHits - 최대 적중 개수
 * @property {number} averageRank - 평균 순위 (낮을수록 좋음)
 * @property {number} mrr - Mean Reciprocal Rank
 * @property {Object} lifts - 무작위 대비 리프트 {3: 10.4, 4: 23.0, ...}
 * @property {number} sharpeLikeRatio - Sharpe-like ratio (일관성 지표)
 * @property {number} drawdown - 최대 연속 3개 이상 미적중 기간
 * @property {Object} distribution - 적중 개수별 분포
 */

/**
 * 기본 성과 지표 계산 (번호 예측 기반)
 * @param {BacktestResult[]} results - 백테스트 결과 배열
 * @returns {PerformanceMetrics} 성과 지표
 */
function calculateMetrics(results) {
    if (!results || results.length === 0) {
        return null;
    }

    // 1. 적중 개수별 분포
    const distribution = {};
    for (let i = 0; i <= 6; i++) {
        distribution[i] = 0;
    }

    const hitsArray = [];
    const ranksArray = [];
    const reciprocalRanks = [];

    results.forEach(result => {
        const hits = result.hits || 0;
        distribution[hits] = (distribution[hits] || 0) + 1;
        hitsArray.push(hits);

        if (result.actualRanks && result.actualRanks.length > 0) {
            const avgRank = result.avgRank || 
                (result.actualRanks.reduce((a, b) => a + b, 0) / result.actualRanks.length);
            ranksArray.push(avgRank);

            // MRR: 첫 번째 적중 번호의 순위의 역수
            const firstHitRank = Math.min(...result.actualRanks);
            reciprocalRanks.push(1 / firstHitRank);
        }
    });

    // 2. k개 이상 적중률
    const hitRates = {};
    for (let k = 3; k <= 6; k++) {
        const count = hitsArray.filter(h => h >= k).length;
        hitRates[k] = count / results.length;
    }

    // 3. 평균 및 최대 적중
    const averageHits = hitsArray.reduce((a, b) => a + b, 0) / hitsArray.length;
    const maxHits = Math.max(...hitsArray);

    // 4. 평균 순위
    const averageRank = ranksArray.length > 0 
        ? ranksArray.reduce((a, b) => a + b, 0) / ranksArray.length 
        : null;

    // 5. Mean Reciprocal Rank (MRR)
    const mrr = reciprocalRanks.length > 0
        ? reciprocalRanks.reduce((a, b) => a + b, 0) / reciprocalRanks.length
        : null;

    // 6. 무작위 대비 리프트
    const lifts = {};
    for (let k = 3; k <= 6; k++) {
        const baseline = RANDOM_BASELINES[k];
        lifts[k] = baseline > 0 ? hitRates[k] / baseline : null;
    }

    // 7. Sharpe-like ratio (평균 / 표준편차)
    const mean = averageHits;
    const variance = hitsArray.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hitsArray.length;
    const stdDev = Math.sqrt(variance);
    const sharpeLikeRatio = stdDev > 0 ? mean / stdDev : 0;

    // 8. Drawdown (최대 연속 3개 이상 미적중 기간)
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    for (let i = 0; i < hitsArray.length; i++) {
        if (hitsArray[i] < 3) {
            currentDrawdown++;
            maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        } else {
            currentDrawdown = 0;
        }
    }

    return {
        hitRates: hitRates,
        averageHits: averageHits,
        maxHits: maxHits,
        averageRank: averageRank,
        mrr: mrr,
        lifts: lifts,
        sharpeLikeRatio: sharpeLikeRatio,
        drawdown: maxDrawdown,
        distribution: distribution,
        totalRounds: results.length
    };
}

/**
 * 조합 기반 성과 지표 계산
 * @param {CombinationResult[]} results - 조합 백테스트 결과 배열
 * @param {number} k - k개 이상 적중 기준 (기본값: 3)
 * @returns {PerformanceMetrics} 성과 지표
 */
function calculateCombinationMetrics(results, k = 3) {
    if (!results || results.length === 0) {
        return null;
    }

    const hitsArray = [];
    const maxHitsPerRound = [];
    const combinationsCount = [];

    results.forEach(result => {
        const combHits = result.combinationHits || [];
        const hits = combHits.map(ch => ch.hits);
        
        // 각 조합의 적중 개수 저장
        hits.forEach(h => hitsArray.push(h));
        
        // 회차별 최대 적중 개수
        const maxHits = hits.length > 0 ? Math.max(...hits) : 0;
        maxHitsPerRound.push(maxHits);
        
        // 조합 수
        combinationsCount.push(result.combinations ? result.combinations.length : 0);
    });

    // k개 이상 적중한 조합의 비율
    const totalCombinations = hitsArray.length;
    const hitKPlus = hitsArray.filter(h => h >= k).length;
    const hitRateK = totalCombinations > 0 ? hitKPlus / totalCombinations : 0;

    // 회차별 k개 이상 적중한 조합이 있는 비율
    const roundsWithKPlus = maxHitsPerRound.filter(h => h >= k).length;
    const roundHitRateK = results.length > 0 ? roundsWithKPlus / results.length : 0;

    // 평균 적중
    const averageHits = hitsArray.length > 0 
        ? hitsArray.reduce((a, b) => a + b, 0) / hitsArray.length 
        : 0;

    // 최대 적중
    const maxHits = hitsArray.length > 0 ? Math.max(...hitsArray) : 0;

    // 평균 회차별 최대 적중
    const averageMaxHits = maxHitsPerRound.length > 0
        ? maxHitsPerRound.reduce((a, b) => a + b, 0) / maxHitsPerRound.length
        : 0;

    // 표준편차 및 Sharpe-like ratio
    const mean = averageHits;
    const variance = hitsArray.length > 0
        ? hitsArray.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hitsArray.length
        : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeLikeRatio = stdDev > 0 ? mean / stdDev : 0;

    // Drawdown (회차별 최대 적중이 3개 미만인 연속 기간)
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    for (let i = 0; i < maxHitsPerRound.length; i++) {
        if (maxHitsPerRound[i] < 3) {
            currentDrawdown++;
            maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        } else {
            currentDrawdown = 0;
        }
    }

    // 무작위 대비 리프트 (단일 조합 기준)
    const baseline = RANDOM_BASELINES[k];
    const lift = baseline > 0 ? hitRateK / baseline : null;

    return {
        hitRates: {
            [k]: hitRateK,
            [`round_${k}`]: roundHitRateK  // 회차 기준 적중률
        },
        averageHits: averageHits,
        maxHits: maxHits,
        averageMaxHits: averageMaxHits,
        averageRank: null, // 조합 기반에서는 순위 개념이 다름
        mrr: null,
        lifts: {
            [k]: lift
        },
        sharpeLikeRatio: sharpeLikeRatio,
        drawdown: maxDrawdown,
        distribution: null, // 조합 단위이므로 분포는 다르게 계산
        totalRounds: results.length,
        totalCombinations: totalCombinations,
        averageCombinationsPerRound: combinationsCount.length > 0
            ? combinationsCount.reduce((a, b) => a + b, 0) / combinationsCount.length
            : 0
    };
}

/**
 * 두 지표 집합 비교
 * @param {PerformanceMetrics} metrics1 - 첫 번째 지표
 * @param {PerformanceMetrics} metrics2 - 두 번째 지표
 * @returns {Object} 비교 결과
 */
function compareMetrics(metrics1, metrics2) {
    if (!metrics1 || !metrics2) {
        return null;
    }

    return {
        hitRate3: {
            metric1: metrics1.hitRates[3],
            metric2: metrics2.hitRates[3],
            diff: metrics1.hitRates[3] - metrics2.hitRates[3],
            improvement: metrics2.hitRates[3] > 0 
                ? ((metrics1.hitRates[3] - metrics2.hitRates[3]) / metrics2.hitRates[3]) * 100 
                : null
        },
        averageHits: {
            metric1: metrics1.averageHits,
            metric2: metrics2.averageHits,
            diff: metrics1.averageHits - metrics2.averageHits,
            improvement: metrics2.averageHits > 0
                ? ((metrics1.averageHits - metrics2.averageHits) / metrics2.averageHits) * 100
                : null
        },
        lift3: {
            metric1: metrics1.lifts[3],
            metric2: metrics2.lifts[3],
            diff: metrics1.lifts[3] - metrics2.lifts[3],
            improvement: metrics2.lifts[3] && metrics2.lifts[3] > 0
                ? ((metrics1.lifts[3] - metrics2.lifts[3]) / metrics2.lifts[3]) * 100
                : null
        },
        sharpeLikeRatio: {
            metric1: metrics1.sharpeLikeRatio,
            metric2: metrics2.sharpeLikeRatio,
            diff: metrics1.sharpeLikeRatio - metrics2.sharpeLikeRatio,
            improvement: metrics2.sharpeLikeRatio > 0
                ? ((metrics1.sharpeLikeRatio - metrics2.sharpeLikeRatio) / metrics2.sharpeLikeRatio) * 100
                : null
        }
    };
}

/**
 * 지표를 읽기 쉬운 문자열로 포맷
 * @param {PerformanceMetrics} metrics - 성과 지표
 * @returns {string} 포맷된 문자열
 */
function formatMetrics(metrics) {
    if (!metrics) {
        return '지표 없음';
    }

    let str = `\n=== 백테스팅 성과 지표 ===\n`;
    str += `총 회차: ${metrics.totalRounds}\n\n`;
    
    str += `적중 성과:\n`;
    for (let k = 3; k <= 6; k++) {
        const rate = metrics.hitRates[k];
        const lift = metrics.lifts[k];
        str += `  ${k}개+ 적중률: ${(rate * 100).toFixed(2)}%`;
        if (lift) {
            str += ` (리프트: ${lift.toFixed(2)}x)`;
        }
        str += `\n`;
    }
    
    str += `\n평균 적중: ${metrics.averageHits.toFixed(2)}개\n`;
    str += `최대 적중: ${metrics.maxHits}개\n`;
    
    if (metrics.averageRank !== null) {
        str += `평균 순위: ${metrics.averageRank.toFixed(2)}\n`;
    }
    
    if (metrics.mrr !== null) {
        str += `MRR: ${metrics.mrr.toFixed(4)}\n`;
    }
    
    str += `\n안정성:\n`;
    str += `  Sharpe-like Ratio: ${metrics.sharpeLikeRatio.toFixed(3)}\n`;
    str += `  최대 Drawdown: ${metrics.drawdown}회차\n`;
    
    return str;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateMetrics,
        calculateCombinationMetrics,
        compareMetrics,
        formatMetrics,
        RANDOM_BASELINES
    };
}
