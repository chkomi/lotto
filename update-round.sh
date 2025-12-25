#!/bin/bash

# 로또 회차 자동 업데이트 스크립트
# 매주 일요일마다 실행되어 최신 회차 데이터를 확인하고 업데이트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
LATEST_CSV=$(ls -t "$DATA_DIR"/lotto_1_*.csv 2>/dev/null | head -1)

if [ -z "$LATEST_CSV" ]; then
    echo "CSV 파일을 찾을 수 없습니다."
    exit 1
fi

echo "최신 CSV 파일: $LATEST_CSV"

# 마지막 회차 정보 추출
LAST_LINE=$(tail -1 "$LATEST_CSV")
LAST_ROUND=$(echo "$LAST_LINE" | cut -d',' -f1)
LAST_DATE=$(echo "$LAST_LINE" | cut -d',' -f2)

echo "마지막 회차: $LAST_ROUND ($LAST_DATE)"

# 오늘 날짜
TODAY=$(date +%Y.%m.%d)
NEXT_ROUND=$((LAST_ROUND + 1))

# 마지막 날짜로부터 경과한 일수 계산
LAST_TIMESTAMP=$(date -j -f "%Y.%m.%d" "$LAST_DATE" +%s 2>/dev/null || date -d "$LAST_DATE" +%s 2>/dev/null)
TODAY_TIMESTAMP=$(date -j -f "%Y.%m.%d" "$TODAY" +%s 2>/dev/null || date -d "$TODAY" +%s 2>/dev/null)

if [ -z "$LAST_TIMESTAMP" ] || [ -z "$TODAY_TIMESTAMP" ]; then
    echo "날짜 파싱 오류"
    exit 1
fi

DAYS_DIFF=$(( (TODAY_TIMESTAMP - LAST_TIMESTAMP) / 86400 ))

echo "경과 일수: $DAYS_DIFF일"

# 일요일(0) 또는 월요일(1)이고, 마지막 추첨일로부터 7일 이상 경과했으면 새 회차가 생성되었을 가능성
DAY_OF_WEEK=$(date +%w)
IS_SUNDAY_OR_MONDAY=$([ "$DAY_OF_WEEK" -eq 0 ] || [ "$DAY_OF_WEEK" -eq 1 ])

if [ "$IS_SUNDAY_OR_MONDAY" = true ] && [ "$DAYS_DIFF" -ge 6 ]; then
    echo "⚠️  새로운 회차 데이터($NEXT_ROUND회)가 있을 수 있습니다."
    echo "📝 다음 회차 정보:"
    echo "   회차: $NEXT_ROUND"
    echo "   예상 날짜: $TODAY"
    echo ""
    echo "💡 새로운 CSV 파일을 생성하려면:"
    echo "   cp '$LATEST_CSV' '$DATA_DIR/lotto_1_$NEXT_ROUND.csv'"
    echo "   # 그리고 새로운 회차 데이터를 추가하세요"
else
    echo "✅ 아직 새 회차 데이터가 없습니다. (마지막 회차로부터 ${DAYS_DIFF}일 경과)"
fi

