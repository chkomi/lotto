/**
 * 로또 번호 분석 모듈
 * 엔트로피 가중치법을 활용하여 각 번호의 출현 가능성을 분석
 */

class LottoAnalyzer {
    constructor() {
        this.data = [];           // 전체 로또 데이터
        this.numbers = [];        // 1-45 번호 배열
        this.features = [         // 분석 특성 목록
            'recentFrequency',    // 최근 출현 빈도
            'absencePeriod',      // 미출현 기간
            'intervalPattern',    // 출현 간격 패턴
            'oddEvenBalance',     // 홀짝 균형도
            'sectionDistribution',// 구간 분포
            'consecutivePattern', // 연속 번호 패턴
            'bonusHistory',       // 보너스 출현 이력
            'meanReversion'       // 평균 회귀
        ];

        // 분석 파라미터
        this.params = {
            recentWindow: 50,      // 최근 분석 회차
            longTermWindow: 200,   // 장기 분석 회차
            intervalWindow: 20     // 간격 분석 회차
        };
    }

    /**
     * CSV 데이터 로드
     * @param {string} csvText - CSV 파일 내용
     */
    loadData(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');

        this.data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {
                round: parseInt(values[0]),
                date: values[1],
                numbers: [
                    parseInt(values[2]),
                    parseInt(values[3]),
                    parseInt(values[4]),
                    parseInt(values[5]),
                    parseInt(values[6]),
                    parseInt(values[7])
                ],
                bonus: parseInt(values[8])
            };
            this.data.push(row);
        }

