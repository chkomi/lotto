#!/bin/bash
echo "로또 분석 시스템 서버 시작..."
echo "브라우저에서 http://localhost:8000 을 열어주세요"
echo "종료하려면 Ctrl+C를 누르세요"
python3 -m http.server 8000
