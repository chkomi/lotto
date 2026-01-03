/**
 * 확률 향상 전략 모듈
 * 다양한 통계적 전략을 적용하여 당첨 확률을 높이는 기법들
 */

class ProbabilityStrategies {
    constructor() {
        // 전략별 활성화 상태
        this.enabledStrategies = {
            hotCold: true,          // 핫/콜드 전략
            absenceCorrection: true, // 미출현 보정
            sectionBalance: true,    // 구간 균형
            oddEvenBalance: true,    // 홀짝 균형
            sumRange: true,          // 합계 범위
            consecutiveLimit: true,  // 연속 번호 제한
            acValue: true            // AC 값 최적화
        };

        // 전략별 파라미터
        this.params = {
            hotWindow: 10,           // 핫 번호 분석 윈도우
            coldThreshold: 15,       // 콜드 번호 기준 (미출현 회차)
            sectionCount: 5,         // 구간 수 (1-9, 10-18, ...)
            targetOddRatio: 0.5,     // 목표 홀수 비율
            sumMin: 100,             // 합계 최소
            sumMax: 170,             // 합계 최대
            maxConsecutive: 2,       // 최대 연속 번호 수
            minAC: 6                 // 최소 AC 값
        };
    }

    /**
     * 핫/콜드 전략 점수 조정
     * - 핫 번호: 최근 자주 나온 번호 (모멘텀)
     * - 콜드 번호: 장기 미출현 번호 (평균 회귀)
     */
    applyHotColdStrategy(scores, data) {
        if (!this.enabledStrategies.hotCold) return scores;

        const hotData = data.slice(-this.params.hotWindow);
        const hotNumbers = new Set();
        const coldNumbers = new Set();

        // 핫 번호 식별
        const hotCounts = {};
        for (let num = 1; num <= 45; num++) {
            hotCounts[num] = 0;
        }

        hotData.forEach(d => {
            d.numbers.forEach(num => hotCounts[num]++);
        });

        // 상위 20%를 핫 번호로
        const sortedByHot = Object.entries(hotCounts).sort((a, b) => b[1] - a[1]);
        sortedByHot.slice(0, 9).forEach(([num]) => hotNumbers.add(parseInt(num)));

        // 콜드 번호 식별 (장기 미출현)
        for (let num = 1; num <= 45; num++) {
            let lastAppearance = -1;
            for (let i = data.length - 1; i >= 0; i--) {
                if (data[i].numbers.includes(num)) {
                    lastAppearance = i;
                    break;
                }
            }
            if (lastAppearance === -1 || (data.length - 1 - lastAppearance) >= this.params.coldThreshold) {
                coldNumbers.add(num);
            }
        }

        // 점수 조정
        return scores.map(s => {
            let adjustment = 0;

            if (hotNumbers.has(s.number)) {
                adjustment += 5;  // 핫 번호 보너스
            }

            if (coldNumbers.has(s.number)) {
                adjustment += 8;  // 콜드 번호 보너스 (평균 회귀)
            }

            return {
                ...s,
                probability: Math.min(100, s.probability + adjustment),
                strategies: { ...s.strategies, hotCold: adjustment }
            };
        });
    }

    /**
     * 구간 균형 전략
     * 5개 구간에서 균형있게 번호 선택
     */
    applySectionBalanceStrategy(scores, data) {
        if (!this.enabledStrategies.sectionBalance) return scores;

        const recentData = data.slice(-20);
        const sectionCounts = [0, 0, 0, 0, 0];

        // 최근 구간별 출현 빈도
        recentData.forEach(d => {
            d.numbers.forEach(num => {
                const section = Math.floor((num - 1) / 9);
                sectionCounts[section]++;
            });
        });

        const avg = sectionCounts.reduce((a, b) => a + b, 0) / 5;

        return scores.map(s => {
            const section = Math.floor((s.number - 1) / 9);

            // 덜 나온 구간의 번호에 보너스
            let adjustment = 0;
            if (sectionCounts[section] < avg * 0.8) {
                adjustment = 6;
            } else if (sectionCounts[section] > avg * 1.2) {
                adjustment = -3;
            }

            return {
                ...s,
                probability: Math.min(100, Math.max(0, s.probability + adjustment)),
                strategies: { ...s.strategies, sectionBalance: adjustment }
            };
        });
    }

