/**
 * 전략 최적화 모듈
 * 
 * Grid Search를 사용하여 하이퍼파라미터를 최적화합니다.
 */

/**
 * 최적화 설정
 * @typedef {Object} OptimizationConfig
 * @property {Object} paramGrid - 파라미터 그리드 {paramName: [values]}
 * @property {string} metric - 최적화 목표 지표 ('hit_rate_3' | 'average_hits' | 'lift_3' | 'sharpe_ratio')
 * @property {number} maxIterations - 최대 반복 횟수 (기본값: 전체 조합)
 * @property {boolean} verbose - 상세 로그 출력 여부
 */

/**
 * 최적화 결과
 * @typedef {Object} OptimizationResult
 * @property {Object} bestParams - 최적 파라미터
 * @property {number} bestScore - 최적 점수
 * @property {Array} allResults - 모든 조합의 결과
 * @property {Object} paramSensitivity - 파라미터별 민감도 분석
 */

/**
 * StrategyOptimizer 클래스
 */
class StrategyOptimizer {
    /**
     * @param {Function} backtestFunction - 백테스트 함수 (params) => backtestResult
     * @param {Object} paramGrid - 파라미터 그리드
     */
    constructor(backtestFunction, paramGrid = {}) {
        this.backtestFunction = backtestFunction;
        this.paramGrid = paramGrid;
    }

    /**
     * Grid Search 실행
     * @param {OptimizationConfig} config - 최적화 설정
     * @param {Function} progressCallback - 진행율 콜백
     * @returns {OptimizationResult} 최적화 결과
     */
    optimize(config = {}, progressCallback = null) {
        const {
            metric = 'hit_rate_3',
            maxIterations = null,
            verbose = false
        } = config;

        // 파라미터 조합 생성
        const paramCombinations = this.generateParamCombinations(this.paramGrid, maxIterations);
        const totalCombinations = paramCombinations.length;

        console.log(`Grid Search 시작: ${totalCombinations}개 조합 탐색, 목표 지표: ${metric}`);

        const allResults = [];
        let bestScore = -Infinity;
        let bestParams = null;

        paramCombinations.forEach((params, idx) => {
            const current = idx + 1;
            const progress = (current / totalCombinations) * 100;

            // 진행율 콜백
            if (progressCallback) {
                progressCallback(progress, current, totalCombinations, 
                    `조합 ${current}/${totalCombinations}: ${JSON.stringify(params)}`);
            }

            if (verbose) {
                console.log(`[${current}/${totalCombinations}] 파라미터:`, params);
            }

            try {
                // 백테스트 실행
                const backtestResult = this.backtestFunction(params);

                // 지표 추출
                const score = this.extractMetric(backtestResult, metric);

                const result = {
                    params: params,
                    score: score,
                    metrics: this.extractAllMetrics(backtestResult),
                    backtestResult: backtestResult
                };

                allResults.push(result);

                // 최적 파라미터 업데이트
                if (score > bestScore) {
                    bestScore = score;
                    bestParams = params;
                    if (verbose) {
                        console.log(`  → 새로운 최적 파라미터 발견! 점수: ${score.toFixed(4)}`);
                    }
                }
            } catch (error) {
                console.error(`파라미터 조합 실행 중 오류:`, params, error);
                allResults.push({
                    params: params,
                    score: -Infinity,
                    error: error.message
                });
            }
        });

        // 파라미터 민감도 분석
        const paramSensitivity = this.analyzeParamSensitivity(allResults, metric);

        return {
            bestParams: bestParams,
            bestScore: bestScore,
            allResults: allResults.sort((a, b) => b.score - a.score), // 점수 내림차순 정렬
            paramSensitivity: paramSensitivity,
            metric: metric,
            totalCombinations: totalCombinations
        };
    }

    /**
     * 파라미터 조합 생성 (Grid Search)
     * @param {Object} paramGrid - 파라미터 그리드
     * @param {number} maxCombinations - 최대 조합 수 (제한용)
     * @returns {Array<Object>} 파라미터 조합 배열
     */
    generateParamCombinations(paramGrid, maxCombinations = null) {
        const paramNames = Object.keys(paramGrid);
        const paramValues = paramNames.map(name => paramGrid[name]);

        // 모든 조합 생성 (Cartesian Product)
        let combinations = [[]];

        paramValues.forEach(values => {
            const newCombinations = [];
            combinations.forEach(combo => {
                values.forEach(value => {
                    newCombinations.push([...combo, value]);
                });
            });
            combinations = newCombinations;
        });

        // 객체 배열로 변환
        const result = combinations.map(combo => {
            const obj = {};
            paramNames.forEach((name, idx) => {
                obj[name] = combo[idx];
            });
            return obj;
        });

        // 최대 조합 수 제한 (랜덤 샘플링)
        if (maxCombinations && result.length > maxCombinations) {
            console.warn(`조합 수(${result.length})가 최대값(${maxCombinations})을 초과합니다. 랜덤 샘플링합니다.`);
            const shuffled = [...result].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, maxCombinations);
        }

