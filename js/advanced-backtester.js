/**
 * 고급 백테스팅 시스템
 * 확률 점수 기반의 정밀 백테스팅 및 성과 분석
 */

class AdvancedBacktester {
    constructor(data) {
        this.data = data;
        this.scorer = new ProbabilityScorer();
        this.results = [];
        this.calibrationData = [];
    }

    /**
     * 확률 점수 기반 백테스트 실행
     * @param {number} startRound - 시작 회차
     * @param {number} endRound - 종료 회차
     * @param {number} topN - 상위 N개 번호 평가
     * @param {Function} progressCallback - 진행률 콜백
     * @returns {Object} 백테스트 결과
     */
    runProbabilityBacktest(startRound, endRound, topN = 10, progressCallback = null) {
        console.log(`[AdvancedBacktester] Starting probability backtest: ${startRound} - ${endRound}`);

        this.results = [];
        this.calibrationData = [];
        const totalRounds = endRound - startRound + 1;

        for (let round = startRound; round <= endRound; round++) {
            const currentIndex = round - startRound + 1;
            const progress = (currentIndex / totalRounds) * 100;

            if (progressCallback) {
                progressCallback(progress, currentIndex, totalRounds, `회차 ${round} 분석 중...`);
            }

            // 이전 회차까지의 데이터로 확률 점수 계산
            try {
                const scores = this.scorer.calculateAllScores(this.data, round - 1);

                // 실제 당첨 번호
                const actualData = this.data.find(d => d.round === round);
                if (!actualData) continue;

                const actualNumbers = actualData.numbers;
                const actualBonus = actualData.bonus;

                // 예측 번호 (상위 topN)
                const predictedNumbers = this.scorer.getTopN(scores, topN);

                // 적중 분석
                const hits = this.countHits(predictedNumbers, actualNumbers);
                const bonusHit = predictedNumbers.includes(actualBonus);

                // 각 번호의 점수와 실제 출현 여부 기록 (캘리브레이션용)
                const scoreDetails = scores.map(s => ({
                    number: s.number,
                    probability: s.probability,
                    appeared: actualNumbers.includes(s.number),
                    inTop: predictedNumbers.includes(s.number)
                }));

                // 점수 기반 분석
                const actualScores = actualNumbers.map(num => {
                    const scoreInfo = scores.find(s => s.number === num);
                    return scoreInfo ? scoreInfo.probability : 0;
                });

                const avgActualScore = actualScores.reduce((a, b) => a + b, 0) / actualScores.length;
                const avgTopScore = scores.slice(0, topN).reduce((a, b) => a + b.probability, 0) / topN;

                // 실제 번호들의 예측 순위
                const actualRanks = actualNumbers.map(num => {
                    const idx = scores.findIndex(s => s.number === num);
                    return idx >= 0 ? idx + 1 : 45;
                });
                const avgRank = actualRanks.reduce((a, b) => a + b, 0) / actualRanks.length;

                // 결과 저장
                this.results.push({
                    round: round,
                    predicted: predictedNumbers,
                    actual: actualNumbers,
                    bonus: actualBonus,
                    hits: hits,
                    bonusHit: bonusHit,
                    avgActualScore: avgActualScore,
                    avgTopScore: avgTopScore,
                    actualRanks: actualRanks,
                    avgRank: avgRank,
                    scoreDetails: scoreDetails
                });

                // 캘리브레이션 데이터 저장
                this.calibrationData.push({
                    round: round,
                    scores: scores,
                    actual: actualNumbers
                });

            } catch (error) {
                console.error(`Round ${round} analysis failed:`, error);
            }
        }

        // 통계 계산
        const statistics = this.calculateStatistics(topN);
        const calibration = this.scorer.analyzeCalibration(this.calibrationData);
        const scorePerformance = this.analyzeScorePerformance();

        return {
            results: this.results,
            statistics: statistics,
            calibration: calibration,
            scorePerformance: scorePerformance,
            topN: topN,
            totalRounds: this.results.length
        };
    }

    /**
     * 적중 개수 계산
     */
    countHits(predicted, actual) {
        return predicted.filter(p => actual.includes(p)).length;
    }

    /**
     * 통계 계산
     */
    calculateStatistics(topN) {
        if (this.results.length === 0) return null;

        // 적중 개수별 분포
        const hitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        let totalHits = 0;
        let totalAvgRank = 0;
        let totalAvgActualScore = 0;
        let bonusHits = 0;

        this.results.forEach(r => {
            hitDistribution[r.hits]++;
            totalHits += r.hits;
            totalAvgRank += r.avgRank;
            totalAvgActualScore += r.avgActualScore;
            if (r.bonusHit) bonusHits++;
        });

        const n = this.results.length;
        const avgHits = totalHits / n;
        const avgRank = totalAvgRank / n;
        const avgActualScore = totalAvgActualScore / n;

        // 3개 이상 적중률
        const hit3Plus = [3, 4, 5, 6].reduce((sum, k) => sum + hitDistribution[k], 0);
        const hit3PlusRate = hit3Plus / n;

        // 무작위 기준선 대비 성과
        const randomBaseline = {
            avgHits: 6 * (topN / 45),
            hit3PlusRate: this.calculateRandomHit3Plus(topN)
        };

        const improvement = {
            avgHits: ((avgHits - randomBaseline.avgHits) / randomBaseline.avgHits) * 100,
            hit3PlusRate: ((hit3PlusRate - randomBaseline.hit3PlusRate) / randomBaseline.hit3PlusRate) * 100
        };

        // 최고/최저 성과
        const bestResult = this.results.reduce((best, curr) => curr.hits > best.hits ? curr : best);
        const worstResult = this.results.reduce((worst, curr) => curr.hits < worst.hits ? curr : worst);

        return {
            totalRounds: n,
            averageHits: avgHits,
            averageRank: avgRank,
            averageActualScore: avgActualScore,
            bonusHitRate: bonusHits / n,
            hitDistribution: hitDistribution,
            hit3PlusRate: hit3PlusRate,
            randomBaseline: randomBaseline,
            improvement: improvement,
            bestRound: bestResult.round,
            bestHits: bestResult.hits,
            worstRound: worstResult.round,
            worstHits: worstResult.hits
        };
    }

