import { AlertCircle, MapPin, Navigation, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface GPSCoords {
  latitude: number;
  longitude: number;
}

const YatapLocationMap: React.FC = () => {
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [gpsCoords, setGpsCoords] = useState<GPSCoords | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watchIdRef = useRef<number | null>(null);

  // 야탑역 주변 지역 GPS 경계 좌표
  const mapBounds = {
    north: 37.415, // 북쪽 경계
    south: 37.405, // 남쪽 경계
    west: 127.125, // 서쪽 경계
    east: 127.135, // 동쪽 경계
  };

  // 야탑역 중심 좌표
  const yatapStation = {
    latitude: 37.41,
    longitude: 127.13,
  };

  const mapWidth = 800;
  const mapHeight = 600;

  // GPS 좌표를 이미지 좌표로 변환
  const gpsToImageCoords = (lat: number, lng: number): Position => {
    const x =
      ((lng - mapBounds.west) / (mapBounds.east - mapBounds.west)) * mapWidth;
    const y =
      ((mapBounds.north - lat) / (mapBounds.north - mapBounds.south)) *
      mapHeight;

    return {
      x: Math.max(0, Math.min(mapWidth, x)),
      y: Math.max(0, Math.min(mapHeight, y)),
    };
  };

  // 거리 계산 (미터 단위)
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // 지도 그리기
  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 배경 지우기
    ctx.clearRect(0, 0, mapWidth, mapHeight);

    // 배경 그라데이션
    const gradient = ctx.createLinearGradient(0, 0, 0, mapHeight);
    gradient.addColorStop(0, "#e8f5e8");
    gradient.addColorStop(1, "#d4edda");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // 격자 그리기
    ctx.strokeStyle = "#c3c3c3";
    ctx.lineWidth = 1;
    for (let i = 0; i <= mapWidth; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, mapHeight);
      ctx.stroke();
    }
    for (let i = 0; i <= mapHeight; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(mapWidth, i);
      ctx.stroke();
    }

    // 도로 그리기 (가상)
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 4;
    // 수평 도로
    ctx.beginPath();
    ctx.moveTo(0, mapHeight / 2);
    ctx.lineTo(mapWidth, mapHeight / 2);
    ctx.stroke();

    // 수직 도로
    ctx.beginPath();
    ctx.moveTo(mapWidth / 2, 0);
    ctx.lineTo(mapWidth / 2, mapHeight);
    ctx.stroke();

    // 야탑역 표시
    const stationPos = gpsToImageCoords(
      yatapStation.latitude,
      yatapStation.longitude
    );
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(stationPos.x, stationPos.y, 8, 0, 2 * Math.PI);
    ctx.fill();

    // 야탑역 텍스트
    ctx.fillStyle = "#000";
    ctx.font = "14px sans-serif";
    ctx.fillText("야탑역", stationPos.x + 12, stationPos.y + 5);

    // 현재 위치 표시
    if (currentPosition) {
      // 정확도 원 그리기
      if (accuracy) {
        const accuracyRadius = Math.min(accuracy / 10, 50); // 정확도를 픽셀로 변환
        ctx.fillStyle = "rgba(74, 144, 226, 0.2)";
        ctx.beginPath();
        ctx.arc(
          currentPosition.x,
          currentPosition.y,
          accuracyRadius,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }

      // 현재 위치 마커
      ctx.fillStyle = "#4a90e2";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(currentPosition.x, currentPosition.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 중심점
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(currentPosition.x, currentPosition.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // 위치 추적 시작
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      return;
    }

    setIsTracking(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    };

    const successCallback = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;

      setGpsCoords({ latitude, longitude });
      setAccuracy(accuracy);

      const imageCoords = gpsToImageCoords(latitude, longitude);
      setCurrentPosition(imageCoords);

      setError(null);
    };

    const errorCallback = (error: GeolocationPositionError) => {
      let errorMessage = "";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "위치 접근 권한이 거부되었습니다.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "위치 정보를 사용할 수 없습니다.";
          break;
        case error.TIMEOUT:
          errorMessage = "위치 요청이 시간 초과되었습니다.";
          break;
        default:
          errorMessage = "알 수 없는 오류가 발생했습니다.";
          break;
      }
      setError(errorMessage);
      setIsTracking(false);
    };

    // 현재 위치 가져오기
    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      options
    );

    // 위치 추적 시작
    watchIdRef.current = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      options
    );
  };

  // 위치 추적 중지
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  // 컴포넌트 언마운트 시 추적 중지
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 지도 다시 그리기
  useEffect(() => {
    drawMap();
  }, [currentPosition, accuracy]);

  const distanceToStation = gpsCoords
    ? calculateDistance(
        gpsCoords.latitude,
        gpsCoords.longitude,
        yatapStation.latitude,
        yatapStation.longitude
      )
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 헤더 */}
          <div className="bg-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-6 h-6" />
                <h1 className="text-xl font-bold">야탑역 위치 추적</h1>
              </div>
              <div className="flex space-x-2">
                {!isTracking ? (
                  <button
                    onClick={startTracking}
                    className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 px-3 py-1 rounded transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>추적 시작</span>
                  </button>
                ) : (
                  <button
                    onClick={stopTracking}
                    className="flex items-center space-x-1 bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>추적 중지</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 정보 패널 */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gpsCoords && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-1">현재 좌표</h3>
                  <p className="text-sm text-gray-600">
                    위도: {gpsCoords.latitude.toFixed(6)}
                    <br />
                    경도: {gpsCoords.longitude.toFixed(6)}
                  </p>
                </div>
              )}

              {distanceToStation && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-1">
                    야탑역까지 거리
                  </h3>
                  <p className="text-sm text-gray-600">
                    {distanceToStation < 1000
                      ? `${Math.round(distanceToStation)}m`
                      : `${(distanceToStation / 1000).toFixed(2)}km`}
                  </p>
                </div>
              )}

              {accuracy && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <h3 className="font-medium text-gray-700 mb-1">정확도</h3>
                  <p className="text-sm text-gray-600">
                    ±{Math.round(accuracy)}m
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 border-b">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* 지도 */}
          <div className="p-4">
            <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                width={mapWidth}
                height={mapHeight}
                className="w-full h-auto"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>

            {/* 범례 */}
            <div className="mt-4 flex flex-wrap items-center justify-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>야탑역</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span>현재 위치</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-200 rounded-full opacity-50"></div>
                <span>위치 정확도 범위</span>
              </div>
            </div>
          </div>

          {/* 사용법 안내 */}
          <div className="p-4 bg-gray-50 text-sm text-gray-600">
            <p className="mb-2">
              <strong>사용법:</strong>
            </p>
            <ul className="space-y-1 ml-4">
              <li>• "추적 시작" 버튼을 클릭하여 현재 위치를 확인하세요.</li>
              <li>• 파란색 점이 현재 위치, 빨간색 점이 야탑역입니다.</li>
              <li>• 위치 정확도에 따라 주변에 반투명 원이 표시됩니다.</li>
              <li>• 실시간으로 위치가 업데이트됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YatapLocationMap;