        return result;
    }

    /**
     * 백테스트 결과에서 특정 지표 추출
     * @param {Object} backtestResult - 백테스트 결과
     * @param {string} metric - 지표 이름
     * @returns {number} 지표 값
     */
    extractMetric(backtestResult, metric) {
        const stats = backtestResult.statistics || {};

        switch (metric) {
            case 'hit_rate_3':
                return stats.hitRates && stats.hitRates[3] ? stats.hitRates[3] : 
                       stats.hit3PlusRate ? stats.hit3PlusRate : 0;
            case 'hit_rate_4':
                return stats.hitRates && stats.hitRates[4] ? stats.hitRates[4] : 0;
            case 'average_hits':
                return stats.averageHits || 0;
            case 'lift_3':
                return stats.lifts && stats.lifts[3] ? stats.lifts[3] : 0;
            case 'lift_4':
                return stats.lifts && stats.lifts[4] ? stats.lifts[4] : 0;
            case 'sharpe_ratio':
                return stats.sharpeLikeRatio || 0;
            case 'mrr':
                return stats.mrr || 0;
            case 'top6_accuracy':
                return stats.top6Accuracy || 0;
            default:
                console.warn(`알 수 없는 지표: ${metric}`);
                return 0;
        }
    }

    /**
     * 모든 주요 지표 추출
     * @param {Object} backtestResult - 백테스트 결과
     * @returns {Object} 지표 객체
     */
    extractAllMetrics(backtestResult) {
        const stats = backtestResult.statistics || {};
        return {
            hit_rate_3: stats.hitRates && stats.hitRates[3] ? stats.hitRates[3] : stats.hit3PlusRate || 0,
            hit_rate_4: stats.hitRates && stats.hitRates[4] ? stats.hitRates[4] : 0,
            average_hits: stats.averageHits || 0,
            lift_3: stats.lifts && stats.lifts[3] ? stats.lifts[3] : 0,
            lift_4: stats.lifts && stats.lifts[4] ? stats.lifts[4] : 0,
            sharpe_ratio: stats.sharpeLikeRatio || 0,
            mrr: stats.mrr || 0,
            top6_accuracy: stats.top6Accuracy || 0
        };
    }

    /**
     * 파라미터별 민감도 분석
     * @param {Array} allResults - 모든 결과
     * @param {string} metric - 분석할 지표
     * @returns {Object} 파라미터별 민감도
     */
    analyzeParamSensitivity(allResults, metric) {
        if (allResults.length === 0) {
            return {};
        }

        const sensitivity = {};
        const paramNames = Object.keys(allResults[0].params || {});

        paramNames.forEach(paramName => {
            // 파라미터 값별로 그룹화
            const groups = {};
            
            allResults.forEach(result => {
                if (result.error) return; // 오류 결과 제외
                
                const value = result.params[paramName];
                if (!groups[value]) {
                    groups[value] = [];
                }
                groups[value].push(result.score);
            });

            // 각 값별 평균 점수 계산
            const valueScores = {};
            Object.keys(groups).forEach(value => {
                const scores = groups[value];
                valueScores[value] = {
                    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
                    std: this.calculateStdDev(scores),
                    count: scores.length
                };
            });

            // 최고/최저 값 찾기
            const values = Object.keys(valueScores);
            if (values.length > 0) {
                const scores = values.map(v => valueScores[v].mean);
                const maxScore = Math.max(...scores);
                const minScore = Math.min(...scores);
                const bestValue = values.find(v => valueScores[v].mean === maxScore);
                const worstValue = values.find(v => valueScores[v].mean === minScore);

                sensitivity[paramName] = {
                    valueScores: valueScores,
                    bestValue: bestValue,
                    worstValue: worstValue,
                    range: maxScore - minScore,
                    relativeRange: minScore > 0 ? (maxScore - minScore) / minScore : 0
                };
            }
        });

        return sensitivity;
    }

    /**
     * 표준편차 계산
     * @param {number[]} values - 값 배열
     * @returns {number} 표준편차
     */
    calculateStdDev(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
}

/**
 * Sequential Optimization (순차 최적화)
 * 중요 파라미터부터 순차적으로 최적화
 */
class SequentialOptimizer {
    /**
     * @param {Function} backtestFunction - 백테스트 함수
     * @param {Array} paramOrder - 최적화 순서 (파라미터 이름 배열)
     */
    constructor(backtestFunction, paramOrder = []) {
        this.backtestFunction = backtestFunction;
        this.paramOrder = paramOrder;
    }

    /**
     * 순차 최적화 실행
     * @param {Object} baseParams - 기본 파라미터
     * @param {Object} paramGrid - 파라미터 그리드
     * @param {string} metric - 목표 지표
     * @param {Function} progressCallback - 진행율 콜백
     * @returns {OptimizationResult} 최적화 결과
     */
    optimize(baseParams = {}, paramGrid = {}, metric = 'hit_rate_3', progressCallback = null) {
        let currentParams = { ...baseParams };
        const optimizationHistory = [];

        this.paramOrder.forEach((paramName, idx) => {
            if (!paramGrid[paramName] || paramGrid[paramName].length === 0) {
                return; // 해당 파라미터 스킵
            }

            // 현재 파라미터에 대한 Grid Search
            const singleParamGrid = { [paramName]: paramGrid[paramName] };
            const tempOptimizer = new StrategyOptimizer(
                (params) => this.backtestFunction({ ...currentParams, ...params }),
                singleParamGrid
            );

            const progressWrapper = (progress, current, total, detail) => {
                const overallProgress = ((idx / this.paramOrder.length) * 100) + 
                                       (progress / this.paramOrder.length);
                if (progressCallback) {
                    progressCallback(overallProgress, idx + 1, this.paramOrder.length, 
                        `파라미터 ${paramName} 최적화 중...`);
                }
            };

            const result = tempOptimizer.optimize({ metric, verbose: false }, progressWrapper);

            // 최적 파라미터 업데이트
            if (result.bestParams) {
                currentParams[paramName] = result.bestParams[paramName];
                optimizationHistory.push({
                    paramName: paramName,
                    bestValue: result.bestParams[paramName],
                    bestScore: result.bestScore,
                    allResults: result.allResults
                });
            }
        });

        return {
            bestParams: currentParams,
            optimizationHistory: optimizationHistory,
            metric: metric
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        StrategyOptimizer,
        SequentialOptimizer
    };
}
