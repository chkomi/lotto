/**
 * 로또 조합 점수 산출 모듈
 * 
 * 개별 번호의 점수를 기반으로 6개 번호 조합의 전체 점수를 계산합니다.
 */

/**
 * 조합 점수 계산 결과
 * @typedef {Object} CombinationScore
 * @property {number} totalScore - 전체 점수
 * @property {number} averageScore - 평균 점수
 * @property {number} weightedScore - 가중 평균 점수
 * @property {number} confidence - 신뢰도 (0-1)
 * @property {Object} details - 상세 정보
 */

/**
 * 조합 점수 계산 설정
 * @typedef {Object} ScoringConfig
 * @property {string} method - 점수 계산 방법 ('average' | 'weighted' | 'topN')
 * @property {boolean} useRank - 순위를 점수로 변환하여 사용할지 여부
 * @property {number} rankWeight - 순위 가중치 (0-1)
 */

/**
 * 기본 점수 계산 설정 반환
 * @returns {ScoringConfig}
 */
function getDefaultScoringConfig() {
    return {
        method: 'weighted',
        useRank: false,
        rankWeight: 0.3
    };
}

/**
 * 조합의 점수를 계산
 * @param {number[]} combination - 6개 번호 배열
 * @param {Object<number, number>} numberScores - 번호별 점수 맵 {1: 85.2, 2: 72.1, ...}
 * @param {ScoringConfig} config - 점수 계산 설정
 * @returns {CombinationScore}
 */
function calculateCombinationScore(combination, numberScores, config = null) {
    const scoringConfig = config || getDefaultScoringConfig();
    const scores = combination.map(num => numberScores[num] || 0);

    // 기본 통계
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const averageScore = totalScore / 6;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const stdDev = calculateStandardDeviation(scores);

    // 가중 점수 계산 (상위 번호에 더 높은 가중치)
    const sortedScores = [...scores].sort((a, b) => b - a);
    const weights = [0.25, 0.20, 0.18, 0.15, 0.12, 0.10]; // 상위 번호일수록 높은 가중치
    const weightedScore = sortedScores.reduce((sum, score, idx) => sum + score * weights[idx], 0);

    // 신뢰도 계산 (점수의 일관성과 평균값 기반)
    const scoreRange = maxScore - minScore;
    const consistencyScore = 1 - (stdDev / (averageScore || 1)); // 표준편차가 작을수록 일관성 높음
    const magnitudeScore = Math.min(1, averageScore / 100); // 평균 점수가 높을수록 좋음
    const confidence = (consistencyScore * 0.5 + magnitudeScore * 0.5);

    // 최종 점수 선택
    let finalScore;
    switch (scoringConfig.method) {
        case 'average':
            finalScore = averageScore;
            break;
        case 'weighted':
            finalScore = weightedScore;
            break;
        case 'topN':
            // 상위 3개 번호의 평균
            finalScore = sortedScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
            break;
        default:
            finalScore = weightedScore;
    }

    return {
        totalScore: totalScore,
        averageScore: averageScore,
        weightedScore: weightedScore,
        confidence: Math.max(0, Math.min(1, confidence)),
        score: finalScore,
        details: {
            minScore: minScore,
            maxScore: maxScore,
            stdDev: stdDev,
            scoreRange: scoreRange,
            consistencyScore: consistencyScore,
            magnitudeScore: magnitudeScore
        }
    };
}

/**
 * 표준편차 계산
 * @param {number[]} values - 값 배열
 * @returns {number} 표준편차
 */
function calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

/**
 * 순위 기반 점수 계산
 * @param {number[]} combination - 6개 번호 배열
 * @param {Object<number, number>} numberRanks - 번호별 순위 맵 {1: 5, 2: 12, ...} (낮을수록 좋음)
 * @returns {CombinationScore}
 */
function calculateCombinationScoreByRank(combination, numberRanks) {
    const ranks = combination.map(num => numberRanks[num] || 45); // 순위 없으면 최하위
    
    // 순위를 점수로 변환 (1위 = 100점, 45위 = 0점)
    const scores = ranks.map(rank => (45 - rank + 1) * (100 / 45));
    
    return calculateCombinationScore(combination, 
        Object.fromEntries(combination.map((num, idx) => [num, scores[idx]])),
        getDefaultScoringConfig()
    );
}

/**
 * 하이브리드 점수 계산 (점수 + 순위)
 * @param {number[]} combination - 6개 번호 배열
 * @param {Object<number, number>} numberScores - 번호별 점수 맵
 * @param {Object<number, number>} numberRanks - 번호별 순위 맵
 * @param {number} rankWeight - 순위 가중치 (0-1)
 * @returns {CombinationScore}
 */
function calculateHybridScore(combination, numberScores, numberRanks, rankWeight = 0.3) {
    const scoreResult = calculateCombinationScore(combination, numberScores);
    const rankResult = calculateCombinationScoreByRank(combination, numberRanks);
    
    // 가중 평균
    const hybridScore = scoreResult.score * (1 - rankWeight) + rankResult.score * rankWeight;
    const hybridConfidence = scoreResult.confidence * (1 - rankWeight) + rankResult.confidence * rankWeight;
    
    return {
        ...scoreResult,
        score: hybridScore,
        confidence: hybridConfidence,
        details: {
            ...scoreResult.details,
            scoreBased: scoreResult.score,
            rankBased: rankResult.score,
            rankWeight: rankWeight
        }
    };
}

/**
 * 점수 기반 조합 정렬
 * @param {Array<{numbers: number[], score?: number}>} combinations - 조합 배열
 * @param {Object<number, number>} numberScores - 번호별 점수 맵
 * @param {ScoringConfig} config - 점수 계산 설정
 * @returns {Array<{numbers: number[], score: number, confidence: number}>} 정렬된 조합 배열
 */
function scoreAndSortCombinations(combinations, numberScores, config = null) {
    const scoringConfig = config || getDefaultScoringConfig();
    
    // 각 조합에 점수 부여
    const scored = combinations.map(comb => {
        const scoreResult = calculateCombinationScore(comb.numbers, numberScores, scoringConfig);
        return {
            numbers: comb.numbers,
            score: scoreResult.score,
            confidence: scoreResult.confidence,
            weightedScore: scoreResult.weightedScore,
            averageScore: scoreResult.averageScore,
            details: scoreResult.details
        };
    });
    
    // 점수 기준 내림차순 정렬
    scored.sort((a, b) => {
        // 먼저 점수로 정렬
        if (Math.abs(a.score - b.score) > 0.01) {
            return b.score - a.score;
        }
        // 점수가 같으면 신뢰도로 정렬
        return b.confidence - a.confidence;
    });
    
    return scored;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateCombinationScore,
        calculateCombinationScoreByRank,
        calculateHybridScore,
        scoreAndSortCombinations,
        getDefaultScoringConfig,
        calculateStandardDeviation
    };
}