    /**
     * 무작위 3개 이상 적중 확률 계산
     */
    calculateRandomHit3Plus(topN) {
        // 초기하분포 기반 계산
        // P(X >= 3) where X ~ Hypergeometric(45, 6, topN)
        let prob = 0;
        for (let k = 3; k <= Math.min(6, topN); k++) {
            prob += this.hypergeometricPMF(k, 45, 6, topN);
        }
        return prob;
    }

    /**
     * 초기하분포 확률질량함수
     */
    hypergeometricPMF(k, N, K, n) {
        return (this.combination(K, k) * this.combination(N - K, n - k)) / this.combination(N, n);
    }

    /**
     * 조합 계산
     */
    combination(n, k) {
        if (k > n || k < 0) return 0;
        if (k === 0 || k === n) return 1;

        let result = 1;
        for (let i = 0; i < k; i++) {
            result = result * (n - i) / (i + 1);
        }
        return result;
    }

    /**
     * 점수별 성과 분석
     */
    analyzeScorePerformance() {
        const scoreBands = [
            { range: '80-100', min: 80, max: 100, predicted: 0, hits: 0, accuracy: 0 },
            { range: '60-80', min: 60, max: 80, predicted: 0, hits: 0, accuracy: 0 },
            { range: '40-60', min: 40, max: 60, predicted: 0, hits: 0, accuracy: 0 },
            { range: '20-40', min: 20, max: 40, predicted: 0, hits: 0, accuracy: 0 },
            { range: '0-20', min: 0, max: 20, predicted: 0, hits: 0, accuracy: 0 }
        ];

        this.calibrationData.forEach(data => {
            data.scores.forEach(s => {
                const band = scoreBands.find(b => s.probability >= b.min && s.probability < b.max);
                if (band) {
                    band.predicted++;
                    if (data.actual.includes(s.number)) {
                        band.hits++;
                    }
                }
            });
        });

        scoreBands.forEach(band => {
            band.accuracy = band.predicted > 0 ? (band.hits / band.predicted) * 100 : 0;
            band.expectedHits = band.predicted * (6 / 45) * 100;  // 무작위 기대값
            band.lift = band.accuracy / (6 / 45 * 100);  // 리프트 (무작위 대비)
        });

        return scoreBands;
    }

    /**
     * 번호별 예측 정확도
     */
    getNumberAccuracy() {
        const accuracy = {};

        for (let num = 1; num <= 45; num++) {
            let totalScore = 0;
            let scoreCount = 0;
            let appearances = 0;
            let highScoreAppearances = 0;  // 높은 점수일 때 출현
            let highScoreTotal = 0;

            this.calibrationData.forEach(data => {
                const scoreInfo = data.scores.find(s => s.number === num);
                if (scoreInfo) {
                    totalScore += scoreInfo.probability;
                    scoreCount++;

                    if (data.actual.includes(num)) {
                        appearances++;
                    }

                    // 상위 점수 (상위 50%)일 때
                    if (scoreInfo.probability >= 50) {
                        highScoreTotal++;
                        if (data.actual.includes(num)) {
                            highScoreAppearances++;
                        }
                    }
                }
            });

            accuracy[num] = {
                avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
                appearances: appearances,
                appearanceRate: this.calibrationData.length > 0 ? appearances / this.calibrationData.length : 0,
                highScoreAccuracy: highScoreTotal > 0 ? highScoreAppearances / highScoreTotal : 0
            };
        }

        return accuracy;
    }

    /**
     * 시간별 성과 추이
     */
    getPerformanceTrend(windowSize = 10) {
        if (this.results.length < windowSize) return [];

        const trend = [];

        for (let i = windowSize - 1; i < this.results.length; i++) {
            const window = this.results.slice(i - windowSize + 1, i + 1);
            const avgHits = window.reduce((sum, r) => sum + r.hits, 0) / windowSize;
            const avgScore = window.reduce((sum, r) => sum + r.avgActualScore, 0) / windowSize;
            const hit3Plus = window.filter(r => r.hits >= 3).length / windowSize;

            trend.push({
                round: this.results[i].round,
                avgHits: avgHits,
                avgActualScore: avgScore,
                hit3PlusRate: hit3Plus
            });
        }

        return trend;
    }

    /**
     * 결과 CSV 내보내기
     */
    exportToCSV() {
        if (this.results.length === 0) return '';

        const headers = [
            'Round', 'Predicted', 'Actual', 'Hits', 'BonusHit',
            'AvgActualScore', 'AvgRank', 'ActualRanks'
        ];

        let csv = headers.join(',') + '\n';

        this.results.forEach(r => {
            const row = [
                r.round,
                r.predicted.join('|'),
                r.actual.join('|'),
                r.hits,
                r.bonusHit ? 1 : 0,
                r.avgActualScore.toFixed(2),
                r.avgRank.toFixed(2),
                r.actualRanks.join('|')
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    /**
     * ProbabilityScorer 설정
     */
    setScorer(scorer) {
        this.scorer = scorer;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedBacktester;
}
