/**
 * 엔트로피 가중치법 (Entropy Weight Method)
 * 정보 엔트로피를 이용하여 각 평가 지표의 객관적 가중치를 계산
 */

class EntropyWeightMethod {
    /**
     * 데이터 정규화
     * @param {Array<Array<number>>} data - m개 대안 × n개 지표 행렬
     * @returns {Array<Array<number>>} 정규화된 데이터
     */
    static normalize(data) {
        if (!data || data.length === 0) return [];

        const m = data.length;        // 대안(alternatives) 수
        const n = data[0].length;     // 지표(criteria) 수
        const normalized = [];

        // 각 지표(열)에 대해 정규화
        for (let i = 0; i < m; i++) {
            normalized[i] = [];
            for (let j = 0; j < n; j++) {
                normalized[i][j] = 0;
            }
        }

        // 열별 합계 계산 및 정규화
        for (let j = 0; j < n; j++) {
            let sum = 0;

            // 음수 값 처리: 모든 값을 양수로 변환
            let min = Math.min(...data.map(row => row[j]));
            let offset = min < 0 ? Math.abs(min) + 1 : 0;

            // 합계 계산
            for (let i = 0; i < m; i++) {
                sum += data[i][j] + offset;
            }

            // 정규화: p_ij = (x_ij + offset) / sum
            if (sum > 0) {
                for (let i = 0; i < m; i++) {
                    normalized[i][j] = (data[i][j] + offset) / sum;
                }
            }
        }

        return normalized;
    }

    /**
     * 엔트로피 계산
     * E_j = -k * Σ(p_ij * ln(p_ij))
     * k = 1 / ln(m), m은 대안의 수
     * @param {Array<Array<number>>} normalizedData - 정규화된 데이터
     * @returns {Array<number>} 각 지표의 엔트로피 값
     */
    static calculateEntropy(normalizedData) {
        if (!normalizedData || normalizedData.length === 0) return [];

        const m = normalizedData.length;
        const n = normalizedData[0].length;
        const k = 1 / Math.log(m);  // k = 1/ln(m)
        const entropy = new Array(n).fill(0);

        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let i = 0; i < m; i++) {
                const p = normalizedData[i][j];
                // p * ln(p) 계산 (p=0일 때는 0으로 처리)
                if (p > 0 && p < 1) {
                    sum += p * Math.log(p);
                }
            }
            entropy[j] = -k * sum;
        }

        return entropy;
    }

    /**
     * 가중치 계산
     * D_j = 1 - E_j (차이도)
     * W_j = D_j / ΣD_j (가중치)
     * @param {Array<number>} entropy - 각 지표의 엔트로피
     * @returns {Array<number>} 각 지표의 가중치
     */
    static calculateWeights(entropy) {
        if (!entropy || entropy.length === 0) return [];

        const n = entropy.length;
        const divergence = entropy.map(e => 1 - e);  // D_j = 1 - E_j
        const sumD = divergence.reduce((a, b) => a + b, 0);

        // W_j = D_j / ΣD_j
        const weights = divergence.map(d => sumD > 0 ? d / sumD : 1 / n);

        return weights;
    }

    /**
     * 엔트로피 가중치법 전체 프로세스
     * @param {Array<Array<number>>} data - 원본 데이터 (m × n 행렬)
     * @param {Array<string>} criteriaNames - 지표 이름 (선택사항)
     * @returns {Object} { weights, entropy, normalized }
     */
    static calculate(data, criteriaNames = null) {
        // 1. 데이터 정규화
        const normalized = this.normalize(data);

        // 2. 엔트로피 계산
        const entropy = this.calculateEntropy(normalized);

        // 3. 가중치 계산
        const weights = this.calculateWeights(entropy);

        // 결과 반환
        const result = {
            weights: weights,
            entropy: entropy,
            normalized: normalized,
            divergence: entropy.map(e => 1 - e)
        };

        // 지표 이름이 제공된 경우 매핑
        if (criteriaNames && criteriaNames.length === weights.length) {
            result.weightMap = {};
            result.entropyMap = {};
            criteriaNames.forEach((name, idx) => {
                result.weightMap[name] = weights[idx];
                result.entropyMap[name] = entropy[idx];
            });
        }

        return result;
    }

    /**
     * 가중 점수 계산
     * @param {Array<number>} values - 각 지표의 값
     * @param {Array<number>} weights - 각 지표의 가중치
     * @returns {number} 가중 점수
     */
    static calculateWeightedScore(values, weights) {
        if (values.length !== weights.length) {
            throw new Error('Values and weights must have the same length');
        }

        // 먼저 values를 0-1 범위로 정규화
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min;

        let score = 0;
        for (let i = 0; i < values.length; i++) {
            const normalizedValue = range > 0 ? (values[i] - min) / range : 0;
            score += normalizedValue * weights[i];
        }

        return score;
    }

    /**
     * Min-Max 정규화
     * @param {Array<number>} data - 데이터 배열
     * @returns {Array<number>} 0-1 범위로 정규화된 데이터
     */
    static minMaxNormalize(data) {
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min;

        if (range === 0) return data.map(() => 0.5);

        return data.map(x => (x - min) / range);
    }

    /**
     * Z-score 정규화 (표준화)
     * @param {Array<number>} data - 데이터 배열
     * @returns {Array<number>} 표준화된 데이터
     */
    static zScoreNormalize(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        const std = Math.sqrt(variance);

        if (std === 0) return data.map(() => 0);

        return data.map(x => (x - mean) / std);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntropyWeightMethod;
}
