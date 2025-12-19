/**
 * Association Rule Mining (연관 규칙 분석)
 * Apriori 알고리즘을 이용한 번호 간 연관성 분석
 */

class AssociationRuleMining {
    constructor(minSupport = 0.05, minConfidence = 0.3) {
        this.minSupport = minSupport;
        this.minConfidence = minConfidence;
        this.frequentItemsets = [];
        this.rules = [];
    }

    /**
     * 로또 데이터에서 연관 규칙 마이닝
     * @param {Array} lottoData - 로또 당첨 데이터
     * @returns {Object} { frequentPairs, rules, numberScores }
     */
    analyzeLottoData(lottoData) {
        // 트랜잭션 생성 (각 회차의 당첨 번호 집합)
        const transactions = lottoData.map(round => round.numbers);

        // 1-itemsets (개별 번호) 빈도 계산
        const itemCounts = this.countItems(transactions);

        // 2-itemsets (번호 쌍) 빈도 계산
        const pairCounts = this.countPairs(transactions);

        // Support 계산
        const totalTransactions = transactions.length;

        // Frequent pairs (자주 함께 나오는 번호 쌍)
        const frequentPairs = [];

        Object.entries(pairCounts).forEach(([pair, count]) => {
            const support = count / totalTransactions;

            if (support >= this.minSupport) {
                const [num1, num2] = pair.split(',').map(Number);

                frequentPairs.push({
                    numbers: [num1, num2],
                    support: support,
                    count: count
                });
            }
        });

        // Support 기준으로 정렬
        frequentPairs.sort((a, b) => b.support - a.support);

        // 연관 규칙 생성
        const rules = this.generateRules(frequentPairs, itemCounts, totalTransactions);

        // 각 번호의 연관성 점수 계산
        const numberScores = this.calculateNumberScores(frequentPairs, rules);

        return {
            frequentPairs: frequentPairs.slice(0, 50),  // 상위 50개
            rules: rules.slice(0, 50),
            numberScores: numberScores
        };
    }

    /**
     * 개별 아이템 빈도 계산
     */
    countItems(transactions) {
        const counts = {};

        transactions.forEach(transaction => {
            transaction.forEach(item => {
                counts[item] = (counts[item] || 0) + 1;
            });
        });

        return counts;
    }

    /**
     * 아이템 쌍 빈도 계산
     */
    countPairs(transactions) {
        const counts = {};

        transactions.forEach(transaction => {
            // 조합 생성
            for (let i = 0; i < transaction.length; i++) {
                for (let j = i + 1; j < transaction.length; j++) {
                    const pair = [transaction[i], transaction[j]].sort((a, b) => a - b).join(',');
                    counts[pair] = (counts[pair] || 0) + 1;
                }
            }
        });

        return counts;
    }

    /**
     * 연관 규칙 생성
     * 규칙: A → B (A가 나왔을 때 B가 나올 확률)
     */
    generateRules(frequentPairs, itemCounts, totalTransactions) {
        const rules = [];

        frequentPairs.forEach(pair => {
            const [num1, num2] = pair.numbers;

            // 규칙 1: num1 → num2
            const confidence1 = (pair.count) / (itemCounts[num1] || 1);
            const lift1 = confidence1 / ((itemCounts[num2] || 1) / totalTransactions);

            if (confidence1 >= this.minConfidence) {
                rules.push({
                    antecedent: [num1],
                    consequent: [num2],
                    support: pair.support,
                    confidence: confidence1,
                    lift: lift1
                });
            }

            // 규칙 2: num2 → num1
            const confidence2 = (pair.count) / (itemCounts[num2] || 1);
            const lift2 = confidence2 / ((itemCounts[num1] || 1) / totalTransactions);

            if (confidence2 >= this.minConfidence) {
                rules.push({
                    antecedent: [num2],
                    consequent: [num1],
                    support: pair.support,
                    confidence: confidence2,
                    lift: lift2
                });
            }
        });

        // Lift 기준으로 정렬 (Lift > 1이면 양의 연관성)
        rules.sort((a, b) => b.lift - a.lift);

        return rules;
    }

