/**
 * 16.16 Fixed Point Mathematics for Deterministic Physics
 * 16.16定点数数学运算，用于确定性物理引擎
 *
 * All operations use 32-bit signed integers where 16 bits are fractional.
 * This ensures deterministic results across platforms and environments.
 * 所有运算使用32位有符号整数，其中16位为小数部分。
 * 这确保了跨平台和环境的确定性结果。
 */

/**
 * Fixed point type (16.16 format)
 * 定点数类型（16.16格式）
 */
export type FX = number;

/**
 * Fixed point fractional bits (16)
 * 定点数小数位数（16）
 */
export const FP = 16;

/**
 * Fixed point ONE (1.0 in fixed point)
 * 定点数1.0
 */
export const ONE: FX = 1 << FP;

/**
 * Half value for rounding (0.5 in fixed point)
 * 用于舍入的半值（定点数0.5）
 */
export const HALF: FX = ONE >> 1;

/**
 * Maximum safe fixed point value
 * 最大安全定点数值
 */
export const MAX_FX: FX = 0x7fffffff;

/**
 * Minimum safe fixed point value
 * 最小安全定点数值
 */
export const MIN_FX: FX = -0x80000000;

/**
 * Convert float to fixed point
 * 浮点数转换为定点数
 */
export const f = (x: number): FX => (x * ONE) | 0;

/**
 * Convert fixed point to float
 * 定点数转换为浮点数
 */
export const toFloat = (x: FX): number => x / ONE;

/**
 * Fixed point addition
 * 定点数加法
 */
export const add = (a: FX, b: FX): FX => (a + b) | 0;

/**
 * Fixed point subtraction
 * 定点数减法
 */
export const sub = (a: FX, b: FX): FX => (a - b) | 0;

/**
 * Fixed point negation
 * 定点数取负
 */
export const neg = (x: FX): FX => (-x) | 0;

/**
 * Use BigInt for multiplication to avoid overflow (can be disabled for performance)
 * 使用BigInt进行乘法以避免溢出（可以为了性能而禁用）
 */
const USE_BIGINT = false;

/**
 * Fixed point multiplication
 * 定点数乘法
 */
export const mul = (a: FX, b: FX): FX => {
  if (USE_BIGINT) {
    const result = (BigInt(a) * BigInt(b)) >> BigInt(FP);
    return Number(result & BigInt(0xffffffff)) | 0;
  }
  // Fast path: be careful with large values to avoid overflow
  // 快速路径：注意大值以避免溢出
  return ((a * b) / ONE) | 0;
};

/**
 * Fixed point division
 * 定点数除法
 */
export const div = (a: FX, b: FX): FX => {
  if (USE_BIGINT) {
    const result = (BigInt(a) << BigInt(FP)) / BigInt(b || 1);
    return Number(result & BigInt(0xffffffff)) | 0;
  }
  return ((a * ONE) / (b || 1)) | 0;
};

/**
 * Fixed point modulo
 * 定点数取余
 */
export const mod = (a: FX, b: FX): FX => (a % (b || ONE)) | 0;

/**
 * Clamp value between min and max
 * 将值限制在最小值和最大值之间
 */
export const clamp = (x: FX, lo: FX, hi: FX): FX => x < lo ? lo : (x > hi ? hi : x);

/**
 * Absolute value
 * 绝对值
 */
export const abs = (x: FX): FX => (x ^ (x >> 31)) - (x >> 31);

/**
 * Minimum of two values
 * 两个值的最小值
 */
export const min = (a: FX, b: FX): FX => a < b ? a : b;

/**
 * Maximum of two values
 * 两个值的最大值
 */
export const max = (a: FX, b: FX): FX => a > b ? a : b;

/**
 * Sign of a value (-1, 0, or 1)
 * 值的符号（-1、0或1）
 */
export const sign = (x: FX): FX => x > 0 ? ONE : (x < 0 ? neg(ONE) : 0);

