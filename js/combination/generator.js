/**
 * 로또 조합 생성 엔진
 * 
 * 개별 번호의 점수를 기반으로 구조적 제약조건을 만족하는 6개 번호 조합을 생성합니다.
 */

/**
 * 조합 생성 결과
 * @typedef {Object} GeneratedCombination
 * @property {number[]} numbers - 6개 번호 배열 (정렬됨)
 * @property {number} score - 조합 점수
 * @property {number} confidence - 신뢰도 (0-1)
 * @property {number} constraintScore - 제약조건 충족도 (0-1)
 * @property {Object} details - 상세 정보
 */

/**
 * 조합 생성 설정
 * @typedef {Object} GenerationConfig
 * @property {number} poolSize - 상위 번호 풀 크기 (기본값: 15)
 * @property {number} maxAttempts - 최대 시도 횟수 (기본값: 10000)
 * @property {number} minConstraintScore - 최소 제약조건 충족도 (기본값: 0.7)
 * @property {boolean} strictConstraints - 엄격한 제약조건 모드 (기본값: false)
 * @property {Object} constraints - 제약조건 설정 (getDefaultConstraints() 사용)
 * @property {Object} scoring - 점수 계산 설정 (getDefaultScoringConfig() 사용)
 */

/**
 * 기본 조합 생성 설정 반환
 * @returns {GenerationConfig}
 */
function getDefaultGenerationConfig() {
    return {
        poolSize: 15,
        maxAttempts: 10000,
        minConstraintScore: 0.7,
        strictConstraints: false,
        constraints: null, // getDefaultConstraints() 사용
        scoring: null // getDefaultScoringConfig() 사용
    };
}

/**
 * CombinationGenerator 클래스
 */
class CombinationGenerator {
    /**
     * @param {Object<number, number>} numberScores - 번호별 점수 맵 {1: 85.2, 2: 72.1, ...}
     * @param {GenerationConfig} config - 조합 생성 설정
     */
    constructor(numberScores, config = null) {
        this.numberScores = numberScores || {};
        this.config = config || getDefaultGenerationConfig();
        
        // 제약조건 및 점수 계산 모듈 로드 확인
        if (typeof validateCombination === 'undefined') {
            console.error('constraints.js 모듈을 먼저 로드해야 합니다.');
        }
        if (typeof calculateCombinationScore === 'undefined') {
            console.error('scorer.js 모듈을 먼저 로드해야 합니다.');
        }
    }

    /**
     * 상위 점수 번호 풀 생성
     * @param {number} poolSize - 풀 크기
     * @returns {number[]} 상위 점수 번호 배열
     */
    getTopNumberPool(poolSize = null) {
        const size = poolSize || this.config.poolSize;
        
        // 번호를 점수 기준으로 정렬
        const sortedNumbers = Object.entries(this.numberScores)
            .map(([num, score]) => ({ number: parseInt(num), score: score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, size)
            .map(item => item.number);
        
        return sortedNumbers;
    }

    /**
     * 무작위 조합 생성 (제약조건 미검증)
     * @param {number[]} pool - 번호 풀
     * @returns {number[]} 6개 번호 배열
     */
    generateRandomCombination(pool) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 6).sort((a, b) => a - b);
    }

    /**
     * 단일 조합 생성
     * @param {number[]} pool - 번호 풀
     * @returns {GeneratedCombination|null} 생성된 조합 또는 null
     */
    generateSingle(pool = null) {
        const numberPool = pool || this.getTopNumberPool();
        const constraintsConfig = this.config.constraints || (typeof getDefaultConstraints !== 'undefined' ? getDefaultConstraints() : {});
        
        let attempts = 0;
        const maxAttempts = this.config.maxAttempts;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // 무작위 조합 생성
            const combination = this.generateRandomCombination(numberPool);
            
            // 제약조건 검증
            const validation = validateCombination(combination, constraintsConfig);
            const constraintScore = calculateConstraintScore(combination, constraintsConfig);
            
            // 엄격 모드: 완전히 유효한 조합만 허용
            if (this.config.strictConstraints && !validation.valid) {
                continue;
            }
            
            // 최소 제약조건 충족도 체크
            if (constraintScore < this.config.minConstraintScore) {
                continue;
            }
            
            // 점수 계산
            const scoringConfig = this.config.scoring || (typeof getDefaultScoringConfig !== 'undefined' ? getDefaultScoringConfig() : {});
            const scoreResult = calculateCombinationScore(combination, this.numberScores, scoringConfig);
            
            return {
                numbers: combination,
                score: scoreResult.score,
                confidence: scoreResult.confidence,
                constraintScore: constraintScore,
                details: {
                    ...scoreResult.details,
                    validation: validation,
                    attempts: attempts
                }
            };
        }
        