        console.log(`Loaded ${this.data.length} rounds of lotto data`);
    }

    /**
     * 특정 회차까지의 데이터로 분석 (백테스팅용)
     * @param {number} upToRound - 분석할 마지막 회차
     * @returns {Array<Object>} 번호별 분석 결과
     */
    analyze(upToRound = null) {
        const endRound = upToRound || this.data[this.data.length - 1].round;
        const analysisData = this.data.filter(d => d.round <= endRound);

        if (analysisData.length === 0) {
            console.error('No data available for analysis');
            return [];
        }

        // 각 번호(1-45)에 대해 특성 계산
        const numberFeatures = [];
        for (let num = 1; num <= 45; num++) {
            const features = this.calculateFeatures(num, analysisData);
            numberFeatures.push({
                number: num,
                features: features
            });
        }

        // 특성 행렬 구성 (45개 번호 × 8개 특성)
        const featureMatrix = numberFeatures.map(nf =>
            this.features.map(fname => nf.features[fname])
        );

        // 엔트로피 가중치 계산
        const entropyResult = EntropyWeightMethod.calculate(featureMatrix, this.features);

        // 각 번호의 가중 점수 계산
        const results = [];
        for (let i = 0; i < 45; i++) {
            const score = EntropyWeightMethod.calculateWeightedScore(
                featureMatrix[i],
                entropyResult.weights
            );

            results.push({
                number: i + 1,
                score: score,
                features: numberFeatures[i].features,
                rank: 0  // 나중에 계산
            });
        }

        // 점수 기준으로 순위 매기기
        results.sort((a, b) => b.score - a.score);
        results.forEach((r, idx) => r.rank = idx + 1);

        return {
            predictions: results,
            weights: entropyResult.weights,
            weightMap: entropyResult.weightMap,
            entropy: entropyResult.entropy,
            featureNames: this.features,
            analyzedRound: endRound,
            dataCount: analysisData.length
        };
    }

    /**
     * 특정 번호의 모든 특성 계산
     * @param {number} number - 분석할 번호 (1-45)
     * @param {Array} data - 분석 데이터
     * @returns {Object} 특성 값들
     */
    calculateFeatures(number, data) {
        return {
            recentFrequency: this.calcRecentFrequency(number, data),
            absencePeriod: this.calcAbsencePeriod(number, data),
            intervalPattern: this.calcIntervalPattern(number, data),
            oddEvenBalance: this.calcOddEvenBalance(number, data),
            sectionDistribution: this.calcSectionDistribution(number, data),
            consecutivePattern: this.calcConsecutivePattern(number, data),
            bonusHistory: this.calcBonusHistory(number, data),
            meanReversion: this.calcMeanReversion(number, data)
        };
    }

    /**
     * 1. 최근 출현 빈도
     */
    calcRecentFrequency(number, data) {
        const recentData = data.slice(-this.params.recentWindow);
        let count = 0;
        recentData.forEach(row => {
            if (row.numbers.includes(number)) count++;
        });
        return count / recentData.length;
    }

    /**
     * 2. 미출현 기간 (역수로 변환하여 높을수록 좋게)
     */
    calcAbsencePeriod(number, data) {
        let lastAppearance = -1;
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].numbers.includes(number) || data[i].bonus === number) {
                lastAppearance = i;
                break;
            }
        }

        if (lastAppearance === -1) {
            // 한 번도 나온 적 없으면 최대 기간
            return 0;
        }

        const period = data.length - 1 - lastAppearance;
        // 적절한 미출현 기간에 높은 점수 (너무 짧거나 길면 낮음)
        // 최적 기간을 10회차 정도로 가정
        const optimal = 10;
        return 1 / (1 + Math.abs(period - optimal));
    }

    /**
     * 3. 출현 간격 패턴 (규칙성 - 낮을수록 규칙적)
     */
    calcIntervalPattern(number, data) {
        const appearances = [];
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) return 0;

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 간격의 표준편차 (낮을수록 규칙적)
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const std = Math.sqrt(variance);

        // 역수로 변환 (규칙적일수록 높은 점수)
        return 1 / (1 + std);
    }

    /**
     * 4. 홀짝 균형도
     */
    calcOddEvenBalance(number, data) {
        const recentData = data.slice(-this.params.recentWindow);
        let oddCount = 0;
        let evenCount = 0;

        recentData.forEach(row => {
            row.numbers.forEach(n => {
                if (n % 2 === 0) evenCount++;
                else oddCount++;
            });
        });

        const total = oddCount + evenCount;
        const oddRatio = oddCount / total;
        const evenRatio = evenCount / total;

        // 현재 번호가 부족한 쪽이면 높은 점수
        if (number % 2 === 0) {
            // 짝수 - 짝수가 부족하면 높은 점수
            return 1 - evenRatio;
        } else {
            // 홀수 - 홀수가 부족하면 높은 점수
            return 1 - oddRatio;
        }
    }

    /**
     * 5. 구간 분포 (1-9, 10-18, 19-27, 28-36, 37-45)
     */
    calcSectionDistribution(number, data) {
        const recentData = data.slice(-this.params.recentWindow);
        const sections = [0, 0, 0, 0, 0];

        recentData.forEach(row => {
            row.numbers.forEach(n => {
                const sectionIdx = Math.floor((n - 1) / 9);
                sections[sectionIdx]++;
            });
        });

        const currentSection = Math.floor((number - 1) / 9);
        const total = sections.reduce((a, b) => a + b, 0);
        const currentRatio = sections[currentSection] / total;

        // 현재 구간이 부족하면 높은 점수
        return 1 - currentRatio;
    }

    /**
     * 6. 연속 번호 패턴
     */
    calcConsecutivePattern(number, data) {
        const recentData = data.slice(-this.params.recentWindow);
        let consecutiveCount = 0;

        recentData.forEach(row => {
            const nums = row.numbers.sort((a, b) => a - b);
            // 현재 번호의 앞뒤 번호가 함께 나왔는지 확인
            if (nums.includes(number - 1) || nums.includes(number + 1)) {
                consecutiveCount++;
            }
        });

        return consecutiveCount / recentData.length;
    }

    /**
     * 7. 보너스 번호 출현 이력
     */
    calcBonusHistory(number, data) {
        const recentData = data.slice(-this.params.longTermWindow);
        let bonusCount = 0;
        let normalCount = 0;

        recentData.forEach(row => {
            if (row.bonus === number) bonusCount++;
            if (row.numbers.includes(number)) normalCount++;
        });

        // 보너스로 나온 비율 (일반 당첨보다 낮아야 정상)
        const total = bonusCount + normalCount;
        if (total === 0) return 0.5;

        // 보너스 비율이 낮으면 다음에 일반 당첨 가능성 높음
        return 1 - (bonusCount / total);
    }

    /**
     * 8. 평균 회귀 (전체 평균 대비 최근 출현률)
     */
    calcMeanReversion(number, data) {
        // 전체 기간 출현률
        let totalCount = 0;
        data.forEach(row => {
            if (row.numbers.includes(number)) totalCount++;
        });
        const overallRate = totalCount / data.length;

        // 최근 출현률
        const recentData = data.slice(-this.params.recentWindow);
        let recentCount = 0;
        recentData.forEach(row => {
            if (row.numbers.includes(number)) recentCount++;
        });
        const recentRate = recentCount / recentData.length;

        // 최근 출현률이 평균보다 낮으면 높은 점수 (평균 회귀 기대)
        if (recentRate < overallRate) {
            return overallRate - recentRate;
        } else {
            return 0;
        }
    }

    /**
     * 통계 정보 반환
     */
    getStatistics() {
        const stats = {
            totalRounds: this.data.length,
            numberFrequency: {},
            bonusFrequency: {},
            oddEvenRatio: { odd: 0, even: 0 },
            sectionDistribution: [0, 0, 0, 0, 0]
        };

        // 번호별 빈도
        for (let num = 1; num <= 45; num++) {
            stats.numberFrequency[num] = 0;
            stats.bonusFrequency[num] = 0;
        }

        this.data.forEach(row => {
            row.numbers.forEach(n => {
                stats.numberFrequency[n]++;
                if (n % 2 === 0) stats.oddEvenRatio.even++;
                else stats.oddEvenRatio.odd++;

                const sectionIdx = Math.floor((n - 1) / 9);
                stats.sectionDistribution[sectionIdx]++;
            });

            if (row.bonus) {
                stats.bonusFrequency[row.bonus]++;
            }
        });

        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LottoAnalyzer;
}
