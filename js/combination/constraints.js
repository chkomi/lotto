/**
 * 로또 조합 구조적 제약조건 검증 모듈
 * 
 * 이 모듈은 6개 번호 조합이 다음 제약조건을 만족하는지 검증합니다:
 * 1. 번호 합계 범위: 100 ≤ sum ≤ 175
 * 2. 홀짝 비율: 2:4, 3:3, 4:2 중 하나
 * 3. 고저 비율: 저(1-22):고(23-45) = 2:4 ~ 4:2
 * 4. 연속번호: 최대 2쌍까지만 허용
 * 5. 끝수 분포: 동일 끝수(일의 자리) 최대 2개
 * 6. 구간 분포: 5개 구간에서 최소 3개 구간 포함
 */

/**
 * 구조적 제약조건 검증 결과
 * @typedef {Object} ConstraintValidationResult
 * @property {boolean} valid - 모든 제약조건을 만족하는지 여부
 * @property {string[]} violations - 위반된 제약조건 목록
 * @property {Object} details - 각 제약조건별 상세 정보
 */

/**
 * 제약조건 설정
 * @typedef {Object} ConstraintConfig
 * @property {number} minSum - 최소 합계 (기본값: 100)
 * @property {number} maxSum - 최대 합계 (기본값: 175)
 * @property {number} maxConsecutivePairs - 최대 연속번호 쌍 수 (기본값: 2)
 * @property {number} maxSameLastDigit - 최대 동일 끝수 개수 (기본값: 2)
 * @property {number} minSections - 최소 포함 구간 수 (기본값: 3)
 * @property {boolean} strict - 엄격 모드 (모든 제약조건 필수, 기본값: false)
 */

/**
 * 기본 제약조건 설정 반환
 * @returns {ConstraintConfig}
 */
function getDefaultConstraints() {
    return {
        minSum: 100,
        maxSum: 175,
        maxConsecutivePairs: 2,
        maxSameLastDigit: 2,
        minSections: 3,
        strict: false
    };
}

/**
 * 주어진 조합이 구조적 제약조건을 만족하는지 검증
 * @param {number[]} combination - 6개 번호 배열 (정렬되어야 함)
 * @param {ConstraintConfig} config - 제약조건 설정
 * @returns {ConstraintValidationResult}
 */
function validateCombination(combination, config = null) {
    const constraints = config || getDefaultConstraints();
    const violations = [];
    const details = {};

    // 입력 검증
    if (!Array.isArray(combination) || combination.length !== 6) {
        return {
            valid: false,
            violations: ['조합은 6개의 번호로 구성되어야 합니다.'],
            details: {}
        };
    }

    // 정렬된 복사본 생성
    const sorted = [...combination].sort((a, b) => a - b);

    // 중복 확인
    if (new Set(sorted).size !== 6) {
        return {
            valid: false,
            violations: ['중복된 번호가 있습니다.'],
            details: {}
        };
    }

    // 1. 번호 합계 범위 검증
    const sum = sorted.reduce((a, b) => a + b, 0);
    details.sum = sum;
    if (sum < constraints.minSum || sum > constraints.maxSum) {
        violations.push(`번호 합계(${sum})가 허용 범위(${constraints.minSum}-${constraints.maxSum})를 벗어났습니다.`);
    }

    // 2. 홀짝 비율 검증
    const oddCount = sorted.filter(n => n % 2 === 1).length;
    const evenCount = 6 - oddCount;
    details.oddEven = { odd: oddCount, even: evenCount };
    const validOddEvenRatios = [
        { odd: 2, even: 4 },
        { odd: 3, even: 3 },
        { odd: 4, even: 2 }
    ];
    const isValidOddEven = validOddEvenRatios.some(
        ratio => ratio.odd === oddCount && ratio.even === evenCount
    );
    if (!isValidOddEven) {
        violations.push(`홀짝 비율(${oddCount}:${evenCount})이 허용 비율(2:4, 3:3, 4:2)을 만족하지 않습니다.`);
    }

    // 3. 고저 비율 검증
    const lowCount = sorted.filter(n => n >= 1 && n <= 22).length;
    const highCount = sorted.filter(n => n >= 23 && n <= 45).length;
    details.lowHigh = { low: lowCount, high: highCount };
    if (lowCount < 2 || lowCount > 4 || highCount < 2 || highCount > 4) {
        violations.push(`고저 비율(저:${lowCount}, 고:${highCount})이 허용 범위(2:4 ~ 4:2)를 벗어났습니다.`);
    }

    // 4. 연속번호 검증
    const consecutivePairs = findConsecutivePairs(sorted);
    details.consecutivePairs = consecutivePairs;
    if (consecutivePairs.length > constraints.maxConsecutivePairs) {
        violations.push(`연속번호 쌍(${consecutivePairs.length}개)이 최대 허용 수(${constraints.maxConsecutivePairs}개)를 초과했습니다.`);
    }

    // 5. 끝수 분포 검증
    const lastDigitCounts = getLastDigitCounts(sorted);
    details.lastDigits = lastDigitCounts;
    const maxSameLastDigit = Math.max(...Object.values(lastDigitCounts));
    if (maxSameLastDigit > constraints.maxSameLastDigit) {
        violations.push(`동일 끝수(${maxSameLastDigit}개)가 최대 허용 수(${constraints.maxSameLastDigit}개)를 초과했습니다.`);
    }

    // 6. 구간 분포 검증
    const sectionCount = getSectionCount(sorted);
    details.sections = sectionCount;
    if (sectionCount < constraints.minSections) {
        violations.push(`포함된 구간 수(${sectionCount}개)가 최소 요구 사항(${constraints.minSections}개)을 만족하지 않습니다.`);
    }

    // 엄격 모드: 모든 제약조건 필수
    // 일반 모드: 일부 위반 허용 (하지만 합계와 홀짝 비율은 중요)
    let valid = true;
    if (constraints.strict) {
        valid = violations.length === 0;
    } else {
        // 중요 제약조건 체크
        const criticalViolations = violations.filter(v => 
            v.includes('합계') || v.includes('홀짝')
        );
        valid = criticalViolations.length === 0;
    }

    return {
        valid: valid,
        violations: violations,
        details: details
    };
}