    /**
     * 홀짝 균형 전략
     * 통계적으로 3:3 비율이 가장 많이 나옴
     */
    applyOddEvenBalanceStrategy(scores, selectedNumbers = []) {
        if (!this.enabledStrategies.oddEvenBalance) return scores;

        const oddCount = selectedNumbers.filter(n => n % 2 === 1).length;
        const evenCount = selectedNumbers.length - oddCount;
        const targetOdd = Math.round(6 * this.params.targetOddRatio);
        const targetEven = 6 - targetOdd;

        return scores.map(s => {
            const isOdd = s.number % 2 === 1;
            let adjustment = 0;

            // 현재 선택에서 부족한 타입 선호
            if (oddCount < targetOdd && isOdd) {
                adjustment = 4;
            } else if (evenCount < targetEven && !isOdd) {
                adjustment = 4;
            } else if (oddCount >= targetOdd && isOdd) {
                adjustment = -2;
            } else if (evenCount >= targetEven && !isOdd) {
                adjustment = -2;
            }

            return {
                ...s,
                probability: Math.min(100, Math.max(0, s.probability + adjustment)),
                strategies: { ...s.strategies, oddEvenBalance: adjustment }
            };
        });
    }

    /**
     * 합계 범위 전략
     * 역대 당첨 번호 합계는 대부분 100-170 범위
     */
    applySumRangeStrategy(scores, selectedNumbers = []) {
        if (!this.enabledStrategies.sumRange) return scores;

        const currentSum = selectedNumbers.reduce((a, b) => a + b, 0);
        const remaining = 6 - selectedNumbers.length;

        if (remaining <= 0) return scores;

        // 목표 합계 범위에 들어가기 위한 필요 합계
        const minNeeded = this.params.sumMin - currentSum;
        const maxNeeded = this.params.sumMax - currentSum;

        // 남은 번호들로 달성 가능한 평균값
        const avgNeededPerNumber = (minNeeded + maxNeeded) / 2 / remaining;

        return scores.map(s => {
            // 번호가 목표 합계에 기여하는 정도 평가
            let adjustment = 0;

            if (remaining > 0) {
                const minAvg = 1 + (remaining - 1) / 2;  // 최소 평균 (1,2,3... 선택시)
                const maxAvg = 45 - (remaining - 1) / 2; // 최대 평균 (43,44,45... 선택시)

                if (s.number >= minNeeded / remaining && s.number <= maxNeeded / remaining) {
                    adjustment = 3;  // 목표 범위에 기여
                } else if (currentSum + s.number > this.params.sumMax ||
                    currentSum + s.number + (remaining - 1) * 1 < this.params.sumMin) {
                    adjustment = -5;  // 범위 벗어남
                }
            }

            return {
                ...s,
                probability: Math.min(100, Math.max(0, s.probability + adjustment)),
                strategies: { ...s.strategies, sumRange: adjustment }
            };
        });
    }

