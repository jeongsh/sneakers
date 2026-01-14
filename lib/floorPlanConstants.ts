// 도면 단위 설정 (floorplanner 기준: 905px = 19.94m)
export const FLOOR_PLAN_CONFIG = {
  // 단위 변환: 1px = 1.5cm
  PX_TO_CM: 1.0,
  PX_TO_M: 0.01,
  
  // 격자 크기 (px 단위)
  GRID_SIZE_SMALL: 10,   
  GRID_SIZE_BIG: 100,   
  
  // 드래그 스냅 크기
  DRAG_SIZE_OFFSET: 5,  
  
  // 최소 크기 (px 단위)
  MIN_WIDTH: 50,        
  MIN_HEIGHT: 50,       
};

// px를 cm로 변환
export const pxToCm = (px: number): number => {
  return px * FLOOR_PLAN_CONFIG.PX_TO_CM;
};

// px를 m로 변환
export const pxToM = (px: number): number => {
  return px * FLOOR_PLAN_CONFIG.PX_TO_M;
};

// cm를 px로 변환
export const cmToPx = (cm: number): number => {
  return cm / FLOOR_PLAN_CONFIG.PX_TO_CM;
};

// m를 px로 변환
export const mToPx = (m: number): number => {
  return m / FLOOR_PLAN_CONFIG.PX_TO_M;
};