/**
 * 연속번호 쌍 찾기
 * @param {number[]} sorted - 정렬된 번호 배열
 * @returns {Array<[number, number]>} 연속번호 쌍 배열
 */
function findConsecutivePairs(sorted) {
    const pairs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
            pairs.push([sorted[i], sorted[i + 1]]);
        }
    }
    return pairs;
}

/**
 * 끝수(일의 자리)별 개수 계산
 * @param {number[]} combination - 번호 배열
 * @returns {Object<number, number>} 끝수별 개수
 */
function getLastDigitCounts(combination) {
    const counts = {};
    combination.forEach(num => {
        const lastDigit = num % 10;
        counts[lastDigit] = (counts[lastDigit] || 0) + 1;
    });
    return counts;
}

/**
 * 포함된 구간 수 계산
 * 구간: 1-9, 10-18, 19-27, 28-36, 37-45
 * @param {number[]} combination - 번호 배열
 * @returns {number} 포함된 구간 수
 */
function getSectionCount(combination) {
    const sections = new Set();
    combination.forEach(num => {
        // 구간 인덱스: 0-4
        const sectionIdx = Math.floor((num - 1) / 9);
        sections.add(sectionIdx);
    });
    return sections.size;
}

/**
 * 제약조건 충족도를 점수로 계산 (0-1)
 * @param {number[]} combination - 6개 번호 배열
 * @param {ConstraintConfig} config - 제약조건 설정
 * @returns {number} 충족도 점수 (1.0 = 완벽, 0.0 = 전혀 충족 안 함)
 */
function calculateConstraintScore(combination, config = null) {
    const constraints = config || getDefaultConstraints();
    const validation = validateCombination(combination, constraints);
    
    if (validation.valid) {
        return 1.0;
    }

    // 각 제약조건별 가중치
    const weights = {
        sum: 0.25,
        oddEven: 0.25,
        lowHigh: 0.15,
        consecutive: 0.15,
        lastDigit: 0.10,
        section: 0.10
    };

    let totalScore = 0;
    let totalWeight = 0;

    // 합계 점수
    const sum = combination.reduce((a, b) => a + b, 0);
    const sumScore = (sum >= constraints.minSum && sum <= constraints.maxSum) ? 1.0 : 
                     (sum < constraints.minSum) ? Math.max(0, sum / constraints.minSum) :
                     Math.max(0, (constraints.maxSum - sum) / (constraints.maxSum - 175));
    totalScore += weights.sum * sumScore;
    totalWeight += weights.sum;

    // 홀짝 비율 점수
    const oddCount = combination.filter(n => n % 2 === 1).length;
    const evenCount = 6 - oddCount;
    const validRatios = [[2, 4], [3, 3], [4, 2]];
    const oddEvenMatch = validRatios.some(([o, e]) => o === oddCount && e === evenCount);
    const oddEvenScore = oddEvenMatch ? 1.0 : 0.5;
    totalScore += weights.oddEven * oddEvenScore;
    totalWeight += weights.oddEven;

    // 고저 비율 점수
    const lowCount = combination.filter(n => n >= 1 && n <= 22).length;
    const highCount = combination.filter(n => n >= 23 && n <= 45).length;
    const lowHighValid = (lowCount >= 2 && lowCount <= 4 && highCount >= 2 && highCount <= 4);
    const lowHighScore = lowHighValid ? 1.0 : Math.max(0, 1 - Math.abs(lowCount - 3) / 3);
    totalScore += weights.lowHigh * lowHighScore;
    totalWeight += weights.lowHigh;

    // 연속번호 점수
    const consecutivePairs = findConsecutivePairs([...combination].sort((a, b) => a - b));
    const consecutiveScore = Math.max(0, 1 - (consecutivePairs.length - constraints.maxConsecutivePairs) / 3);
    totalScore += weights.consecutive * consecutiveScore;
    totalWeight += weights.consecutive;

    // 끝수 분포 점수
    const lastDigitCounts = getLastDigitCounts(combination);
    const maxSameLastDigit = Math.max(...Object.values(lastDigitCounts));
    const lastDigitScore = Math.max(0, 1 - (maxSameLastDigit - constraints.maxSameLastDigit) / 3);
    totalScore += weights.lastDigit * lastDigitScore;
    totalWeight += weights.lastDigit;

    // 구간 분포 점수
    const sectionCount = getSectionCount(combination);
    const sectionScore = Math.min(1.0, sectionCount / constraints.minSections);
    totalScore += weights.section * sectionScore;
    totalWeight += weights.section;

    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateCombination,
        getDefaultConstraints,
        calculateConstraintScore,
        findConsecutivePairs,
        getLastDigitCounts,
        getSectionCount
    };
}