/**
 * Fixed point square root using Newton's method
 * 使用牛顿法的定点数平方根
 */
export const sqrt = (x: FX): FX => {
  if (x <= 0) return 0;

  // Initial guess
  // 初始猜测值
  let v = x;

  // Newton's iterations (6 iterations for good precision)
  // 牛顿迭代（6次迭代获得良好精度）
  for (let i = 0; i < 6; i++) {
    v = ((v + div(x, v)) >> 1) | 0;
  }

  return v;
};

/**
 * Linear interpolation: a + (b - a) * t
 * 线性插值：a + (b - a) * t
 */
export const lerp = (a: FX, b: FX, t: FX): FX => add(a, mul(sub(b, a), t));

/**
 * Multiply-add operation: a + b * c
 * 乘加运算：a + b * c
 */
export const madd = (a: FX, b: FX, c: FX): FX => add(a, mul(b, c));

/**
 * Multiply-subtract operation: a - b * c
 * 乘减运算：a - b * c
 */
export const msub = (a: FX, b: FX, c: FX): FX => sub(a, mul(b, c));

/**
 * Check if value is zero (with small epsilon tolerance)
 * 检查值是否为零（带小的容差）
 */
export const isZero = (x: FX, epsilon: FX = 1): boolean => abs(x) <= epsilon;

/**
 * Check if two values are equal (with small epsilon tolerance)
 * 检查两个值是否相等（带小的容差）
 */
export const isEqual = (a: FX, b: FX, epsilon: FX = 1): boolean => abs(sub(a, b)) <= epsilon;

/**
 * Convert integer to fixed point
 * 整数转换为定点数
 */
export const fromInt = (x: number): FX => (x << FP) | 0;

/**
 * Convert fixed point to integer (truncate)
 * 定点数转换为整数（截断）
 */
export const toInt = (x: FX): number => (x >> FP) | 0;

/**
 * Round fixed point to nearest integer
 * 定点数四舍五入到最近整数
 */
export const round = (x: FX): FX => ((x + HALF) >> FP) << FP;

/**
 * Floor fixed point value
 * 定点数向下取整
 */
export const floor = (x: FX): FX => (x >> FP) << FP;

/**
 * Ceiling fixed point value
 * 定点数向上取整
 */
export const ceil = (x: FX): FX => {
  const truncated = floor(x);
  return x > truncated ? add(truncated, ONE) : truncated;
};

/**
 * Common fixed point constants
 * 常用定点数常量
 */
export const ZERO: FX = 0;
export const TWO: FX = ONE << 1;
export const THREE: FX = ONE + TWO;
export const FOUR: FX = ONE << 2;
export const HALF_PI: FX = f(1.5707963267948966); // π/2
export const PI: FX = f(3.141592653589793);        // π
export const TWO_PI: FX = f(6.283185307179586);    // 2π
export const E: FX = f(2.718281828459045);         // e

/**
 * Vector and physics math utilities
 * 向量和物理数学工具函数
 */

/**
 * 2D vector dot product
 * 2D向量点积
 */
export const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Cross product: r × v (returns scalar for 2D)
 * 叉积：r × v（2D中返回标量）
 */
export const cross_r_v = (rx: FX, ry: FX, vx: FX, vy: FX): FX => sub(mul(rx, vy), mul(ry, vx));

/**
 * Cross product: w × r (returns vector for 2D)
 * 叉积：w × r（2D中返回向量）
 */
export const cross_w_r = (w: FX, rx: FX, ry: FX): readonly [FX, FX] => [sub(ZERO, mul(w, ry)), mul(w, rx)];

/**
 * Cross product: r × n (alias for cross_r_v, commonly used in physics)
 * 叉积：r × n（cross_r_v的别名，物理中常用）
 */
export const cross_r_n = (rx: FX, ry: FX, nx: FX, ny: FX): FX => cross_r_v(rx, ry, nx, ny);