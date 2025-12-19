#!/bin/bash

# 로또 분석 시스템 시작 스크립트

echo "============================================"
echo "  🎰 로또 번호 분석 시스템 서버 시작"
echo "============================================"
echo ""

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 작업 디렉토리: $SCRIPT_DIR"
echo ""

# CSV 파일 확인
if [ -f "data/lotto_1_1202.csv" ]; then
    echo "✅ CSV 파일 확인됨: data/lotto_1_1202.csv"
    FILE_SIZE=$(ls -lh data/lotto_1_1202.csv | awk '{print $5}')
    echo "   파일 크기: $FILE_SIZE"
else
    echo "❌ 오류: CSV 파일을 찾을 수 없습니다!"
    echo "   경로: data/lotto_1_1202.csv"
    exit 1
fi

echo ""
echo "🌐 서버 시작 중..."
echo ""
echo "============================================"
echo "  브라우저에서 아래 주소를 열어주세요:"
echo "  👉 http://localhost:8000"
echo "============================================"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo ""

# Python 서버 시작
python3 -m http.server 8000