    /**
     * 연속 번호 제한 전략
     * 연속 번호가 너무 많으면 패널티
     */
    applyConsecutiveLimitStrategy(scores, selectedNumbers = []) {
        if (!this.enabledStrategies.consecutiveLimit) return scores;

        const sorted = [...selectedNumbers].sort((a, b) => a - b);

        return scores.map(s => {
            const testNumbers = [...sorted, s.number].sort((a, b) => a - b);
            const consecutiveGroups = this.countConsecutiveGroups(testNumbers);

            let adjustment = 0;
            if (consecutiveGroups > this.params.maxConsecutive) {
                adjustment = -10;  // 연속 번호 초과 패널티
            } else if (consecutiveGroups === 1 && selectedNumbers.length >= 4) {
                // 너무 적은 연속도 피함 (1-2개는 있는게 통계적으로 유리)
                const hasConsecutive = testNumbers.some((n, i) =>
                    i > 0 && n === testNumbers[i - 1] + 1
                );
                if (!hasConsecutive) {
                    adjustment = -2;
                }
            }

            return {
                ...s,
                probability: Math.min(100, Math.max(0, s.probability + adjustment)),
                strategies: { ...s.strategies, consecutiveLimit: adjustment }
            };
        });
    }

    /**
     * 연속 번호 그룹 수 계산
     */
    countConsecutiveGroups(numbers) {
        if (numbers.length < 2) return 0;

        let groups = 0;
        let inGroup = false;

        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] === numbers[i - 1] + 1) {
                if (!inGroup) {
                    groups++;
                    inGroup = true;
                }
            } else {
                inGroup = false;
            }
        }

        return groups;
    }

    /**
     * AC 값 최적화 전략
     * AC(Arithmetic Complexity) 값이 6 이상인 조합 선호
     */
    applyACValueStrategy(scores, selectedNumbers = []) {
        if (!this.enabledStrategies.acValue || selectedNumbers.length < 3) return scores;

        return scores.map(s => {
            const testNumbers = [...selectedNumbers, s.number].sort((a, b) => a - b);
            const ac = this.calculateAC(testNumbers);

            let adjustment = 0;
            if (testNumbers.length >= 4) {
                if (ac >= this.params.minAC) {
                    adjustment = 3;  // 좋은 AC 값 보너스
                } else if (ac < 4) {
                    adjustment = -5;  // 낮은 AC 값 패널티
                }
            }

            return {
                ...s,
                probability: Math.min(100, Math.max(0, s.probability + adjustment)),
                strategies: { ...s.strategies, acValue: adjustment }
            };
        });
    }

    /**
     * AC 값 계산 (Arithmetic Complexity)
     * 번호들 간의 차이값 종류 수
     */
    calculateAC(numbers) {
        if (numbers.length < 2) return 0;

        const differences = new Set();

        for (let i = 0; i < numbers.length; i++) {
            for (let j = i + 1; j < numbers.length; j++) {
                differences.add(numbers[j] - numbers[i]);
            }
        }

        // AC = 차이값 종류 수 - (n-1)
        const n = numbers.length;
        return differences.size - (n - 1);
    }

    /**
     * 모든 전략을 순차적으로 적용
     */
    applyAllStrategies(scores, data, selectedNumbers = []) {
        let adjustedScores = scores.map(s => ({ ...s, strategies: {} }));

        adjustedScores = this.applyHotColdStrategy(adjustedScores, data);
        adjustedScores = this.applySectionBalanceStrategy(adjustedScores, data);
        adjustedScores = this.applyOddEvenBalanceStrategy(adjustedScores, selectedNumbers);
        adjustedScores = this.applySumRangeStrategy(adjustedScores, selectedNumbers);
        adjustedScores = this.applyConsecutiveLimitStrategy(adjustedScores, selectedNumbers);
        adjustedScores = this.applyACValueStrategy(adjustedScores, selectedNumbers);

        // 총 전략 조정값 계산
        adjustedScores = adjustedScores.map(s => ({
            ...s,
            totalAdjustment: Object.values(s.strategies || {}).reduce((a, b) => a + b, 0)
        }));

        return adjustedScores.sort((a, b) => b.probability - a.probability);
    }

    /**
     * 최적 6개 번호 조합 선택
     */
    selectOptimalCombination(scores, data) {
        const selected = [];
        let currentScores = [...scores];

        for (let i = 0; i < 6; i++) {
            // 현재 선택 상태에서 전략 적용
            currentScores = this.applyAllStrategies(currentScores, data, selected);

            // 아직 선택되지 않은 최고 점수 번호 선택
            const best = currentScores.find(s => !selected.includes(s.number));
            if (best) {
                selected.push(best.number);
            }
        }

        return selected.sort((a, b) => a - b);
    }

    /**
     * 조합 품질 평가
     */
    evaluateCombination(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);

        // 합계
        const sum = numbers.reduce((a, b) => a + b, 0);
        const sumScore = (sum >= this.params.sumMin && sum <= this.params.sumMax) ? 100 :
            Math.max(0, 100 - Math.abs(sum - 135) * 2);

        // 홀짝 비율
        const oddCount = numbers.filter(n => n % 2 === 1).length;
        const oddEvenScore = (oddCount === 3) ? 100 :
            (oddCount === 2 || oddCount === 4) ? 80 :
                (oddCount === 1 || oddCount === 5) ? 40 : 20;

        // 구간 분포
        const sections = [0, 0, 0, 0, 0];
        numbers.forEach(n => sections[Math.floor((n - 1) / 9)]++);
        const sectionVariance = sections.reduce((sum, c) => sum + Math.pow(c - 1.2, 2), 0) / 5;
        const sectionScore = Math.max(0, 100 - sectionVariance * 30);

        // AC 값
        const ac = this.calculateAC(sorted);
        const acScore = ac >= 7 ? 100 : ac >= 6 ? 80 : ac >= 5 ? 60 : ac >= 4 ? 40 : 20;

        // 연속 번호
        const consecutive = this.countConsecutiveGroups(sorted);
        const consecutiveScore = consecutive <= 2 ? 100 : consecutive === 3 ? 60 : 20;

        return {
            sum: sum,
            sumScore: sumScore,
            oddCount: oddCount,
            oddEvenScore: oddEvenScore,
            sections: sections,
            sectionScore: sectionScore,
            ac: ac,
            acScore: acScore,
            consecutive: consecutive,
            consecutiveScore: consecutiveScore,
            totalScore: (sumScore + oddEvenScore + sectionScore + acScore + consecutiveScore) / 5
        };
    }

    /**
     * 전략 활성화/비활성화
     */
    setStrategy(strategyName, enabled) {
        if (this.enabledStrategies.hasOwnProperty(strategyName)) {
            this.enabledStrategies[strategyName] = enabled;
        }
    }

    /**
     * 파라미터 설정
     */
    setParams(newParams) {
        this.params = { ...this.params, ...newParams };
    }

    /**
     * 전략 목록 반환
     */
    getStrategies() {
        return [
            { key: 'hotCold', name: '핫/콜드 전략', description: '최근 출현 빈도 기반 번호 선택', enabled: this.enabledStrategies.hotCold },
            { key: 'absenceCorrection', name: '미출현 보정', description: '장기 미출현 번호 가중치 상향', enabled: this.enabledStrategies.absenceCorrection },
            { key: 'sectionBalance', name: '구간 균형', description: '1-9, 10-18 등 구간별 분산', enabled: this.enabledStrategies.sectionBalance },
            { key: 'oddEvenBalance', name: '홀짝 균형', description: '홀수/짝수 3:3 비율 최적화', enabled: this.enabledStrategies.oddEvenBalance },
            { key: 'sumRange', name: '합계 범위', description: '총합 100-170 범위 집중', enabled: this.enabledStrategies.sumRange },
            { key: 'consecutiveLimit', name: '연속 번호 제한', description: '연속 번호 2개 이하 유지', enabled: this.enabledStrategies.consecutiveLimit },
            { key: 'acValue', name: 'AC 값 최적화', description: '차이값 다양성 (AC=6 이상)', enabled: this.enabledStrategies.acValue }
        ];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProbabilityStrategies;
}
