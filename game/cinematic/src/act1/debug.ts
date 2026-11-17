// Temporary development switches (edited between test renders; removed before the final commit).
export const DBG: {
  noSmoke?: boolean;
  noPlume?: boolean;
  noSparks?: boolean;
  exposure?: number;
  noBloom?: boolean;
  noDof?: boolean;
  orbitCam?: boolean;
  noAtmo?: boolean;
  cam?: { pos: [number, number, number]; look: [number, number, number]; fov: number };
} = {};
