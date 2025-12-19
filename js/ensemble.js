/**
 * Ensemble System (앙상블 시스템)
 * 여러 방법론을 결합하여 최종 예측 수행
 */

class EnsembleAnalyzer {
    constructor() {
        this.methods = {
            entropy: { enabled: true, weight: 0.25 },
            topsis: { enabled: true, weight: 0.25 },
            randomForest: { enabled: true, weight: 0.25 },
            association: { enabled: true, weight: 0.25 }
        };
    }

    /**
     * 앙상블 분석 수행
     * @param {LottoAnalyzer} analyzer - 로또 분석기
     * @param {number} upToRound - 분석할 마지막 회차
     * @returns {Object} 통합 분석 결과
     */
    analyze(analyzer, upToRound = null) {
        const endRound = upToRound || analyzer.data[analyzer.data.length - 1].round;
        const analysisData = analyzer.data.filter(d => d.round <= endRound);

        console.log(`Ensemble analysis for round ${endRound}`);

        // 각 번호(1-45)에 대한 결과 저장
        const results = {};
        for (let num = 1; num <= 45; num++) {
            results[num] = {
                number: num,
                scores: {},
                finalScore: 0,
                rank: 0,
                details: {}
            };
        }

        // 1. Entropy Weight Method
        let entropyResult = null;
        if (this.methods.entropy.enabled) {
            console.log('Running Entropy analysis...');
            entropyResult = this.runEntropyAnalysis(analyzer, analysisData);

            entropyResult.predictions.forEach(pred => {
                results[pred.number].scores.entropy = pred.score;
                results[pred.number].details.entropy = pred.features;
            });
        }

        // 2. TOPSIS
        if (this.methods.topsis.enabled) {
            console.log('Running TOPSIS analysis...');
            const topsisResult = this.runTOPSISAnalysis(analyzer, analysisData, entropyResult);

            topsisResult.forEach((item, idx) => {
                results[item.number].scores.topsis = item.score;
                results[item.number].details.topsis = { rank: item.rank };
            });
        }

        // 3. Random Forest
        if (this.methods.randomForest.enabled) {
            console.log('Running Random Forest analysis...');
            const rfResult = this.runRandomForestAnalysis(analyzer, analysisData, entropyResult);

            Object.entries(rfResult).forEach(([num, score]) => {
                results[num].scores.randomForest = score;
            });
        }

        // 4. Association Rules
        if (this.methods.association.enabled) {
            console.log('Running Association Rules analysis...');
            const assocResult = this.runAssociationAnalysis(analysisData);

            Object.entries(assocResult).forEach(([num, score]) => {
                results[num].scores.association = score;
            });
        }

        // 앙상블 점수 계산
        Object.values(results).forEach(result => {
            let totalWeight = 0;
            let weightedSum = 0;

            Object.entries(this.methods).forEach(([method, config]) => {
                if (config.enabled && result.scores[method] !== undefined) {
                    weightedSum += result.scores[method] * config.weight;
                    totalWeight += config.weight;
                }
            });

            result.finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
        });

        // 점수 기준으로 정렬 및 순위 부여
        const sortedResults = Object.values(results).sort((a, b) => b.finalScore - a.finalScore);
        sortedResults.forEach((result, idx) => {
            result.rank = idx + 1;
        });

        return {
            predictions: sortedResults,
            methods: this.methods,
            methodResults: {
                entropy: entropyResult,
                // 다른 메서드 결과도 저장 가능
            }
        };
    }

    /**
     * Entropy Weight Method 실행
     */
    runEntropyAnalysis(analyzer, data) {
        // 각 번호의 특성 계산
        const numberFeatures = [];
        for (let num = 1; num <= 45; num++) {
            const features = analyzer.calculateFeatures(num, data);
            numberFeatures.push({
                number: num,
                features: features
            });
        }

        // 특성 행렬 구성
        const featureMatrix = numberFeatures.map(nf =>
            analyzer.features.map(fname => nf.features[fname])
        );

        // 엔트로피 가중치 계산
        const entropyResult = EntropyWeightMethod.calculate(featureMatrix, analyzer.features);

        // 각 번호의 가중 점수 계산
        const predictions = [];
        for (let i = 0; i < 45; i++) {
            const score = EntropyWeightMethod.calculateWeightedScore(
                featureMatrix[i],
                entropyResult.weights
            );

            predictions.push({
                number: i + 1,
                score: score,
                features: numberFeatures[i].features
            });
        }

        return {
            predictions: predictions,
            weights: entropyResult.weights,
            weightMap: entropyResult.weightMap
        };
    }

