/**
 * 로또 회차 자동 계산 모듈
 * 매주 토요일 추첨 후 자동으로 다음 회차를 계산
 */

/**
 * 다음 토요일 날짜 계산 (한국 시간 기준)
 * @param {Date} fromDate - 기준 날짜 (기본값: 오늘)
 * @returns {Date} 다음 토요일 날짜
 */
function getNextSaturday(fromDate = new Date()) {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay(); // 0=일요일, 6=토요일
    
    // 오늘이 토요일이고 오후 9시 이후면 다음 토요일로 계산
    const hours = date.getHours();
    const isSaturdayAfterDraw = (dayOfWeek === 6 && hours >= 21);
    
    if (isSaturdayAfterDraw || dayOfWeek === 0) {
        // 일요일부터는 다음 토요일까지 일수 계산
        const daysUntilSaturday = dayOfWeek === 0 ? 6 : 7;
        date.setDate(date.getDate() + daysUntilSaturday);
    } else {
        // 월~금요일이면 이번 주 토요일
        const daysUntilSaturday = 6 - dayOfWeek;
        date.setDate(date.getDate() + daysUntilSaturday);
    }
    
    date.setHours(21, 0, 0, 0); // 추첨 시간: 토요일 오후 9시
    return date;
}

/**
 * 기준 날짜와 마지막 회차 정보로 다음 회차 계산
 * @param {number} lastRound - 마지막 회차 번호
 * @param {string} lastDateStr - 마지막 회차 날짜 (YYYY.MM.DD 형식)
 * @returns {Object} 다음 회차 정보
 */
function calculateNextRound(lastRound, lastDateStr) {
    // 마지막 회차 날짜 파싱
    const [year, month, day] = lastDateStr.split('.').map(Number);
    const lastDate = new Date(year, month - 1, day, 21, 0, 0, 0); // 추첨 시간 기준
    
    const now = new Date();
    
    // 다음 회차와 추첨일 계산
    let nextRound = lastRound;
    let nextDrawDate = new Date(lastDate);
    
    // 마지막 추첨일이 오늘(추첨 시간 포함) 이후면 다음 회차로 이동
    if (nextDrawDate <= now) {
        nextDrawDate.setDate(nextDrawDate.getDate() + 7); // 다음 토요일
        nextRound++;
    }
    
    // 다음 추첨일이 여전히 과거이면 계속 다음 주 토요일로 이동
    while (nextDrawDate <= now) {
        nextDrawDate.setDate(nextDrawDate.getDate() + 7);
        nextRound++;
    }
    
    // 날짜 포맷팅 (YYYY.MM.DD)
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}.${m}.${d}`;
    };
    
    // 남은 일수 계산 (시간 단위 정밀도)
    const timeDiff = nextDrawDate.getTime() - now.getTime();
    const daysUntilDraw = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    // 오늘이 추첨일인지 확인 (토요일이고 21시 전이면 오늘이 추첨일)
    const today = new Date();
    const isSaturdayToday = today.getDay() === 6;
    const isBeforeDrawTime = today.getHours() < 21;
    const isDrawToday = isSaturdayToday && isBeforeDrawTime && daysUntilDraw === 0;
    
    return {
        nextRound: nextRound,
        nextDrawDate: formatDate(nextDrawDate),
        daysUntilDraw: daysUntilDraw,
        isDrawToday: isDrawToday,
        lastRound: lastRound,
        lastDate: lastDateStr
    };
}

/**
 * 현재 데이터 기준으로 다음 회차 정보 가져오기
 * @param {Object} analyzer - LottoAnalyzer 인스턴스
 * @returns {Object|null} 다음 회차 정보 또는 null
 */
function getNextRoundInfo(analyzer) {
    if (!analyzer || !analyzer.data || analyzer.data.length === 0) {
        return null;
    }
    
    const lastRoundData = analyzer.data[analyzer.data.length - 1];
    return calculateNextRound(lastRoundData.round, lastRoundData.date);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateNextRound,
        getNextRoundInfo,
        getNextSaturday
    };
}

