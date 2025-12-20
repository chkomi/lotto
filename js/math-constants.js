/**
 * 수학적 상수 기반 분석 모듈 (Mathematical Constants Analysis)
 * e, π, φ(황금비), 피보나치 등 수학적 상수를 활용한 분석
 * 
 * v2: 동적 특성 강화, 정적 특성 약화
 */

class MathConstantsAnalysis {
    // 수학적 상수들
    static E = Math.E;                          // 자연상수 e ≈ 2.71828
    static PI = Math.PI;                        // 원주율 π ≈ 3.14159
    static PHI = (1 + Math.sqrt(5)) / 2;        // 황금비 φ ≈ 1.61803
    static SQRT2 = Math.sqrt(2);                // √2 ≈ 1.41421
    static SQRT3 = Math.sqrt(3);                // √3 ≈ 1.73205
    static EULER_MASCHERONI = 0.5772156649;     // 오일러-마스케로니 상수 γ
    static LN2 = Math.LN2;                      // ln(2) ≈ 0.693
    
    // 피보나치 수열 (1-45 범위 내)
    static FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34];
    
    // 소수 목록 (1-45 범위 내)
    static PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];

    /**
     * 종합 수학적 상수 분석
     * v2: 동적 특성 가중치 대폭 상향
     */
    static analyze(data, recentWindow = 50) {
        const recentData = data.slice(-recentWindow);
        const scores = {};

        // 전체 데이터 통계 미리 계산 (효율성)
        const globalStats = this.calculateGlobalStats(recentData);

        for (let num = 1; num <= 45; num++) {
            const features = {
                // 동적 특성 (데이터 기반) - 70%
                exponentialDecay: this.calcExponentialDecayScore(num, recentData),
                piCyclePhase: this.calcPiCyclePhaseScore(num, recentData),
                goldenInterval: this.calcGoldenIntervalScore(num, recentData),
                harmonicPrediction: this.calcHarmonicPredictionScore(num, recentData),
                eBasedMomentum: this.calcEBasedMomentumScore(num, recentData),
                logarithmicTrend: this.calcLogarithmicTrendScore(num, recentData),
                sqrtVariance: this.calcSqrtVarianceScore(num, recentData),
                
                // 혼합 특성 (데이터 + 상수) - 30%
                fibonacciCorrelation: this.calcFibonacciCorrelationScore(num, recentData, globalStats),
                primeBalance: this.calcPrimeBalanceScore(num, recentData, globalStats),
                benfordDeviation: this.calcBenfordDeviationScore(num, recentData, globalStats)
            };

            // v2: 동적 특성에 더 높은 가중치
            const weights = {
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

            let totalScore = 0;
            Object.keys(features).forEach(key => {
                totalScore += features[key] * weights[key];
            });

            scores[num] = {
                number: num,
                totalScore: totalScore,
                features: features
            };
        }

        return scores;
    }

    /**
     * 전역 통계 계산
     */
    static calculateGlobalStats(data) {
        const stats = {
            numberCounts: {},
            totalNumbers: 0,
            primeCount: 0,
            fibCount: 0,
            firstDigitCounts: {1:0, 2:0, 3:0, 4:0}
        };

        for (let n = 1; n <= 45; n++) {
            stats.numberCounts[n] = 0;
        }

        data.forEach(row => {
            row.numbers.forEach(n => {
                stats.numberCounts[n]++;
                stats.totalNumbers++;
                if (this.PRIMES.includes(n)) stats.primeCount++;
                if (this.FIBONACCI.includes(n)) stats.fibCount++;
                const firstDigit = parseInt(n.toString()[0]);
                if (firstDigit <= 4) stats.firstDigitCounts[firstDigit]++;
            });
        });

        return stats;
    }

    /**
     * 1. e 기반 지수 감쇠 (Exponential Decay)
     * 시간에 따른 출현 가중치를 e^(-λt)로 계산
     * 더 정교한 감쇠 모델 적용
     */
    static calcExponentialDecayScore(number, data) {
        if (data.length === 0) return 0.5;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        // 다중 감쇠 상수: 단기/중기/장기 트렌드 조합
        const lambdas = [
            { lambda: 1 / this.E, weight: 0.5 },      // 단기 (빠른 감쇠)
            { lambda: 1 / (this.E * 2), weight: 0.3 }, // 중기
            { lambda: 1 / (this.E * 4), weight: 0.2 }  // 장기 (느린 감쇠)
        ];
        
        lambdas.forEach(({ lambda, weight: lambdaWeight }) => {
            let subWeightedSum = 0;
            let subTotalWeight = 0;
            
            data.forEach((row, idx) => {
                const t = (data.length - 1 - idx) / data.length;
                const decayWeight = Math.exp(-lambda * t * this.E);
                
                if (row.numbers.includes(number)) {
                    subWeightedSum += decayWeight;
                }
                subTotalWeight += decayWeight;
            });
            
            if (subTotalWeight > 0) {
                weightedSum += (subWeightedSum / subTotalWeight) * lambdaWeight;
                totalWeight += lambdaWeight;
            }
        });

        const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
        
        // 미출현 보정: e^(-absence/e) 사용하여 오래 안나온 번호 보정
        let lastAppearance = -1;
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].numbers.includes(number)) {
                lastAppearance = i;
                break;
            }
        }
        
        if (lastAppearance >= 0) {
            const absence = data.length - 1 - lastAppearance;
            const absenceRatio = absence / data.length;
            // 적정 미출현 기간에서 최대값 (너무 짧거나 길면 감소)
            const optimalAbsence = 1 / this.PHI; // 약 0.618 비율
            const absenceScore = Math.exp(-Math.pow(absenceRatio - optimalAbsence, 2) * this.E * 2);
            return baseScore * 0.6 + absenceScore * 0.4;
        }

        return baseScore;
    }

    /**
     * 2. π 주기 위상 분석 (Pi Cycle Phase)
     * 사인/코사인 함수로 출현 주기의 현재 위상 분석
     */
    static calcPiCyclePhaseScore(number, data) {
        const appearances = [];
        
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 3) {
            // 출현 횟수가 적으면 미출현 기간 기반으로 보정
            const lastApp = appearances.length > 0 ? appearances[appearances.length - 1] : -1;
            const absence = data.length - 1 - (lastApp >= 0 ? lastApp : 0);
            return 0.3 + (absence / data.length) * 0.4;
        }

        // 출현 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 가중 평균 간격 (최근 간격에 더 높은 가중치)
        let weightedAvgInterval = 0;
        let totalWeight = 0;
        intervals.forEach((interval, idx) => {
            const weight = Math.pow(this.PHI, idx - intervals.length + 1);
            weightedAvgInterval += interval * weight;
            totalWeight += weight;
        });
        const avgInterval = totalWeight > 0 ? weightedAvgInterval / totalWeight : intervals[intervals.length - 1];
        
        // 현재 위상 계산
        const lastAppearance = appearances[appearances.length - 1];
        const timeSinceLast = data.length - lastAppearance;
        
        // π 기반 주기 함수: sin과 cos 조합
        const phase = (2 * this.PI * timeSinceLast) / avgInterval;
        
        // 사인파: 주기의 피크(0.75 주기)에서 최대
        const sinScore = (Math.sin(phase - this.PI / 2) + 1) / 2;
        
        // 코사인 기반 안정성: 예상 출현 시점 근처에서 높음
        const cosScore = (Math.cos(phase - this.PI) + 1) / 2;
        
        // 간격 변동성 보정
        const intervalStd = Math.sqrt(
            intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
        );
        const stability = 1 / (1 + intervalStd / avgInterval);
        
        return sinScore * 0.4 + cosScore * 0.4 + stability * 0.2;
    }

    /**
     * 3. 황금 간격 분석 (Golden Interval)
     * 출현 간격이 황금비 패턴을 따르는지 분석
     */
    static calcGoldenIntervalScore(number, data) {
        const appearances = [];
        
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) {
            const absence = data.length - 1 - (appearances[0] || 0);
            return 0.4 + (absence / data.length) * 0.3;
        }

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 연속 간격의 비율이 황금비에 가까운지 확인
        let goldenScore = 0;
        for (let i = 1; i < intervals.length; i++) {
            const ratio = Math.max(intervals[i], intervals[i-1]) / 
                         Math.min(intervals[i], intervals[i-1]);
            const goldenDiff = Math.abs(ratio - this.PHI);
            goldenScore += Math.exp(-goldenDiff);
        }
        goldenScore = intervals.length > 1 ? goldenScore / (intervals.length - 1) : 0.5;

        // 다음 예상 간격 계산 (황금비 기반)
        const lastInterval = intervals[intervals.length - 1];
        const predictedNextLong = lastInterval * this.PHI;
        const predictedNextShort = lastInterval / this.PHI;
        
        const timeSinceLast = data.length - appearances[appearances.length - 1];
        
        // 예상 간격과의 차이
        const diffLong = Math.abs(timeSinceLast - predictedNextLong);
        const diffShort = Math.abs(timeSinceLast - predictedNextShort);
        const minDiff = Math.min(diffLong, diffShort);
        
        const predictionScore = Math.exp(-minDiff / (lastInterval * 0.5));
        
        return goldenScore * 0.5 + predictionScore * 0.5;
    }

    /**
     * 4. 조화 평균 예측 (Harmonic Prediction)
     * 조화/기하/산술 평균의 조합으로 예측
     */
    static calcHarmonicPredictionScore(number, data) {
        const appearances = [];
        
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 3) {
            return 0.5;
        }

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            const interval = appearances[i] - appearances[i - 1];
            if (interval > 0) intervals.push(interval);
        }

        if (intervals.length === 0) return 0.5;

        // 세 가지 평균 계산
        const n = intervals.length;
        
        // 산술 평균
        const arithmeticMean = intervals.reduce((a, b) => a + b, 0) / n;
        
        // 기하 평균
        const geometricMean = Math.pow(
            intervals.reduce((prod, i) => prod * i, 1),
            1 / n
        );
        
        // 조화 평균
        const harmonicMean = n / intervals.reduce((sum, i) => sum + 1 / i, 0);

        // 현재 미출현 기간
        const timeSinceLast = data.length - appearances[appearances.length - 1];
        
        // 각 평균 기준 점수 (정규분포 형태)
        const scoreFromMean = (mean) => {
            const diff = timeSinceLast - mean;
            const sigma = mean * 0.3; // 표준편차를 평균의 30%로 설정
            return Math.exp(-Math.pow(diff, 2) / (2 * Math.pow(sigma, 2)));
        };

        const arithmeticScore = scoreFromMean(arithmeticMean);
        const geometricScore = scoreFromMean(geometricMean);
        const harmonicScore = scoreFromMean(harmonicMean);

        // 조화 평균에 더 높은 가중치 (극단값에 덜 민감)
        return harmonicScore * 0.5 + geometricScore * 0.3 + arithmeticScore * 0.2;
    }

    /**
     * 5. e 기반 모멘텀 (E-Based Momentum)
     * 최근 출현 추세의 가속도/감속도 분석
     */
    static calcEBasedMomentumScore(number, data) {
        if (data.length < 20) return 0.5;
        
        // 세 구간으로 나누어 출현률 계산
        const third = Math.floor(data.length / 3);
        
        const period1 = data.slice(0, third);
        const period2 = data.slice(third, third * 2);
        const period3 = data.slice(third * 2);
        
        const countInPeriod = (period) => {
            return period.filter(row => row.numbers.includes(number)).length / period.length;
        };
        
        const rate1 = countInPeriod(period1);
        const rate2 = countInPeriod(period2);
        const rate3 = countInPeriod(period3);
        
        // 변화율 계산 (e 기반 스케일링)
        const velocity1 = (rate2 - rate1) * this.E;
        const velocity2 = (rate3 - rate2) * this.E;
        
        // 가속도
        const acceleration = velocity2 - velocity1;
        
        // 모멘텀 점수: 상승 추세면 높은 점수
        // 하지만 너무 급격한 상승은 회귀 예상으로 감점
        let momentumScore;
        
        if (rate3 < 0.1) {
            // 최근 거의 안나왔음 -> 출현 가능성 증가
            momentumScore = 0.6 + (1 - rate3) * 0.3;
        } else if (rate3 > 0.25) {
            // 최근 많이 나왔음 -> 출현 가능성 감소
            momentumScore = 0.4 - (rate3 - 0.25) * 0.5;
        } else {
            // 적정 범위
            momentumScore = 0.5 + acceleration * 2;
        }
        
        return Math.max(0, Math.min(1, momentumScore));
    }

    /**
     * 6. 로그 트렌드 분석 (Logarithmic Trend)
     * 자연로그 기반 장기 트렌드 분석
     */
    static calcLogarithmicTrendScore(number, data) {
        if (data.length < 10) return 0.5;
        
        const appearances = [];
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) {
            // 출현이 적으면 출현 가능성 높음
            return 0.6 + (data.length - appearances.length) / data.length * 0.3;
        }

        // 로그 시간 스케일에서의 출현 밀도
        const logScaleAppearances = appearances.map(idx => 
            Math.log(idx + 1) / Math.log(data.length + 1)
        );
        
        // 최근 로그 구간에서의 출현 밀도
        const recentThreshold = Math.log(data.length * 0.7 + 1) / Math.log(data.length + 1);
        const recentLogAppearances = logScaleAppearances.filter(la => la > recentThreshold);
        const expectedRecentDensity = (1 - recentThreshold);
        const actualRecentDensity = recentLogAppearances.length / appearances.length;
        
        // 로그 스케일에서 균등 분포면 0.5, 최근에 적으면 높음
        const densityScore = 0.5 + (expectedRecentDensity - actualRecentDensity);
        
        return Math.max(0, Math.min(1, densityScore));
    }

    /**
     * 7. 제곱근 분산 분석 (Sqrt Variance)
     * √n 기반 출현 분산 분석
     */
    static calcSqrtVarianceScore(number, data) {
        const appearances = [];
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) return 0.5;

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 기대 간격 (균등 분포 가정)
        const expectedInterval = data.length / (appearances.length + 1);
        
        // 분산 계산
        const variance = intervals.reduce((sum, i) => 
            sum + Math.pow(i - expectedInterval, 2), 0
        ) / intervals.length;
        
        // 표준편차
        const std = Math.sqrt(variance);
        
        // √n 정규화: 표준편차가 √기대간격에 가까울수록 "정상"
        const expectedStd = Math.sqrt(expectedInterval);
        const normalizedStd = std / expectedStd;
        
        // 변동계수 (CV)
        const cv = std / (expectedInterval || 1);
        
        // CV가 낮으면 (규칙적이면) 다음 출현 예측 가능
        const regularityScore = Math.exp(-cv * this.SQRT2);
        
        // 현재 미출현 기간
        const timeSinceLast = data.length - appearances[appearances.length - 1];
        const zscore = (timeSinceLast - expectedInterval) / (std || 1);
        
        // z-score 기반 출현 확률 (표준정규분포 근사)
        const probScore = 1 / (1 + Math.exp(-zscore / this.SQRT2));
        
        return regularityScore * 0.4 + probScore * 0.6;
    }

    /**
     * 8. 피보나치 상관관계 (Fibonacci Correlation)
     * 피보나치 수와의 동적 상관관계 분석
     */
    static calcFibonacciCorrelationScore(number, data, globalStats) {
        // 기본 피보나치 점수 (낮은 가중치)
        let staticScore = 0;
        if (this.FIBONACCI.includes(number)) {
            staticScore = 0.15;
        }
        
        // 두 피보나치 수의 합인지 확인
        for (let i = 0; i < this.FIBONACCI.length; i++) {
            for (let j = i; j < this.FIBONACCI.length; j++) {
                if (this.FIBONACCI[i] + this.FIBONACCI[j] === number) {
                    staticScore += 0.05;
                    break;
                }
            }
        }

        // 동적 분석: 최근 피보나치 수들의 출현과의 상관관계
        let coAppearanceScore = 0;
        let appearances = 0;
        let fibAppearancesSameRound = 0;

        data.forEach(row => {
            const numAppeared = row.numbers.includes(number);
            const fibsInRow = row.numbers.filter(n => this.FIBONACCI.includes(n));
            
            if (numAppeared) {
                appearances++;
                if (fibsInRow.length > 0) {
                    fibAppearancesSameRound++;
                }
            }
        });

        if (appearances > 0) {
            coAppearanceScore = fibAppearancesSameRound / appearances;
        }

        // 전체 피보나치 출현률과 비교
        const globalFibRate = globalStats.fibCount / globalStats.totalNumbers;
        const fibDeficit = globalFibRate < (8/45 * 6 / 6) ? 0.2 : 0;
        
        // 피보나치 수인데 최근에 부족하면 보너스
        if (this.FIBONACCI.includes(number)) {
            const recentFibAppearances = data.slice(-20).filter(row => 
                row.numbers.includes(number)
            ).length;
            if (recentFibAppearances < 2) {
                staticScore += 0.15;
            }
        }

        return staticScore * 0.3 + coAppearanceScore * 0.4 + fibDeficit * 0.3;
    }

    /**
     * 9. 소수 균형 분석 (Prime Balance)
     * 소수 출현의 동적 균형 분석
     */
    static calcPrimeBalanceScore(number, data, globalStats) {
        const isPrime = this.PRIMES.includes(number);
        
        // 최근 소수 출현률 분석
        const recentData = data.slice(-Math.min(20, data.length));
        let recentPrimeCount = 0;
        let recentTotal = 0;
        
        recentData.forEach(row => {
            row.numbers.forEach(n => {
                recentTotal++;
                if (this.PRIMES.includes(n)) {
                    recentPrimeCount++;
                }
            });
        });
        
        const recentPrimeRate = recentTotal > 0 ? recentPrimeCount / recentTotal : 0;
        const expectedPrimeRate = this.PRIMES.length / 45; // 약 0.31
        
        let score = 0.5;
        
        if (isPrime) {
            // 소수인 경우
            if (recentPrimeRate < expectedPrimeRate * 0.8) {
                // 소수가 부족하면 높은 점수
                score = 0.6 + (expectedPrimeRate - recentPrimeRate) * 2;
            } else if (recentPrimeRate > expectedPrimeRate * 1.2) {
                // 소수가 과다하면 낮은 점수
                score = 0.4 - (recentPrimeRate - expectedPrimeRate);
            }
            
            // 개별 소수의 최근 출현 확인
            const recentAppearances = recentData.filter(row => 
                row.numbers.includes(number)
            ).length;
            if (recentAppearances < 2) {
                score += 0.15;
            }
        } else {
            // 소수가 아닌 경우
            if (recentPrimeRate > expectedPrimeRate * 1.2) {
                // 소수가 과다하면 비소수에 기회
                score = 0.55 + (recentPrimeRate - expectedPrimeRate);
            }
        }
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * 10. 벤포드 편차 분석 (Benford Deviation)
     * 벤포드 법칙으로부터의 편차 분석
     */
    static calcBenfordDeviationScore(number, data, globalStats) {
        // 벤포드 분포: log10(1 + 1/d)
        const benfordDist = {};
        for (let d = 1; d <= 4; d++) {  // 1-45 범위에서는 1-4만 첫자리 가능
            benfordDist[d] = Math.log10(1 + 1 / d);
        }
        // 정규화
        const benfordTotal = Object.values(benfordDist).reduce((a, b) => a + b, 0);
        for (let d = 1; d <= 4; d++) {
            benfordDist[d] /= benfordTotal;
        }

        // 실제 분포 계산
        const actualTotal = Object.values(globalStats.firstDigitCounts).reduce((a, b) => a + b, 0);
        const actualDist = {};
        for (let d = 1; d <= 4; d++) {
            actualDist[d] = actualTotal > 0 ? globalStats.firstDigitCounts[d] / actualTotal : 0.25;
        }

        // 현재 번호의 첫 자리 수
        const numberFirstDigit = parseInt(number.toString()[0]);
        
        if (numberFirstDigit > 4) return 0.5; // 안전 체크
        
        // 벤포드 기대치와 실제의 차이
        const expectedFreq = benfordDist[numberFirstDigit];
        const actualFreq = actualDist[numberFirstDigit];
        const deviation = expectedFreq - actualFreq;
        
        // 벤포드 기대치보다 적게 나왔으면 높은 점수
        let score = 0.5 + deviation * 3;
        
        // 최근 10회차에서의 해당 첫자리 출현률도 고려
        const recentData = data.slice(-10);
        let recentFirstDigitCount = 0;
        let recentTotal = 0;
        
        recentData.forEach(row => {
            row.numbers.forEach(n => {
                recentTotal++;
                if (parseInt(n.toString()[0]) === numberFirstDigit) {
                    recentFirstDigitCount++;
                }
            });
        });
        
        const recentRate = recentTotal > 0 ? recentFirstDigitCount / recentTotal : 0.25;
        if (recentRate < expectedFreq) {
            score += (expectedFreq - recentRate) * 2;
        }
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * 분석 방법 목록 반환
     */
    static getMethods() {
        return {
            exponentialDecay: {
                name: 'e 기반 지수 감쇠',
                description: '다중 시간 스케일의 지수 감쇠 분석',
                constant: 'e ≈ 2.71828',
                weight: '15%'
            },
            piCyclePhase: {
                name: 'π 주기 위상',
                description: '사인/코사인 함수 기반 주기 위상 분석',
                constant: 'π ≈ 3.14159',
                weight: '12%'
            },
            goldenInterval: {
                name: '황금 간격',
                description: '출현 간격의 황금비 패턴 분석',
                constant: 'φ ≈ 1.61803',
                weight: '10%'
            },
            harmonicPrediction: {
                name: '조화 평균 예측',
                description: '조화/기하/산술 평균 조합 예측',
                constant: 'H = n/Σ(1/xᵢ)',
                weight: '12%'
            },
            eBasedMomentum: {
                name: 'e 기반 모멘텀',
                description: '출현 추세의 가속도/감속도 분석',
                constant: 'e ≈ 2.71828',
                weight: '8%'
            },
            logarithmicTrend: {
                name: '로그 트렌드',
                description: '자연로그 기반 장기 트렌드',
                constant: 'ln(x)',
                weight: '8%'
            },
            sqrtVariance: {
                name: '√n 분산',
                description: '제곱근 기반 분산 분석',
                constant: '√n',
                weight: '5%'
            },
            fibonacciCorrelation: {
                name: '피보나치 상관',
                description: '피보나치 수와의 동적 상관관계',
                constant: 'Fₙ = Fₙ₋₁ + Fₙ₋₂',
                weight: '10%'
            },
            primeBalance: {
                name: '소수 균형',
                description: '소수 출현의 동적 균형',
                constant: 'Prime numbers',
                weight: '10%'
            },
            benfordDeviation: {
                name: '벤포드 편차',
                description: '벤포드 법칙 편차 분석',
                constant: 'P(d) = log₁₀(1+1/d)',
                weight: '10%'
            }
        };
    }

    /**
     * 결과를 표준 형식으로 변환
     */
    static formatResults(scores) {
        const predictions = [];
        
        Object.values(scores).forEach(item => {
            predictions.push({
                number: item.number,
                score: item.totalScore || item.score,
                rank: 0,
                features: item.features || {}
            });
        });

        predictions.sort((a, b) => b.score - a.score);
        predictions.forEach((p, idx) => p.rank = idx + 1);

        return {
            predictions: predictions,
            weights: [],
            weightMap: {},
            featureNames: Object.keys(this.getMethods()),
            method: 'Mathematical Constants v2'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathConstantsAnalysis;
}
