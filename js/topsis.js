/**
 * TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)
 * 이상해와 최악해로부터의 거리를 계산하여 대안을 평가
 */

class TOPSIS {
    /**
     * TOPSIS 분석 수행
     * @param {Array<Array<number>>} data - m개 대안 × n개 기준 행렬
     * @param {Array<number>} weights - 각 기준의 가중치
     * @param {Array<boolean>} benefitCriteria - 각 기준이 이익형인지 (true: 클수록 좋음, false: 작을수록 좋음)
     * @returns {Object} { scores, ranks, idealSolution, antiIdealSolution }
     */
    static analyze(data, weights, benefitCriteria = null) {
        if (!data || data.length === 0) return null;

        const m = data.length;        // 대안 수
        const n = data[0].length;     // 기준 수

        // 기본값: 모든 기준을 이익형으로 설정
        if (!benefitCriteria) {
            benefitCriteria = new Array(n).fill(true);
        }

        // 1단계: 정규화된 의사결정 행렬 생성
        const normalized = this.normalize(data);

        // 2단계: 가중 정규화 행렬 생성
        const weighted = this.applyWeights(normalized, weights);

        // 3단계: 이상적 해(Ideal Solution)와 최악 해(Anti-Ideal Solution) 결정
        const idealSolution = this.findIdealSolution(weighted, benefitCriteria);
        const antiIdealSolution = this.findAntiIdealSolution(weighted, benefitCriteria);

        // 4단계: 각 대안과 이상해/최악해 간의 거리 계산
        const distancesToIdeal = this.calculateDistances(weighted, idealSolution);
        const distancesToAntiIdeal = this.calculateDistances(weighted, antiIdealSolution);

        // 5단계: 상대적 근접도 계산
        const scores = [];
        for (let i = 0; i < m; i++) {
            const dPlus = distancesToIdeal[i];
            const dMinus = distancesToAntiIdeal[i];
            const score = dMinus / (dPlus + dMinus);
            scores.push(score);
        }

        // 6단계: 순위 결정
        const ranks = this.calculateRanks(scores);

        return {
            scores: scores,
            ranks: ranks,
            idealSolution: idealSolution,
            antiIdealSolution: antiIdealSolution,
            normalized: normalized,
            weighted: weighted
        };
    }

    /**
     * 벡터 정규화 (Vector Normalization)
     */
    static normalize(data) {
        const m = data.length;
        const n = data[0].length;
        const normalized = [];

        for (let i = 0; i < m; i++) {
            normalized[i] = [];
        }

        // 각 열(기준)에 대해 정규화
        for (let j = 0; j < n; j++) {
            // 열의 제곱합 계산
            let sumOfSquares = 0;
            for (let i = 0; i < m; i++) {
                sumOfSquares += data[i][j] * data[i][j];
            }

            const denominator = Math.sqrt(sumOfSquares);

            // 정규화
            for (let i = 0; i < m; i++) {
                normalized[i][j] = denominator > 0 ? data[i][j] / denominator : 0;
            }
        }

        return normalized;
    }

    /**
     * 가중치 적용
     */
    static applyWeights(normalized, weights) {
        const m = normalized.length;
        const n = normalized[0].length;
        const weighted = [];

        for (let i = 0; i < m; i++) {
            weighted[i] = [];
            for (let j = 0; j < n; j++) {
                weighted[i][j] = normalized[i][j] * weights[j];
            }
        }

        return weighted;
    }

    /**
     * 이상적 해 찾기
     */
    static findIdealSolution(weighted, benefitCriteria) {
        const n = weighted[0].length;
        const ideal = [];

        for (let j = 0; j < n; j++) {
            const column = weighted.map(row => row[j]);

            if (benefitCriteria[j]) {
                // 이익형: 최대값
                ideal[j] = Math.max(...column);
            } else {
                // 비용형: 최소값
                ideal[j] = Math.min(...column);
            }
        }

        return ideal;
    }

    /**
     * 최악 해 찾기
     */
    static findAntiIdealSolution(weighted, benefitCriteria) {
        const n = weighted[0].length;
        const antiIdeal = [];

        for (let j = 0; j < n; j++) {
            const column = weighted.map(row => row[j]);

            if (benefitCriteria[j]) {
                // 이익형: 최소값
                antiIdeal[j] = Math.min(...column);
            } else {
                // 비용형: 최대값
                antiIdeal[j] = Math.max(...column);
            }
        }

        return antiIdeal;
    }

    /**
     * 유클리드 거리 계산
     */
    static calculateDistances(weighted, target) {
        const m = weighted.length;
        const n = weighted[0].length;
        const distances = [];

        for (let i = 0; i < m; i++) {
            let sumOfSquares = 0;
            for (let j = 0; j < n; j++) {
                const diff = weighted[i][j] - target[j];
                sumOfSquares += diff * diff;
            }
            distances[i] = Math.sqrt(sumOfSquares);
        }

        return distances;
    }

    /**
     * 순위 계산
     */
    static calculateRanks(scores) {
        const indexed = scores.map((score, idx) => ({ score, idx }));
        indexed.sort((a, b) => b.score - a.score);

        const ranks = new Array(scores.length);
        indexed.forEach((item, rank) => {
            ranks[item.idx] = rank + 1;
        });

        return ranks;
    }

    /**
     * 점수 정규화 (0-1 범위)
     */
    static normalizeScores(scores) {
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const range = max - min;

        if (range === 0) return scores.map(() => 0.5);

        return scores.map(s => (s - min) / range);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TOPSIS;
}
