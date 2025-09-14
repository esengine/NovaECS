/**
 * Minimal 3x3 matrix math utilities for 2D transforms
 * 用于2D变换的极简3x3矩阵数学工具
 */

/**
 * Multiply two 3x3 matrices
 * 相乘两个3x3矩阵
 * @param a First matrix 第一个矩阵
 * @param b Second matrix 第二个矩阵
 * @returns Result matrix 结果矩阵
 */
export function mul(a: number[], b: number[]): number[] {
  return [
    a[0]*b[0]+a[1]*b[3]+a[2]*b[6],  a[0]*b[1]+a[1]*b[4]+a[2]*b[7],  a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
    a[3]*b[0]+a[4]*b[3]+a[5]*b[6],  a[3]*b[1]+a[4]*b[4]+a[5]*b[7],  a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
    a[6]*b[0]+a[7]*b[3]+a[8]*b[6],  a[6]*b[1]+a[7]*b[4]+a[8]*b[7],  a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
  ];
}

/**
 * Create transformation matrix from local transform parameters
 * 从本地变换参数创建变换矩阵
 * @param x Translation X 平移X
 * @param y Translation Y 平移Y
 * @param rot Rotation in radians 旋转（弧度）
 * @param sx Scale X 缩放X
 * @param sy Scale Y 缩放Y
 * @returns 3x3 transformation matrix 3x3变换矩阵
 */
export function fromLocal(x: number, y: number, rot: number, sx: number, sy: number): number[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [
    c * sx, -s * sy, x,
    s * sx,  c * sy, y,
         0,       0, 1
  ];
}

/**
 * Create identity matrix
 * 创建单位矩阵
 */
export function identity(): number[] {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/**
 * Transform a 2D point by a matrix
 * 用矩阵变换2D点
 */
export function transformPoint(matrix: number[], x: number, y: number): [number, number] {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2],
    matrix[3] * x + matrix[4] * y + matrix[5]
  ];
}