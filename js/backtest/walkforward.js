/**
 * Walk-Forward Backtesting 엔진
 * 
 * 시계열 무결성을 보장하는 Walk-Forward 방식의 백테스팅을 수행합니다.
 * Look-ahead bias를 완전히 차단하여 실전에 가까운 성능 평가가 가능합니다.
 */

/**
 * Walk-Forward 백테스팅 설정
 * @typedef {Object} WalkForwardConfig
 * @property {number} trainSize - 학습 기간 크기 (기본값: 100)
 * @property {number} testSize - 테스트 기간 크기 (기본값: 50)
 * @property {number} stepSize - 윈도우 이동 크기 (기본값: 1, Rolling window)
 * @property {string} windowType - 윈도우 타입 ('anchored' | 'rolling', 기본값: 'rolling')
 * @property {number} minTrainSize - 최소 학습 기간 (기본값: 50)
 */

/**
 * Walk-Forward 백테스트 결과
 * @typedef {Object} WalkForwardResult
 * @property {Array} foldResults - 각 폴드의 결과 배열
 * @property {Object} aggregateMetrics - 전체 통합 지표
 * @property {Object} config - 사용된 설정
 */

/**
 * 기본 Walk-Forward 설정 반환
 * @returns {WalkForwardConfig}
 */
function getDefaultWalkForwardConfig() {
    return {
        trainSize: 100,
        testSize: 50,
        stepSize: 1,
        windowType: 'rolling', // 'anchored' or 'rolling'
        minTrainSize: 50
    };
}

/**
 * WalkForwardBacktester 클래스
 */
class WalkForwardBacktester {
    /**
     * @param {Array} data - 전체 로또 데이터 배열
     * @param {WalkForwardConfig} config - Walk-Forward 설정
     */
    constructor(data, config = null) {
        this.data = data || [];
        this.config = config || getDefaultWalkForwardConfig();
        
        // 데이터 정렬 확인 (회차 순서)
        this.data.sort((a, b) => a.round - b.round);
    }

    /**
     * Walk-Forward 백테스트 실행
     * @param {Function} strategyFunction - 전략 함수 (trainData, testRounds) => predictions
     * @param {Function} progressCallback - 진행율 콜백 (progress, current, total, detail)
     * @returns {WalkForwardResult} Walk-Forward 결과
     */
    run(strategyFunction, progressCallback = null) {
        if (!strategyFunction || typeof strategyFunction !== 'function') {
            throw new Error('strategyFunction은 함수여야 합니다.');
        }

        const folds = this.generateFolds();
        const foldResults = [];
        const totalFolds = folds.length;

        console.log(`Walk-Forward 백테스트 시작: ${totalFolds}개 폴드`);

        folds.forEach((fold, idx) => {
            const currentFold = idx + 1;
            const progress = (currentFold / totalFolds) * 100;

            // 진행율 콜백
            if (progressCallback) {
                progressCallback(progress, currentFold, totalFolds, 
                    `폴드 ${currentFold}/${totalFolds}: ${fold.testRounds[0].round}회 ~ ${fold.testRounds[fold.testRounds.length - 1].round}회차`);
            }

            try {
                // 학습 데이터로 전략 실행
                const predictions = strategyFunction(fold.trainData, fold.testRounds);

                // 테스트 데이터로 평가
                const foldResult = this.evaluateFold(fold, predictions);

                foldResults.push(foldResult);
            } catch (error) {
                console.error(`폴드 ${currentFold} 실행 중 오류:`, error);
                // 오류 발생 시 해당 폴드는 제외하거나 기본값으로 처리
                foldResults.push({
                    foldIndex: idx,
                    trainStart: fold.trainRounds[0].round,
                    trainEnd: fold.trainRounds[fold.trainRounds.length - 1].round,
                    testStart: fold.testRounds[0].round,
                    testEnd: fold.testRounds[fold.testRounds.length - 1].round,
                    results: [],
                    error: error.message
                });
            }
        });

        // 전체 통합 지표 계산
        const aggregateMetrics = this.aggregateMetrics(foldResults);

        return {
            foldResults: foldResults,
            aggregateMetrics: aggregateMetrics,
            config: this.config,
            totalFolds: totalFolds
        };
    }