    /**
     * 각 번호의 연관성 점수 계산
     */
    calculateNumberScores(frequentPairs, rules) {
        const scores = {};

        // 1-45 초기화
        for (let i = 1; i <= 45; i++) {
            scores[i] = {
                pairScore: 0,      // 쌍 빈도 점수
                ruleScore: 0,      // 규칙 점수
                totalScore: 0
            };
        }

        // Frequent pairs 점수
        frequentPairs.forEach((pair, idx) => {
            const weight = 1 / (idx + 1);  // 순위가 높을수록 높은 가중치

            pair.numbers.forEach(num => {
                scores[num].pairScore += pair.support * weight;
            });
        });

        // Association rules 점수
        rules.forEach((rule, idx) => {
            const weight = 1 / (idx + 1);

            rule.consequent.forEach(num => {
                scores[num].ruleScore += rule.lift * weight;
            });
        });

        // 총점 계산 및 정규화
        let maxPairScore = 0;
        let maxRuleScore = 0;

        Object.values(scores).forEach(s => {
            maxPairScore = Math.max(maxPairScore, s.pairScore);
            maxRuleScore = Math.max(maxRuleScore, s.ruleScore);
        });

        Object.keys(scores).forEach(num => {
            if (maxPairScore > 0) {
                scores[num].pairScore /= maxPairScore;
            }
            if (maxRuleScore > 0) {
                scores[num].ruleScore /= maxRuleScore;
            }

            // 총점 = 평균
            scores[num].totalScore = (scores[num].pairScore + scores[num].ruleScore) / 2;
        });

        return scores;
    }

    /**
     * 특정 번호 집합과 가장 잘 어울리는 번호 추천
     */
    recommendNumbers(selectedNumbers, frequentPairs, topN = 5) {
        const recommendations = {};

        // 1-45 초기화
        for (let i = 1; i <= 45; i++) {
            if (!selectedNumbers.includes(i)) {
                recommendations[i] = 0;
            }
        }

        // 선택된 번호와 함께 나온 빈도 계산
        frequentPairs.forEach(pair => {
            const [num1, num2] = pair.numbers;

            if (selectedNumbers.includes(num1) && !selectedNumbers.includes(num2)) {
                recommendations[num2] += pair.support;
            } else if (selectedNumbers.includes(num2) && !selectedNumbers.includes(num1)) {
                recommendations[num1] += pair.support;
            }
        });

        // 정렬
        const sorted = Object.entries(recommendations)
            .map(([num, score]) => ({ number: parseInt(num), score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);

        return sorted;
    }
}

/**
 * 로또 연관 규칙 분석 헬퍼
 */
class LottoAssociationAnalysis {
    /**
     * 연관 규칙 기반 번호 점수 계산
     */
    static analyzeAndScore(lottoData, recentWindow = 100) {
        // 최근 데이터만 사용
        const recentData = lottoData.slice(-recentWindow);

        const arm = new AssociationRuleMining(0.05, 0.3);
        const analysis = arm.analyzeLottoData(recentData);

        return analysis.numberScores;
    }

    /**
     * 조합 추천
     */
    static recommendCombination(lottoData, selectedNumbers = [], recentWindow = 100) {
        const recentData = lottoData.slice(-recentWindow);

        const arm = new AssociationRuleMining(0.05, 0.3);
        const analysis = arm.analyzeLottoData(recentData);

        if (selectedNumbers.length > 0) {
            return arm.recommendNumbers(selectedNumbers, analysis.frequentPairs, 10);
        }

        // 선택된 번호가 없으면 전체 점수 반환
        return Object.entries(analysis.numberScores)
            .map(([num, scores]) => ({
                number: parseInt(num),
                score: scores.totalScore
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * 상위 연관 규칙 반환
     */
    static getTopRules(lottoData, topN = 10, recentWindow = 100) {
        const recentData = lottoData.slice(-recentWindow);

        const arm = new AssociationRuleMining(0.05, 0.3);
        const analysis = arm.analyzeLottoData(recentData);

        return analysis.rules.slice(0, topN);
    }

    /**
     * 자주 함께 나오는 번호 쌍 반환
     */
    static getFrequentPairs(lottoData, topN = 10, recentWindow = 100) {
        const recentData = lottoData.slice(-recentWindow);

        const arm = new AssociationRuleMining(0.05, 0.3);
        const analysis = arm.analyzeLottoData(recentData);

        return analysis.frequentPairs.slice(0, topN);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssociationRuleMining, LottoAssociationAnalysis };
}
