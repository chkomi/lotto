/**
 * 백테스팅 모듈
 * 과거 데이터로 모델의 예측 성능을 검증
 */

class Backtester {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.results = [];
    }

    /**
     * 백테스트 실행
     * @param {number} startRound - 백테스트 시작 회차
     * @param {number} endRound - 백테스트 종료 회차
     * @param {number} topN - 상위 N개 번호 평가 (기본 10)
     * @param {string} method - 분석 방법 ('entropy', 'topsis', 'randomForest', 'association', 'ensemble')
     * @param {Function} analysisFunction - 분석 함수 (선택사항, 없으면 analyzer.analyze 사용)
     * @param {Function} progressCallback - 진행율 콜백 함수 (progress, current, total, detail)
     * @returns {Object} 백테스트 결과
     */
    run(startRound, endRound, topN = 10, method = 'entropy', analysisFunction = null, progressCallback = null) {
        console.log(`Starting backtest from round ${startRound} to ${endRound} with method: ${method}`);

        this.results = [];
        const allData = this.analyzer.data;
        const totalRounds = endRound - startRound + 1;

        // 분석 함수가 제공되지 않으면 기본 analyzer.analyze 사용
        const analyzeFn = analysisFunction || ((round) => this.analyzer.analyze(round));

        // 각 회차에 대해 예측 및 검증
        for (let round = startRound; round <= endRound; round++) {
            const currentIndex = round - startRound + 1;
            const progress = (currentIndex / totalRounds) * 100;

            // 진행율 콜백 호출 (UI 업데이트를 위해 약간의 지연)
            if (progressCallback) {
                // 진행율 업데이트를 위해 브라우저 렌더링 시간 제공
                if (currentIndex % 5 === 0 || currentIndex === 1 || currentIndex === totalRounds) {
                    progressCallback(progress, currentIndex, totalRounds, `회차 ${round} 처리 중...`);
                } else {
                    // 더 자주 업데이트하려면 (성능 고려)
                    progressCallback(progress, currentIndex, totalRounds, `회차 ${round} 처리 중...`);
                }
            }

            // 이전 데이터로 학습하여 현재 회차 예측
            const analysis = analyzeFn(round - 1);

            // 실제 당첨 번호
            const actualData = allData.find(d => d.round === round);
            if (!actualData) continue;

            const actualNumbers = actualData.numbers;
            const actualBonus = actualData.bonus;

            // 상위 topN개 예측 번호
            const predictedTop = analysis.predictions.slice(0, topN);
            const predictedNumbers = predictedTop.map(p => p.number);

            // 적중 개수 계산
            const hits = this.countHits(predictedNumbers, actualNumbers);
            const bonusHit = predictedNumbers.includes(actualBonus);

            // 실제 번호들의 예측 순위
            const actualRanks = actualNumbers.map(num => {
                const pred = analysis.predictions.find(p => p.number === num);
                return pred ? pred.rank : 999;
            });

            // 평균 순위
            const avgRank = actualRanks.reduce((a, b) => a + b, 0) / actualRanks.length;

            // 결과 저장
            this.results.push({
                round: round,
                predicted: predictedNumbers,
                actual: actualNumbers,
                bonus: actualBonus,
                hits: hits,
                bonusHit: bonusHit,
                actualRanks: actualRanks,
                avgRank: avgRank,
                top6Accuracy: hits / 6,
                weights: analysis.weights,
                method: method
            });
        }

        // 전체 통계 계산
        const stats = this.calculateStatistics(topN);

        return {
            results: this.results,
            statistics: stats,
            topN: topN,
            totalRounds: this.results.length,
            method: method
        };
    }

    /**
     * 적중 개수 계산
     */
    countHits(predicted, actual) {
        let count = 0;
        predicted.forEach(p => {
            if (actual.includes(p)) count++;
        });
        return count;
    }

    /**
     * 백테스트 통계 계산
     */
    calculateStatistics(topN) {
        if (this.results.length === 0) return null;

        // 적중 개수별 분포
        const hitDistribution = {};
        for (let i = 0; i <= 6; i++) {
            hitDistribution[i] = 0;
        }

        let totalHits = 0;
        let totalAvgRank = 0;
        let bonusHits = 0;

        // Top 6, Top 10 정확도
        const top6Predictions = [];
        const top10Predictions = [];

        this.results.forEach(r => {
            hitDistribution[r.hits]++;
            totalHits += r.hits;
            totalAvgRank += r.avgRank;
            if (r.bonusHit) bonusHits++;

            // Top 6로 예측했을 때 적중 개수
            const top6 = r.predicted.slice(0, 6);
            const hits6 = this.countHits(top6, r.actual);
            top6Predictions.push(hits6);

            // Top 10으로 예측했을 때 적중 개수
            const top10 = r.predicted.slice(0, 10);
            const hits10 = this.countHits(top10, r.actual);
            top10Predictions.push(hits10);
        });

        // 평균 계산
        const avgHits = totalHits / this.results.length;
        const avgRank = totalAvgRank / this.results.length;
        const avgTop6Hits = top6Predictions.reduce((a, b) => a + b, 0) / top6Predictions.length;
        const avgTop10Hits = top10Predictions.reduce((a, b) => a + b, 0) / top10Predictions.length;

        // 최고/최저 성과
        const bestResult = this.results.reduce((best, curr) =>
            curr.hits > best.hits ? curr : best
        );
        const worstResult = this.results.reduce((worst, curr) =>
            curr.hits < worst.hits ? curr : worst
        );

        // 3개 이상 맞춘 비율
        const hit3Plus = Object.keys(hitDistribution)
            .filter(k => parseInt(k) >= 3)
            .reduce((sum, k) => sum + hitDistribution[k], 0);
        const hit3PlusRate = hit3Plus / this.results.length;

        return {
            totalRounds: this.results.length,
            averageHits: avgHits,
            averageRank: avgRank,
            averageTop6Hits: avgTop6Hits,
            averageTop10Hits: avgTop10Hits,
            bonusHitRate: bonusHits / this.results.length,
            hitDistribution: hitDistribution,
            hit3PlusRate: hit3PlusRate,
            bestRound: bestResult.round,
            bestHits: bestResult.hits,
            worstRound: worstResult.round,
            worstHits: worstResult.hits,
            top6Accuracy: avgTop6Hits / 6,  // 0-1 범위
            top10Accuracy: avgTop10Hits / 6  // 0-1 범위
        };
    }

    /**
     * 결과를 CSV 형식으로 내보내기
     */
    exportToCSV() {
        if (this.results.length === 0) return '';

        const headers = [
            'Round',
            'Predicted',
            'Actual',
            'Bonus',
            'Hits',
            'BonusHit',
            'AvgRank',
            'Top6Accuracy'
        ];

        let csv = headers.join(',') + '\n';

        this.results.forEach(r => {
            const row = [
                r.round,
                r.predicted.join('|'),
                r.actual.join('|'),
                r.bonus,
                r.hits,
                r.bonusHit ? 1 : 0,
                r.avgRank.toFixed(2),
                r.top6Accuracy.toFixed(4)
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    /**
     * 특정 회차의 상세 결과 반환
     */
    getRoundDetail(round) {
        return this.results.find(r => r.round === round);
    }

    /**
     * 시간에 따른 성능 추이
     */
    getPerformanceTrend(windowSize = 10) {
        if (this.results.length < windowSize) return [];

        const trend = [];

        for (let i = windowSize - 1; i < this.results.length; i++) {
            const window = this.results.slice(i - windowSize + 1, i + 1);
            const avgHits = window.reduce((sum, r) => sum + r.hits, 0) / windowSize;
            const avgRank = window.reduce((sum, r) => sum + r.avgRank, 0) / windowSize;

            trend.push({
                round: this.results[i].round,
                avgHits: avgHits,
                avgRank: avgRank
            });
        }

        return trend;
    }

    /**
     * 번호별 예측 정확도
     */
    getNumberAccuracy() {
        const accuracy = {};

        // 각 번호에 대해 예측 정확도 계산
        for (let num = 1; num <= 45; num++) {
            let predicted = 0;  // 예측한 횟수
            let hit = 0;        // 예측이 맞은 횟수
            let appeared = 0;   // 실제로 나온 횟수

            this.results.forEach(r => {
                if (r.predicted.includes(num)) {
                    predicted++;
                    if (r.actual.includes(num)) {
                        hit++;
                    }
                }
                if (r.actual.includes(num)) {
                    appeared++;
                }
            });

            accuracy[num] = {
                predicted: predicted,
                hit: hit,
                appeared: appeared,
                precision: predicted > 0 ? hit / predicted : 0,  // 예측 정밀도
                recall: appeared > 0 ? hit / appeared : 0        // 재현율
            };
        }

        return accuracy;
    }

    /**
     * 상위 N개 예측의 적중률 비교
     */
    compareTopNPerformance() {
        const topNs = [6, 8, 10, 12, 15];
        const comparison = {};

        topNs.forEach(n => {
            let totalHits = 0;

            this.results.forEach(r => {
                const topN = r.predicted.slice(0, n);
                const hits = this.countHits(topN, r.actual);
                totalHits += hits;
            });

            comparison[`top${n}`] = {
                avgHits: totalHits / this.results.length,
                accuracy: totalHits / (this.results.length * 6)
            };
        });

        return comparison;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Backtester;
}