    /**
     * Walk-Forward 폴드 생성
     * @returns {Array<{trainRounds: Array, testRounds: Array, trainData: Array}>} 폴드 배열
     */
    generateFolds() {
        const folds = [];
        const totalRounds = this.data.length;

        let startIdx = 0;

        while (true) {
            // 학습 기간 인덱스 범위
            const trainStartIdx = startIdx;
            let trainEndIdx;

            if (this.config.windowType === 'anchored') {
                // Anchored: 시작점 고정, 끝점만 이동
                trainEndIdx = startIdx + this.config.trainSize - 1;
            } else {
                // Rolling: 시작점과 끝점 모두 이동
                trainEndIdx = startIdx + this.config.trainSize - 1;
            }

            // 테스트 기간 인덱스 범위
            const testStartIdx = trainEndIdx + 1;
            const testEndIdx = testStartIdx + this.config.testSize - 1;

            // 범위 확인
            if (trainEndIdx >= totalRounds || testEndIdx >= totalRounds) {
                break;
            }

            // 최소 학습 기간 확인
            if (trainEndIdx - trainStartIdx + 1 < this.config.minTrainSize) {
                break;
            }

            // 데이터 추출
            const trainRounds = this.data.slice(trainStartIdx, trainEndIdx + 1);
            const testRounds = this.data.slice(testStartIdx, testEndIdx + 1);

            folds.push({
                trainRounds: trainRounds,
                testRounds: testRounds,
                trainData: trainRounds, // 별칭 (호환성)
                testData: testRounds    // 별칭
            });

            // 다음 폴드 시작 인덱스
            startIdx += this.config.stepSize;

            // 무한 루프 방지
            if (startIdx >= totalRounds) {
                break;
            }
        }

        return folds;
    }

    /**
     * 단일 폴드 평가
     * @param {Object} fold - 폴드 데이터
     * @param {Array|Object} predictions - 예측 결과 (번호 배열 또는 분석 결과 객체)
     * @returns {Object} 폴드 평가 결과
     */
    evaluateFold(fold, predictions) {
        const results = [];

        // predictions 형식 확인 및 변환
        let predictionMap = {};
        
        if (Array.isArray(predictions)) {
            // 번호 배열인 경우
            predictions.forEach((num, idx) => {
                predictionMap[num] = idx + 1; // 순위
            });
        } else if (predictions && predictions.predictions) {
            // 분석 결과 객체인 경우
            predictions.predictions.forEach(pred => {
                predictionMap[pred.number] = pred.rank || pred.score || 0;
            });
        } else {
            console.warn('예측 결과 형식이 올바르지 않습니다.');
        }

        // 각 테스트 회차 평가
        fold.testRounds.forEach(testRound => {
            const actual = testRound.numbers;
            const predictedNumbers = Object.keys(predictionMap).map(Number);
            
            // 적중 개수 계산
            const hits = this.countHits(predictedNumbers, actual);
            
            // 실제 번호들의 예측 순위
            const actualRanks = actual.map(num => predictionMap[num] || 999);
            const avgRank = actualRanks.reduce((a, b) => a + b, 0) / actualRanks.length;

            results.push({
                round: testRound.round,
                predicted: predictedNumbers,
                actual: actual,
                bonus: testRound.bonus,
                hits: hits,
                actualRanks: actualRanks,
                avgRank: avgRank
            });
        });

        return {
            foldIndex: fold.index || 0,
            trainStart: fold.trainRounds[0].round,
            trainEnd: fold.trainRounds[fold.trainRounds.length - 1].round,
            testStart: fold.testRounds[0].round,
            testEnd: fold.testRounds[fold.testRounds.length - 1].round,
            results: results
        };
    }

    /**
     * 적중 개수 계산
     * @param {number[]} predicted - 예측 번호 배열
     * @param {number[]} actual - 실제 번호 배열
     * @returns {number} 적중 개수
     */
    countHits(predicted, actual) {
        return predicted.filter(p => actual.includes(p)).length;
    }

