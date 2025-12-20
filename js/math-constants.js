/**
 * 수학적 상수 기반 분석 모듈 (Mathematical Constants Analysis)
 * e, π, φ(황금비), 피보나치 등 수학적 상수를 활용한 분석
 */

class MathConstantsAnalysis {
    // 수학적 상수들
    static E = Math.E;                          // 자연상수 e ≈ 2.71828
    static PI = Math.PI;                        // 원주율 π ≈ 3.14159
    static PHI = (1 + Math.sqrt(5)) / 2;        // 황금비 φ ≈ 1.61803
    static SQRT2 = Math.sqrt(2);                // √2 ≈ 1.41421
    static SQRT3 = Math.sqrt(3);                // √3 ≈ 1.73205
    static EULER_MASCHERONI = 0.5772156649;     // 오일러-마스케로니 상수 γ
    
    // 피보나치 수열 (1-45 범위 내)
    static FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34];
    
    // 소수 목록 (1-45 범위 내)
    static PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];

    /**
     * 종합 수학적 상수 분석
     * @param {Array} data - 로또 데이터
     * @param {number} recentWindow - 최근 분석 회차
     * @returns {Object} 각 번호별 점수
     */
    static analyze(data, recentWindow = 50) {
        const recentData = data.slice(-recentWindow);
        const scores = {};

        for (let num = 1; num <= 45; num++) {
            const features = {
                goldenRatio: this.calcGoldenRatioScore(num, recentData),
                exponentialDecay: this.calcExponentialDecayScore(num, recentData),
                piCycle: this.calcPiCycleScore(num, recentData),
                fibonacci: this.calcFibonacciScore(num, recentData),
                primeAffinity: this.calcPrimeAffinityScore(num, recentData),
                benford: this.calcBenfordScore(num, recentData),
                eulerWeight: this.calcEulerWeightScore(num, recentData),
                harmonicMean: this.calcHarmonicMeanScore(num, recentData)
            };

            // 각 특성의 가중 합산
            const weights = {
                goldenRatio: 0.15,
                exponentialDecay: 0.20,
                piCycle: 0.15,
                fibonacci: 0.10,
                primeAffinity: 0.10,
                benford: 0.10,
                eulerWeight: 0.10,
                harmonicMean: 0.10
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
     * 1. 황금비(φ) 기반 점수
     * 번호 간격이 황금비에 가까운 패턴 분석
     */
    static calcGoldenRatioScore(number, data) {
        let score = 0;
        const goldenNumbers = [];
        
        // 황금비 관련 번호 계산
        for (let n = 1; n <= 45; n++) {
            // n과 number의 비율이 황금비에 가까운지 확인
            const ratio1 = Math.max(n, number) / Math.min(n, number);
            const ratio2 = (n + number) / Math.max(n, number);
            
            const diff1 = Math.abs(ratio1 - this.PHI);
            const diff2 = Math.abs(ratio2 - this.PHI);
            
            if (diff1 < 0.1 || diff2 < 0.1) {
                goldenNumbers.push(n);
            }
        }

        // 최근 데이터에서 황금비 관련 번호들과 함께 출현한 횟수
        data.forEach(row => {
            if (row.numbers.includes(number)) {
                const coAppearances = row.numbers.filter(n => 
                    n !== number && goldenNumbers.includes(n)
                ).length;
                score += coAppearances * 0.1;
            }
        });

        // 번호 자체가 황금비와 관련 있는지
        const numRatio = number / this.PHI;
        const isGoldenRelated = Math.abs(numRatio - Math.round(numRatio)) < 0.2;
        if (isGoldenRelated) {
            score += 0.3;
        }

        // 피보나치 수인지 확인 (황금비와 밀접한 관련)
        if (this.FIBONACCI.includes(number)) {
            score += 0.4;
        }

        return Math.min(1, score);
    }

    /**
     * 2. 자연상수 e 기반 지수 감쇠 점수
     * 시간에 따른 출현 가중치를 e^(-λt)로 계산
     */
    static calcExponentialDecayScore(number, data) {
        let weightedSum = 0;
        let totalWeight = 0;
        
        // 감쇠 상수 λ (e 기반)
        const lambda = 1 / this.E;
        
        data.forEach((row, idx) => {
            const t = data.length - 1 - idx; // 현재로부터의 거리
            const weight = Math.exp(-lambda * t / data.length);
            
            if (row.numbers.includes(number)) {
                weightedSum += weight;
            }
            totalWeight += weight;
        });

        // e 지수 기반 정규화
        const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
        
        // 미출현 기간에 따른 e 기반 보정
        let lastAppearance = -1;
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].numbers.includes(number)) {
                lastAppearance = i;
                break;
            }
        }
        
        if (lastAppearance >= 0) {
            const absence = data.length - 1 - lastAppearance;
            // e 기반 회귀 보정: 오래 안나왔으면 나올 확률 증가
            const reversionBonus = 1 - Math.exp(-absence / this.E);
            return Math.min(1, baseScore + reversionBonus * 0.3);
        }

        return Math.min(1, baseScore);
    }

    /**
     * 3. π 기반 주기 분석
     * 사인/코사인 함수로 출현 주기 패턴 분석
     */
    static calcPiCycleScore(number, data) {
        const appearances = [];
        
        // 출현 위치 기록
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) {
            return 0.5; // 기본값
        }

        // 출현 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 평균 주기
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // π 기반 예측 위상
        const currentPosition = data.length;
        const lastAppearance = appearances[appearances.length - 1];
        const timeSinceLast = currentPosition - lastAppearance;
        
        // 사인파 기반 출현 확률 (주기 = 평균 간격)
        const phase = (2 * this.PI * timeSinceLast) / avgInterval;
        const cycleScore = (Math.sin(phase - this.PI / 2) + 1) / 2;
        
        // 코사인 기반 안정성 점수
        const stabilityScore = Math.cos(this.PI * (timeSinceLast / avgInterval - 1));
        
        return Math.min(1, Math.max(0, (cycleScore + stabilityScore + 1) / 3));
    }

    /**
     * 4. 피보나치 수열 점수
     * 피보나치 수 및 관련 번호 분석
     */
    static calcFibonacciScore(number, data) {
        let score = 0;

        // 피보나치 수인 경우 기본 점수
        if (this.FIBONACCI.includes(number)) {
            score += 0.3;
        }

        // 두 피보나치 수의 합인지 확인
        for (let i = 0; i < this.FIBONACCI.length; i++) {
            for (let j = i; j < this.FIBONACCI.length; j++) {
                if (this.FIBONACCI[i] + this.FIBONACCI[j] === number) {
                    score += 0.2;
                    break;
                }
            }
        }

        // 최근 데이터에서 피보나치 수와 함께 출현한 패턴
        let fibCoAppearance = 0;
        let appearances = 0;

        data.forEach(row => {
            if (row.numbers.includes(number)) {
                appearances++;
                const fibInRow = row.numbers.filter(n => 
                    n !== number && this.FIBONACCI.includes(n)
                ).length;
                fibCoAppearance += fibInRow;
            }
        });

        if (appearances > 0) {
            score += Math.min(0.5, (fibCoAppearance / appearances) * 0.2);
        }

        return Math.min(1, score);
    }

    /**
     * 5. 소수 친화도 점수
     * 소수 및 소수 관련 패턴 분석
     */
    static calcPrimeAffinityScore(number, data) {
        let score = 0;

        // 소수인 경우
        if (this.PRIMES.includes(number)) {
            score += 0.25;
        }

        // 두 소수의 합/곱 관계
        for (let i = 0; i < this.PRIMES.length; i++) {
            // 두 소수의 합
            for (let j = i; j < this.PRIMES.length; j++) {
                if (this.PRIMES[i] + this.PRIMES[j] === number) {
                    score += 0.1;
                }
            }
            // 소수로 나누어 떨어지는 경우
            if (number % this.PRIMES[i] === 0 && this.PRIMES[i] < number) {
                score += 0.05;
            }
        }

        // 최근 소수 번호 출현 비율
        const recentPrimes = [];
        data.slice(-10).forEach(row => {
            row.numbers.forEach(n => {
                if (this.PRIMES.includes(n)) {
                    recentPrimes.push(n);
                }
            });
        });

        const avgPrimesPerRound = recentPrimes.length / 10;
        const expectedPrimes = (this.PRIMES.length / 45) * 6;
        
        // 소수가 부족하면 소수 번호에 가산점
        if (avgPrimesPerRound < expectedPrimes && this.PRIMES.includes(number)) {
            score += 0.2;
        }

        return Math.min(1, score);
    }

    /**
     * 6. 벤포드 법칙 점수
     * 첫 자리 수 분포가 벤포드 법칙을 따르는지 분석
     */
    static calcBenfordScore(number, data) {
        // 벤포드 분포: log10(1 + 1/d)
        const benfordDist = {};
        for (let d = 1; d <= 9; d++) {
            benfordDist[d] = Math.log10(1 + 1 / d);
        }

        // 실제 첫 자리 수 분포
        const actualDist = {};
        for (let d = 1; d <= 9; d++) {
            actualDist[d] = 0;
        }

        data.forEach(row => {
            row.numbers.forEach(n => {
                const firstDigit = parseInt(n.toString()[0]);
                actualDist[firstDigit]++;
            });
        });

        const total = Object.values(actualDist).reduce((a, b) => a + b, 0);
        for (let d = 1; d <= 9; d++) {
            actualDist[d] /= total;
        }

        // 현재 번호의 첫 자리 수
        const numberFirstDigit = parseInt(number.toString()[0]);
        
        // 벤포드 법칙과의 편차
        const expectedFreq = benfordDist[numberFirstDigit];
        const actualFreq = actualDist[numberFirstDigit];
        
        // 벤포드 기대치보다 적게 나왔으면 높은 점수
        if (actualFreq < expectedFreq) {
            return Math.min(1, 0.5 + (expectedFreq - actualFreq) * 2);
        } else {
            return Math.max(0, 0.5 - (actualFreq - expectedFreq));
        }
    }

    /**
     * 7. 오일러 가중치 점수
     * 오일러 공식 e^(iπ) + 1 = 0 관련 분석
     */
    static calcEulerWeightScore(number, data) {
        // 오일러 공식의 상수들 조합
        const eulerNumbers = [];
        
        // e, π, φ 관련 정수 근사값
        const eApprox = [3, 8, 20]; // e ≈ 3, e² ≈ 7.4, e³ ≈ 20
        const piApprox = [3, 10, 22, 31, 44]; // π ≈ 3.14, π² ≈ 9.87, 10π ≈ 31.4
        const phiApprox = [2, 3, 5, 8, 13, 21, 34]; // 피보나치 (φ 근사)

        eulerNumbers.push(...eApprox, ...piApprox, ...phiApprox);

        let score = 0;

        // 오일러 관련 번호인지
        if (eulerNumbers.includes(number)) {
            score += 0.3;
        }

        // e^x (x = 1, 2, 3, 4) 근처 번호
        for (let x = 1; x <= 4; x++) {
            const eToX = Math.round(Math.pow(this.E, x));
            if (Math.abs(number - eToX) <= 1) {
                score += 0.2;
            }
        }

        // 오일러-마스케로니 상수 γ ≈ 0.577 관련
        // 45 * γ ≈ 26
        const gammaRelated = Math.round(45 * this.EULER_MASCHERONI);
        if (Math.abs(number - gammaRelated) <= 2) {
            score += 0.15;
        }

        // 최근 출현과 e 기반 가중치 조합
        let weightedFreq = 0;
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                const weight = Math.pow(this.E, -(data.length - 1 - idx) / (data.length / this.E));
                weightedFreq += weight;
            }
        });

        score += Math.min(0.35, weightedFreq / (data.length * 0.1));

        return Math.min(1, score);
    }

    /**
     * 8. 조화 평균 기반 점수
     * 출현 간격의 조화 평균 분석
     */
    static calcHarmonicMeanScore(number, data) {
        const appearances = [];
        
        data.forEach((row, idx) => {
            if (row.numbers.includes(number)) {
                appearances.push(idx);
            }
        });

        if (appearances.length < 2) {
            return 0.5;
        }

        // 간격 계산
        const intervals = [];
        for (let i = 1; i < appearances.length; i++) {
            intervals.push(appearances[i] - appearances[i - 1]);
        }

        // 조화 평균 = n / Σ(1/xi)
        const harmonicSum = intervals.reduce((sum, interval) => sum + 1 / interval, 0);
        const harmonicMean = intervals.length / harmonicSum;

        // 산술 평균
        const arithmeticMean = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // 기하 평균
        const geometricMean = Math.pow(
            intervals.reduce((prod, interval) => prod * interval, 1),
            1 / intervals.length
        );

        // AM ≥ GM ≥ HM (항상 성립)
        // 세 평균이 가까울수록 간격이 일정함

        const consistency = 1 - Math.abs(arithmeticMean - harmonicMean) / arithmeticMean;
        
        // 현재 미출현 기간
        const timeSinceLast = data.length - 1 - appearances[appearances.length - 1];
        
        // 조화 평균 기준으로 다음 출현 예측
        const expectedNext = harmonicMean;
        const deviation = Math.abs(timeSinceLast - expectedNext) / expectedNext;

        if (timeSinceLast >= expectedNext * 0.8 && timeSinceLast <= expectedNext * 1.2) {
            // 출현 예상 시점 근처
            return Math.min(1, 0.7 + consistency * 0.3);
        } else if (timeSinceLast > expectedNext * 1.2) {
            // 오버듀: 출현 확률 증가
            return Math.min(1, 0.6 + Math.min(0.4, deviation * 0.2));
        } else {
            // 아직 이름: 출현 확률 낮음
            return Math.max(0, 0.4 - deviation * 0.2);
        }
    }

    /**
     * 특정 방법으로 분석 실행
     */
    static analyzeByMethod(data, method, recentWindow = 50) {
        const recentData = data.slice(-recentWindow);
        const scores = {};

        for (let num = 1; num <= 45; num++) {
            let score = 0;
            
            switch(method) {
                case 'goldenRatio':
                    score = this.calcGoldenRatioScore(num, recentData);
                    break;
                case 'exponentialDecay':
                    score = this.calcExponentialDecayScore(num, recentData);
                    break;
                case 'piCycle':
                    score = this.calcPiCycleScore(num, recentData);
                    break;
                case 'fibonacci':
                    score = this.calcFibonacciScore(num, recentData);
                    break;
                case 'primeAffinity':
                    score = this.calcPrimeAffinityScore(num, recentData);
                    break;
                case 'benford':
                    score = this.calcBenfordScore(num, recentData);
                    break;
                case 'eulerWeight':
                    score = this.calcEulerWeightScore(num, recentData);
                    break;
                case 'harmonicMean':
                    score = this.calcHarmonicMeanScore(num, recentData);
                    break;
                default:
                    score = 0.5;
            }

            scores[num] = {
                number: num,
                score: score
            };
        }

        return scores;
    }

    /**
     * 분석 방법 목록 반환
     */
    static getMethods() {
        return {
            goldenRatio: {
                name: '황금비(φ) 분석',
                description: '번호 간격이 황금비(1.618...)에 가까운 패턴 분석',
                constant: 'φ = (1+√5)/2 ≈ 1.61803'
            },
            exponentialDecay: {
                name: 'e 기반 지수 감쇠',
                description: '자연상수 e를 활용한 시간 기반 가중치 분석',
                constant: 'e ≈ 2.71828'
            },
            piCycle: {
                name: 'π 주기 분석',
                description: '사인/코사인 함수로 출현 주기 패턴 분석',
                constant: 'π ≈ 3.14159'
            },
            fibonacci: {
                name: '피보나치 수열',
                description: '피보나치 수 및 관련 패턴 분석',
                constant: '1, 1, 2, 3, 5, 8, 13, 21, 34...'
            },
            primeAffinity: {
                name: '소수 친화도',
                description: '소수 및 소수 관련 번호 패턴 분석',
                constant: '2, 3, 5, 7, 11, 13...'
            },
            benford: {
                name: '벤포드 법칙',
                description: '첫 자리 수 분포의 자연 법칙 분석',
                constant: 'P(d) = log₁₀(1 + 1/d)'
            },
            eulerWeight: {
                name: '오일러 가중치',
                description: 'e^(iπ) + 1 = 0 관련 상수 조합 분석',
                constant: 'e, π, i, 1, 0'
            },
            harmonicMean: {
                name: '조화 평균 분석',
                description: '출현 간격의 조화 평균 기반 예측',
                constant: 'H = n / Σ(1/xᵢ)'
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
            method: 'Mathematical Constants'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathConstantsAnalysis;
}
