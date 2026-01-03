/**
 * 번호별 출현 확률 점수 계산 모듈
 * 각 번호(1-45)에 출현 가능성 점수를 부여하고 캘리브레이션 분석을 수행
 */

class ProbabilityScorer {
    constructor() {
        // 기본 가중치 (나중에 최적화 가능)
        this.weights = {
            recentFrequency: 0.20,    // 최근 출현 빈도
            absencePenalty: 0.15,     // 미출현 보정
            cyclicalPattern: 0.10,    // 주기 패턴
            hotColdIndex: 0.20,       // 핫/콜드 지수
            meanReversion: 0.15,      // 평균 회귀
            sectionBalance: 0.10,     // 구간 균형
            bonusHistory: 0.10        // 보너스 출현 이력
        };

        // 분석 윈도우 크기
        this.recentWindow = 20;   // 최근 분석 윈도우
        this.hotWindow = 10;      // 핫 번호 윈도우
        this.coldWindow = 50;     // 콜드 번호 윈도우
    }

    /**
     * 모든 번호(1-45)의 확률 점수 계산
     * @param {Array} data - 회차 데이터 배열
     * @param {number} upToRound - 분석 기준 회차 (이 회차까지의 데이터로 분석)
     * @returns {Array} 번호별 확률 점수 배열
     */
    calculateAllScores(data, upToRound = null) {
        const analysisData = upToRound
            ? data.filter(d => d.round <= upToRound)
            : data;

        if (analysisData.length < 10) {
            throw new Error('분석에 필요한 최소 데이터가 부족합니다.');
        }

        const scores = [];

        for (let num = 1; num <= 45; num++) {
            const features = this.calculateFeatures(num, analysisData);
            const score = this.combineFeatures(features);

            scores.push({
                number: num,
                probability: score,
                features: features,
                percentile: 0  // 나중에 계산
            });
        }

        // 백분위 계산
        const sortedScores = [...scores].sort((a, b) => a.probability - b.probability);
        scores.forEach(s => {
            const rank = sortedScores.findIndex(ss => ss.number === s.number);
            s.percentile = ((rank + 1) / 45) * 100;
        });

        // 점수 순으로 정렬
        return scores.sort((a, b) => b.probability - a.probability);
    }

    /**
     * 번호별 특성 계산
     */
    calculateFeatures(number, data) {
        const recentData = data.slice(-this.recentWindow);
        const hotData = data.slice(-this.hotWindow);
        const coldData = data.slice(-this.coldWindow);

        return {
            recentFrequency: this.calcRecentFrequency(number, recentData),
            absencePenalty: this.calcAbsencePenalty(number, data),
            cyclicalPattern: this.calcCyclicalPattern(number, data),
            hotColdIndex: this.calcHotColdIndex(number, hotData, coldData),
            meanReversion: this.calcMeanReversion(number, data),
            sectionBalance: this.calcSectionBalance(number, recentData),
            bonusHistory: this.calcBonusHistory(number, data)
        };
    }

    /**
     * 특성 결합하여 최종 점수 산출
     */
    combineFeatures(features) {
        let score = 0;
        for (const [key, weight] of Object.entries(this.weights)) {
            if (features[key] !== undefined) {
                score += features[key] * weight;
            }
        }

        // 0-100 범위로 정규화
        return Math.min(100, Math.max(0, score * 100));
    }

    /**
     * 최근 출현 빈도 (0-1 범위)
     */
    calcRecentFrequency(number, data) {
        const count = data.filter(d => d.numbers.includes(number)).length;
        // 기대 출현율: 6/45 = 약 13.3%
        const expectedRate = 6 / 45;
        const actualRate = count / data.length;

        // 정규화 (기대값 대비 비율)
        return Math.min(1, actualRate / (expectedRate * 2));
    }