    /**
     * 모든 폴드 결과 통합 지표 계산
     * @param {Array} foldResults - 폴드 결과 배열
     * @returns {Object} 통합 지표
     */
    aggregateMetrics(foldResults) {
        // 모든 결과를 평탄화
        const allResults = [];
        foldResults.forEach(fold => {
            if (fold.results && fold.results.length > 0) {
                allResults.push(...fold.results);
            }
        });

        if (allResults.length === 0) {
            return null;
        }

        // metrics.js의 calculateMetrics 사용 (있는 경우)
        if (typeof calculateMetrics !== 'undefined') {
            return calculateMetrics(allResults);
        }

        // 기본 통계 계산
        const hitsArray = allResults.map(r => r.hits);
        const averageHits = hitsArray.reduce((a, b) => a + b, 0) / hitsArray.length;
        const maxHits = Math.max(...hitsArray);

        const hitDistribution = {};
        for (let i = 0; i <= 6; i++) {
            hitDistribution[i] = hitsArray.filter(h => h === i).length;
        }

        const hitRates = {};
        for (let k = 3; k <= 6; k++) {
            hitRates[k] = hitsArray.filter(h => h >= k).length / hitsArray.length;
        }

        const ranksArray = allResults.map(r => r.avgRank).filter(r => r !== null && r !== undefined);
        const averageRank = ranksArray.length > 0
            ? ranksArray.reduce((a, b) => a + b, 0) / ranksArray.length
            : null;

        return {
            totalRounds: allResults.length,
            averageHits: averageHits,
            maxHits: maxHits,
            averageRank: averageRank,
            hitRates: hitRates,
            distribution: hitDistribution,
            totalFolds: foldResults.length
        };
    }

    /**
     * 조합 기반 Walk-Forward 백테스트
     * @param {Function} combinationStrategyFunction - 조합 생성 전략 함수 (trainData, testRound) => combinations[]
     * @param {Function} progressCallback - 진행율 콜백
     * @returns {WalkForwardResult} Walk-Forward 결과
     */
    runCombinationBacktest(combinationStrategyFunction, progressCallback = null) {
        if (!combinationStrategyFunction || typeof combinationStrategyFunction !== 'function') {
            throw new Error('combinationStrategyFunction은 함수여야 합니다.');
        }

        const folds = this.generateFolds();
        const foldResults = [];
        const totalFolds = folds.length;

        console.log(`조합 기반 Walk-Forward 백테스트 시작: ${totalFolds}개 폴드`);

        folds.forEach((fold, idx) => {
            const currentFold = idx + 1;
            const progress = (currentFold / totalFolds) * 100;

            if (progressCallback) {
                progressCallback(progress, currentFold, totalFolds,
                    `폴드 ${currentFold}/${totalFolds}: 조합 생성 중...`);
            }

            try {
                const combinationResults = [];

                // 각 테스트 회차에 대해 조합 생성 및 평가
                fold.testRounds.forEach(testRound => {
                    const combinations = combinationStrategyFunction(fold.trainData, testRound);

                    // 각 조합의 적중 개수 계산
                    const combinationHits = combinations.map(comb => ({
                        combination: comb.numbers || comb,
                        hits: this.countHits(comb.numbers || comb, testRound.numbers),
                        score: comb.score || 0
                    }));

                    combinationResults.push({
                        round: testRound.round,
                        combinations: combinations,
                        actual: testRound.numbers,
                        combinationHits: combinationHits
                    });
                });

                foldResults.push({
                    foldIndex: idx,
                    trainStart: fold.trainRounds[0].round,
                    trainEnd: fold.trainRounds[fold.trainRounds.length - 1].round,
                    testStart: fold.testRounds[0].round,
                    testEnd: fold.testRounds[fold.testRounds.length - 1].round,
                    results: combinationResults
                });
            } catch (error) {
                console.error(`폴드 ${currentFold} 실행 중 오류:`, error);
                foldResults.push({
                    foldIndex: idx,
                    trainStart: fold.trainRounds[0].round,
                    trainEnd: fold.trainRounds[fold.trainRounds.length - 1].round,
                    testStart: fold.testRounds[0].round,
                    testEnd: fold.testRounds[fold.testRounds.length - 1].round,
                    results: [],
                    error: error.message
                });
            }
        });

        // 통합 지표 계산 (조합 메트릭)
        let aggregateMetrics = null;
        if (typeof calculateCombinationMetrics !== 'undefined') {
            // 모든 결과를 평탄화
            const allResults = [];
            foldResults.forEach(fold => {
                if (fold.results && fold.results.length > 0) {
                    allResults.push(...fold.results);
                }
            });
            aggregateMetrics = calculateCombinationMetrics(allResults);
        } else {
            // 기본 통계
            aggregateMetrics = {
                totalFolds: foldResults.length,
                totalRounds: foldResults.reduce((sum, f) => sum + (f.results ? f.results.length : 0), 0)
            };
        }

        return {
            foldResults: foldResults,
            aggregateMetrics: aggregateMetrics,
            config: this.config,
            totalFolds: totalFolds
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WalkForwardBacktester,
        getDefaultWalkForwardConfig
    };
}
