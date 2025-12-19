/**
 * Simplified Random Forest for Feature Importance
 * 특성 중요도 계산에 초점을 맞춘 간소화된 랜덤 포레스트
 */

class SimpleRandomForest {
    constructor(nTrees = 10) {
        this.nTrees = nTrees;
        this.trees = [];
        this.featureImportance = {};
    }

    /**
     * 학습 데이터로 모델 훈련
     * @param {Array<Object>} trainingData - [{ features: [f1,f2,...], outcome: 0/1 }, ...]
     * @param {Array<string>} featureNames - 특성 이름
     */
    train(trainingData, featureNames) {
        this.featureNames = featureNames;
        this.trees = [];

        // 특성 중요도 초기화
        featureNames.forEach(name => {
            this.featureImportance[name] = 0;
        });

        // 여러 개의 트리 생성
        for (let i = 0; i < this.nTrees; i++) {
            // 부트스트랩 샘플링
            const sample = this.bootstrapSample(trainingData);

            // 결정 트리 생성
            const tree = this.buildTree(sample, featureNames);
            this.trees.push(tree);
        }

        // 특성 중요도 정규화
        const totalImportance = Object.values(this.featureImportance).reduce((a, b) => a + b, 0);
        if (totalImportance > 0) {
            featureNames.forEach(name => {
                this.featureImportance[name] /= totalImportance;
            });
        }
    }

    /**
     * 부트스트랩 샘플링
     */
    bootstrapSample(data) {
        const sample = [];
        const n = data.length;

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * n);
            sample.push(data[idx]);
        }

        return sample;
    }

    /**
     * 간단한 결정 트리 생성
     */
    buildTree(data, featureNames, depth = 0, maxDepth = 5) {
        // 종료 조건
        if (depth >= maxDepth || data.length < 5) {
            return {
                type: 'leaf',
                value: this.majorityClass(data)
            };
        }

        // 최적 분할 찾기
        const split = this.findBestSplit(data, featureNames);

        if (!split) {
            return {
                type: 'leaf',
                value: this.majorityClass(data)
            };
        }

        // 특성 중요도 업데이트
        this.featureImportance[split.feature] += split.importance;

        // 재귀적으로 자식 노드 생성
        const leftData = data.filter(d => d.features[split.featureIdx] <= split.threshold);
        const rightData = data.filter(d => d.features[split.featureIdx] > split.threshold);

        return {
            type: 'node',
            feature: split.feature,
            featureIdx: split.featureIdx,
            threshold: split.threshold,
            left: this.buildTree(leftData, featureNames, depth + 1, maxDepth),
            right: this.buildTree(rightData, featureNames, depth + 1, maxDepth)
        };
    }

    /**
     * 최적 분할점 찾기
     */
    findBestSplit(data, featureNames) {
        let bestSplit = null;
        let bestGini = Infinity;

        const nFeatures = featureNames.length;
        // 랜덤하게 일부 특성만 선택 (Random Forest의 핵심)
        const nFeaturesToTry = Math.max(1, Math.floor(Math.sqrt(nFeatures)));
        const featuresToTry = this.randomSample(nFeatures, nFeaturesToTry);

        featuresToTry.forEach(featureIdx => {
            const feature = featureNames[featureIdx];
            const values = data.map(d => d.features[featureIdx]);
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

            // 각 고유값을 분할점으로 시도
            for (let i = 0; i < uniqueValues.length - 1; i++) {
                const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

                const leftData = data.filter(d => d.features[featureIdx] <= threshold);
                const rightData = data.filter(d => d.features[featureIdx] > threshold);

                if (leftData.length === 0 || rightData.length === 0) continue;

                // Gini impurity 계산
                const gini = this.calculateGini(leftData, rightData);

                if (gini < bestGini) {
                    bestGini = gini;
                    bestSplit = {
                        feature: feature,
                        featureIdx: featureIdx,
                        threshold: threshold,
                        importance: 1 - gini  // 중요도 = 1 - Gini
                    };
                }
            }
        });

        return bestSplit;
    }

    /**
     * Gini impurity 계산
     */
    calculateGini(leftData, rightData) {
        const total = leftData.length + rightData.length;

        const leftGini = this.giniImpurity(leftData);
        const rightGini = this.giniImpurity(rightData);

        return (leftData.length / total) * leftGini + (rightData.length / total) * rightGini;
    }

    /**
     * Gini impurity for a dataset
     */
    giniImpurity(data) {
        if (data.length === 0) return 0;

        const counts = {};
        data.forEach(d => {
            counts[d.outcome] = (counts[d.outcome] || 0) + 1;
        });

        let gini = 1;
        Object.values(counts).forEach(count => {
            const p = count / data.length;
            gini -= p * p;
        });

        return gini;
    }

    /**
     * 다수결 클래스
     */
    majorityClass(data) {
        const counts = {};
        data.forEach(d => {
            counts[d.outcome] = (counts[d.outcome] || 0) + 1;
        });

        return Object.keys(counts).reduce((a, b) =>
            counts[a] > counts[b] ? a : b
        );
    }

    /**
     * 랜덤 샘플링
     */
    randomSample(n, k) {
        const indices = Array.from({ length: n }, (_, i) => i);
        const sample = [];

        for (let i = 0; i < k; i++) {
            const idx = Math.floor(Math.random() * indices.length);
            sample.push(indices[idx]);
            indices.splice(idx, 1);
        }

        return sample;
    }

    /**
     * 특성 중요도 반환
     */
    getFeatureImportance() {
        return this.featureImportance;
    }

    /**
     * 특성 중요도를 가중치로 변환
     */
    getWeights() {
        const weights = [];
        this.featureNames.forEach(name => {
            weights.push(this.featureImportance[name] || 0);
        });
        return weights;
    }

    /**
     * 정규화된 가중치
     */
    getNormalizedWeights() {
        const weights = this.getWeights();
        const sum = weights.reduce((a, b) => a + b, 0);

        if (sum === 0) return weights.map(() => 1 / weights.length);

        return weights.map(w => w / sum);
    }
}

/**
 * 로또 데이터에서 훈련 데이터 생성
 */
class LottoRandomForest {
    /**
     * 로또 데이터로부터 훈련 데이터 생성
     * @param {Array} lottoData - 로또 전체 데이터
     * @param {Array<Object>} numberFeatures - 각 번호의 특성
     */
    static createTrainingData(lottoData, numberFeatures) {
        const trainingData = [];

        // 각 회차에 대해
        for (let i = 1; i < lottoData.length; i++) {
            const currentRound = lottoData[i];
            const winningNumbers = currentRound.numbers;

            // 각 번호(1-45)에 대해
            numberFeatures.forEach(nf => {
                const isWinning = winningNumbers.includes(nf.number) ? 1 : 0;

                trainingData.push({
                    features: Object.values(nf.features),
                    outcome: isWinning
                });
            });
        }

        return trainingData;
    }

    /**
     * Random Forest로 특성 중요도 계산
     */
    static analyzeFeatureImportance(lottoData, numberFeatures, featureNames) {
        const trainingData = this.createTrainingData(lottoData, numberFeatures);

        const rf = new SimpleRandomForest(20);  // 20개 트리
        rf.train(trainingData, featureNames);

        return {
            importance: rf.getFeatureImportance(),
            weights: rf.getNormalizedWeights()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimpleRandomForest, LottoRandomForest };
}