    /**
     * 미출현 기간 보정 (오래 안 나온 번호 가중치 상향)
     */
    calcAbsencePenalty(number, data) {
        let lastAppearance = -1;

        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].numbers.includes(number)) {
                lastAppearance = i;
                break;
            }
        }

        if (lastAppearance === -1) {
            return 1.0;  // 한 번도 안 나온 경우 최대 점수
        }

        const absence = data.length - 1 - lastAppearance;

        // 평균 출현 간격: 45/6 = 7.5회
        const expectedInterval = 7.5;

        // 미출현 기간이 길수록 점수 증가 (시그모이드 함수 적용)
        const normalizedAbsence = absence / expectedInterval;
        return 1 / (1 + Math.exp(-0.5 * (normalizedAbsence - 1)));
    }

    /**
     * 주기 패턴 분석
     */
    calcCyclicalPattern(number, data) {
        const appearances = [];

        data.forEach((d, idx) => {
            if (d.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 3) return 0.5;

        // 출현 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 평균 간격
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // 다음 예상 출현 시점
        const lastAppearance = appearances[appearances.length - 1];
        const roundsSinceLast = data.length - 1 - lastAppearance;

        // 예상 시점에 가까울수록 점수 높음
        const proximityScore = 1 - Math.abs(roundsSinceLast - avgInterval) / avgInterval;

        return Math.max(0, Math.min(1, proximityScore));
    }

    /**
     * 핫/콜드 지수 (최근 트렌드)
     */
    calcHotColdIndex(number, hotData, coldData) {
        const hotCount = hotData.filter(d => d.numbers.includes(number)).length;
        const coldCount = coldData.filter(d => d.numbers.includes(number)).length;

        const hotRate = hotCount / hotData.length;
        const coldRate = coldCount / coldData.length;
        const expectedRate = 6 / 45;

        // 핫 지수: 최근 출현율이 높으면 계속 높을 가능성
        // 콜드 보정: 장기적으로 낮으면 반등 가능성

        const hotScore = hotRate / expectedRate;
        const coldReversion = coldRate < expectedRate * 0.7 ? 1.3 : 1.0;

        return Math.min(1, (hotScore * 0.6 + coldReversion * 0.4) / 2);
    }

    /**
     * 평균 회귀 점수
     */
    calcMeanReversion(number, data) {
        const expectedRate = 6 / 45;
        const totalAppearances = data.filter(d => d.numbers.includes(number)).length;
        const actualRate = totalAppearances / data.length;

        // 기대값 대비 편차
        const deviation = actualRate - expectedRate;

        // 평균보다 적게 나왔으면 앞으로 더 나올 가능성
        if (deviation < -0.02) {
            return 0.6 + Math.abs(deviation) * 3;
        }
        // 평균보다 많이 나왔으면 덜 나올 가능성
        else if (deviation > 0.02) {
            return 0.4 - deviation * 2;
        }

        return 0.5;
    }

    /**
     * 구간 균형 점수
     */
    calcSectionBalance(number, data) {
        // 번호 구간: 1-9, 10-18, 19-27, 28-36, 37-45
        const getSection = n => Math.floor((n - 1) / 9);
        const section = getSection(number);

        // 최근 데이터에서 각 구간 출현 빈도
        const sectionCounts = [0, 0, 0, 0, 0];

        data.forEach(d => {
            d.numbers.forEach(n => {
                sectionCounts[getSection(n)]++;
            });
        });

        const totalNumbers = data.length * 6;
        const expectedPerSection = totalNumbers / 5;

        // 해당 구간이 덜 나왔으면 점수 증가
        const sectionDeviation = (expectedPerSection - sectionCounts[section]) / expectedPerSection;

        return Math.min(1, Math.max(0, 0.5 + sectionDeviation * 0.5));
    }

    /**
     * 보너스 번호 출현 이력
     */
    calcBonusHistory(number, data) {
        const recentData = data.slice(-30);

        // 최근 보너스로 나온 횟수
        const bonusCount = recentData.filter(d => d.bonus === number).length;

        // 보너스로 나온 번호는 정규 번호로도 나올 가능성 약간 증가
        return Math.min(1, 0.4 + bonusCount * 0.1);
    }

    /**
     * 점수 구간별 통계 반환
     */
    getScoreBands(scores) {
        const bands = [
            { range: '90-100', min: 90, max: 100, numbers: [], count: 0 },
            { range: '80-90', min: 80, max: 90, numbers: [], count: 0 },
            { range: '70-80', min: 70, max: 80, numbers: [], count: 0 },
            { range: '60-70', min: 60, max: 70, numbers: [], count: 0 },
            { range: '50-60', min: 50, max: 60, numbers: [], count: 0 },
            { range: '40-50', min: 40, max: 50, numbers: [], count: 0 },
            { range: '30-40', min: 30, max: 40, numbers: [], count: 0 },
            { range: '0-30', min: 0, max: 30, numbers: [], count: 0 }
        ];

        scores.forEach(s => {
            const band = bands.find(b => s.probability >= b.min && s.probability < b.max);
            if (band) {
                band.numbers.push(s.number);
                band.count++;
            }
        });

        return bands;
    }

    /**
     * 점수 캘리브레이션 분석
     * @param {Array} predictions - 예측 결과 배열 [{round, scores, actual}]
     * @returns {Object} 캘리브레이션 분석 결과
     */
    analyzeCalibration(predictions) {
        const numBins = 10;
        const bins = Array.from({ length: numBins }, (_, i) => ({
            range: `${i * 10}-${(i + 1) * 10}`,
            min: i * 10,
            max: (i + 1) * 10,
            totalPredictions: 0,
            actualHits: 0,
            avgConfidence: 0,
            accuracy: 0
        }));

        predictions.forEach(pred => {
            pred.scores.forEach(s => {
                const binIdx = Math.min(numBins - 1, Math.floor(s.probability / 10));
                bins[binIdx].totalPredictions++;
                bins[binIdx].avgConfidence += s.probability;

                if (pred.actual.includes(s.number)) {
                    bins[binIdx].actualHits++;
                }
            });
        });

        // 평균 및 정확도 계산
        bins.forEach(bin => {
            if (bin.totalPredictions > 0) {
                bin.avgConfidence /= bin.totalPredictions;
                bin.accuracy = (bin.actualHits / bin.totalPredictions) * 100;
            }
        });

        // ECE (Expected Calibration Error) 계산
        const totalPredictions = bins.reduce((sum, b) => sum + b.totalPredictions, 0);
        let ece = 0;

        bins.forEach(bin => {
            if (bin.totalPredictions > 0) {
                const weight = bin.totalPredictions / totalPredictions;
                ece += weight * Math.abs(bin.avgConfidence - bin.accuracy);
            }
        });

        // Brier Score 계산
        let brierScore = 0;
        let brierCount = 0;

        predictions.forEach(pred => {
            pred.scores.forEach(s => {
                const actual = pred.actual.includes(s.number) ? 1 : 0;
                brierScore += Math.pow(s.probability / 100 - actual, 2);
                brierCount++;
            });
        });

        brierScore = brierCount > 0 ? brierScore / brierCount : 0;

        return {
            bins: bins,
            ece: ece,
            brierScore: brierScore,
            totalPredictions: totalPredictions
        };
    }

    /**
     * 상위 N개 번호 선택
     */
    getTopN(scores, n = 6) {
        return scores.slice(0, n).map(s => s.number);
    }

    /**
     * 가중치 설정
     */
    setWeights(newWeights) {
        this.weights = { ...this.weights, ...newWeights };
    }

    /**
     * 윈도우 크기 설정
     */
    setWindows(recent = 20, hot = 10, cold = 50) {
        this.recentWindow = recent;
        this.hotWindow = hot;
        this.coldWindow = cold;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProbabilityScorer;
}