    /**
     * TOPSIS 실행
     */
    runTOPSISAnalysis(analyzer, data, entropyResult) {
        // 특성 행렬
        const featureMatrix = [];
        for (let num = 1; num <= 45; num++) {
            const features = analyzer.calculateFeatures(num, data);
            featureMatrix.push(analyzer.features.map(fname => features[fname]));
        }

        // 가중치 (엔트로피 결과 사용 또는 균등)
        const weights = entropyResult ? entropyResult.weights : new Array(analyzer.features.length).fill(1 / analyzer.features.length);

        // 모든 기준을 이익형으로 설정 (클수록 좋음)
        const benefitCriteria = new Array(analyzer.features.length).fill(true);

        // TOPSIS 분석
        const topsisResult = TOPSIS.analyze(featureMatrix, weights, benefitCriteria);

        // 결과 정리
        const results = [];
        for (let i = 0; i < 45; i++) {
            results.push({
                number: i + 1,
                score: topsisResult.scores[i],
                rank: topsisResult.ranks[i]
            });
        }

        return results;
    }

    /**
     * Random Forest 실행
     */
    runRandomForestAnalysis(analyzer, data, entropyResult) {
        // 번호별 특성
        const numberFeatures = [];
        for (let num = 1; num <= 45; num++) {
            const features = analyzer.calculateFeatures(num, data);
            numberFeatures.push({
                number: num,
                features: features
            });
        }

        // Random Forest로 특성 중요도 계산
        const rfResult = LottoRandomForest.analyzeFeatureImportance(
            data.slice(-100),  // 최근 100회차
            numberFeatures,
            analyzer.features
        );

        // 특성 중요도를 기반으로 각 번호 점수 재계산
        const scores = {};
        for (let i = 0; i < 45; i++) {
            const num = i + 1;
            const featureValues = analyzer.features.map(fname => numberFeatures[i].features[fname]);

            // RF 가중치로 점수 계산
            const score = EntropyWeightMethod.calculateWeightedScore(featureValues, rfResult.weights);
            scores[num] = score;
        }

        return scores;
    }

    /**
     * Association Rules 실행
     */
    runAssociationAnalysis(data) {
        const assocScores = LottoAssociationAnalysis.analyzeAndScore(data);

        const scores = {};
        Object.entries(assocScores).forEach(([num, scoreObj]) => {
            scores[num] = scoreObj.totalScore;
        });

        return scores;
    }

    /**
     * 방법 활성화/비활성화
     */
    setMethodEnabled(method, enabled) {
        if (this.methods[method]) {
            this.methods[method].enabled = enabled;
        }
    }

    /**
     * 방법별 가중치 설정
     */
    setMethodWeight(method, weight) {
        if (this.methods[method]) {
            this.methods[method].weight = weight;
        }
    }

    /**
     * 자동 가중치 정규화
     */
    normalizeWeights() {
        let totalWeight = 0;

        Object.values(this.methods).forEach(method => {
            if (method.enabled) {
                totalWeight += method.weight;
            }
        });

        if (totalWeight > 0) {
            Object.values(this.methods).forEach(method => {
                method.weight /= totalWeight;
            });
        }
    }

    /**
     * 방법 설정 가져오기
     */
    getMethodsConfig() {
        return JSON.parse(JSON.stringify(this.methods));
    }

    /**
     * 방법 설정 저장
     */
    setMethodsConfig(config) {
        Object.entries(config).forEach(([method, settings]) => {
            if (this.methods[method]) {
                this.methods[method] = { ...settings };
            }
        });
    }
}

/**
 * 앙상블 전략
 */
class EnsembleStrategies {
    /**
     * 보수적 전략 (안정성 중시)
     */
    static conservative() {
        return {
            entropy: { enabled: true, weight: 0.4 },
            topsis: { enabled: true, weight: 0.4 },
            randomForest: { enabled: true, weight: 0.1 },
            association: { enabled: true, weight: 0.1 }
        };
    }

    /**
     * 균형 전략
     */
    static balanced() {
        return {
            entropy: { enabled: true, weight: 0.25 },
            topsis: { enabled: true, weight: 0.25 },
            randomForest: { enabled: true, weight: 0.25 },
            association: { enabled: true, weight: 0.25 }
        };
    }

    /**
     * 공격적 전략 (최근 패턴 중시)
     */
    static aggressive() {
        return {
            entropy: { enabled: true, weight: 0.2 },
            topsis: { enabled: true, weight: 0.2 },
            randomForest: { enabled: true, weight: 0.3 },
            association: { enabled: true, weight: 0.3 }
        };
    }

    /**
     * 머신러닝 중심
     */
    static mlFocused() {
        return {
            entropy: { enabled: true, weight: 0.15 },
            topsis: { enabled: true, weight: 0.15 },
            randomForest: { enabled: true, weight: 0.5 },
            association: { enabled: true, weight: 0.2 }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnsembleAnalyzer, EnsembleStrategies };
}