        // 제약조건을 만족하는 조합을 찾지 못함
        console.warn(`제약조건을 만족하는 조합을 생성하지 못했습니다 (시도 횟수: ${maxAttempts}).`);
        return null;
    }

    /**
     * 여러 조합 생성
     * @param {number} count - 생성할 조합 수
     * @param {number[]} pool - 번호 풀 (옵션)
     * @returns {GeneratedCombination[]} 생성된 조합 배열
     */
    generate(count = 5, pool = null) {
        const combinations = [];
        const numberPool = pool || this.getTopNumberPool();
        const seen = new Set(); // 중복 방지
        
        for (let i = 0; i < count; i++) {
            let attempt = 0;
            const maxAttemptsPerCombination = this.config.maxAttempts;
            let found = false;
            
            while (attempt < maxAttemptsPerCombination && !found) {
                attempt++;
                
                const comb = this.generateSingle(numberPool);
                if (comb) {
                    // 중복 체크 (번호 조합의 문자열 표현으로 비교)
                    const key = comb.numbers.join(',');
                    if (!seen.has(key)) {
                        seen.add(key);
                        combinations.push(comb);
                        found = true;
                    }
                }
            }
            
            if (!found) {
                console.warn(`조합 ${i + 1}번째를 생성하지 못했습니다.`);
            }
        }
        
        // 점수 기준으로 정렬
        combinations.sort((a, b) => {
            // 먼저 점수로 정렬
            if (Math.abs(a.score - b.score) > 0.01) {
                return b.score - a.score;
            }
            // 점수가 같으면 제약조건 충족도로 정렬
            return b.constraintScore - a.constraintScore;
        });
        
        return combinations;
    }

    /**
     * 스마트 조합 생성 (다양성 고려)
     * 상위 점수 번호 풀에서 다양한 조합을 생성하되, 각 번호의 사용 빈도를 고려
     * @param {number} count - 생성할 조합 수
     * @param {number[]} pool - 번호 풀 (옵션)
     * @returns {GeneratedCombination[]} 생성된 조합 배열
     */
    generateDiverse(count = 5, pool = null) {
        const numberPool = pool || this.getTopNumberPool();
        const combinations = [];
        const usageCount = {}; // 각 번호의 사용 횟수
        
        // 초기화
        numberPool.forEach(num => usageCount[num] = 0);
        
        for (let i = 0; i < count; i++) {
            // 사용 빈도에 따라 가중치 조정
            const weightedPool = this.createWeightedPool(numberPool, usageCount);
            
            let attempt = 0;
            const maxAttempts = this.config.maxAttempts;
            let found = false;
            
            while (attempt < maxAttempts && !found) {
                attempt++;
                
                // 가중치 기반 샘플링
                const combination = this.sampleWeightedCombination(weightedPool);
                const constraintsConfig = this.config.constraints || (typeof getDefaultConstraints !== 'undefined' ? getDefaultConstraints() : {});
                
                const validation = validateCombination(combination, constraintsConfig);
                const constraintScore = calculateConstraintScore(combination, constraintsConfig);
                
                if (this.config.strictConstraints && !validation.valid) {
                    continue;
                }
                
                if (constraintScore < this.config.minConstraintScore) {
                    continue;
                }
                
                // 중복 체크
                const key = combination.join(',');
                const isDuplicate = combinations.some(c => c.numbers.join(',') === key);
                if (isDuplicate) {
                    continue;
                }
                
                // 점수 계산
                const scoringConfig = this.config.scoring || (typeof getDefaultScoringConfig !== 'undefined' ? getDefaultScoringConfig() : {});
                const scoreResult = calculateCombinationScore(combination, this.numberScores, scoringConfig);
                
                const comb = {
                    numbers: combination,
                    score: scoreResult.score,
                    confidence: scoreResult.confidence,
                    constraintScore: constraintScore,
                    details: {
                        ...scoreResult.details,
                        validation: validation,
                        attempts: attempt
                    }
                };
                
                combinations.push(comb);
                
                // 사용 횟수 업데이트
                combination.forEach(num => usageCount[num]++);
                found = true;
            }
        }
        
        // 점수 기준으로 정렬
        combinations.sort((a, b) => {
            if (Math.abs(a.score - b.score) > 0.01) {
                return b.score - a.score;
            }
            return b.constraintScore - a.constraintScore;
        });
        
        return combinations;
    }

    /**
     * 가중치 풀 생성 (사용 빈도 고려)
     * @param {number[]} pool - 번호 풀
     * @param {Object<number, number>} usageCount - 사용 횟수
     * @returns {Array<{number: number, weight: number}>} 가중치 배열
     */
    createWeightedPool(pool, usageCount) {
        const maxUsage = Math.max(...Object.values(usageCount));
        
        return pool.map(num => {
            // 사용 횟수가 적을수록 높은 가중치
            const usage = usageCount[num] || 0;
            const weight = 1 / (1 + usage / (maxUsage + 1));
            return { number: num, weight: weight };
        });
    }

    /**
     * 가중치 기반 조합 샘플링
     * @param {Array<{number: number, weight: number}>} weightedPool - 가중치 풀
     * @returns {number[]} 6개 번호 배열
     */
    sampleWeightedCombination(weightedPool) {
        // 가중치 기반 무작위 샘플링
        const selected = [];
        const available = [...weightedPool];
        
        for (let i = 0; i < 6; i++) {
            // 총 가중치 계산
            const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
            let random = Math.random() * totalWeight;
            
            // 가중치 기반 선택
            for (let j = 0; j < available.length; j++) {
                random -= available[j].weight;
                if (random <= 0) {
                    selected.push(available[j].number);
                    available.splice(j, 1);
                    break;
                }
            }
        }
        
        return selected.sort((a, b) => a - b);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CombinationGenerator,
        getDefaultGenerationConfig
    };
}
