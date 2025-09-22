/**
 * 16.16 Fixed Point Mathematics for Deterministic Physics
 * 16.16定点数数学运算，用于确定性物理引擎
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
 * TypedArray workspace for high-precision arithmetic
 * TypedArray工作空间用于高精度运算
 */
class FixedMathWorkspace {
  private static readonly POOL_SIZE = 4;
  private static pool: ArrayBuffer[] = [];
  private static poolIndex = 0;

  static getBuffer(): ArrayBuffer {
    if (this.pool.length < this.POOL_SIZE) {
      return new ArrayBuffer(16);
    }
    const buffer = this.pool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.POOL_SIZE;
    return buffer;
  }

  static returnBuffer(buffer: ArrayBuffer): void {
    if (this.pool.length < this.POOL_SIZE) {
      this.pool.push(buffer);
    }
  }
}

/**
 * 64-bit multiplication using 32-bit operations
 * 使用32位运算的64位乘法
 */
const mul64_32x32 = (a: number, b: number): readonly [number, number] => {
  // Split into 16-bit parts
  // 拆分为16位部分
  const a_low = a & 0xffff;
  const a_high = (a >>> 16) & 0xffff;
  const b_low = b & 0xffff;
  const b_high = (b >>> 16) & 0xffff;


  // Four 16x16 multiplications
  // 四个16x16乘法
  const p0 = a_low * b_low;          // contributes to bits 0-31
  const p1 = a_low * b_high;         // contributes to bits 16-47
  const p2 = a_high * b_low;         // contributes to bits 16-47
  const p3 = a_high * b_high;        // contributes to bits 32-63


  // Combine into 64-bit result without intermediate overflow
  // 组合成64位结果，避免中间溢出
  const middle = p1 + p2;
  const middle_low = middle & 0xffff;
  const middle_high = middle >>> 16;

  // Calculate low 32 bits: p0 + (middle_low << 16)
  // Use floating point to avoid 32-bit integer overflow
  // 计算低32位：p0 + (middle_low << 16)
  // 使用浮点数避免32位整数溢出
  const low_sum = p0 + middle_low * 0x10000;
  const low32 = (low_sum >>> 0);

  // Calculate carry from low part
  // 计算低位进位
  const carry = Math.floor(low_sum / 0x100000000);

  // Calculate high 32 bits
  // 计算高32位
  const high32 = (p3 + middle_high + carry) >>> 0;


  return [low32, high32] as const;
};

/**
 * Saturating arithmetic mode flag for debugging/safety
 * 饱和运算模式标志，用于调试/安全
 */
export let SATURATING_MODE = false;

/**
 * Enable or disable saturating arithmetic mode
 * 启用或禁用饱和运算模式
 */
export const setSaturatingMode = (enabled: boolean): void => {
  SATURATING_MODE = enabled;
};

/**
 * Saturating addition with overflow detection
 * 带溢出检测的饱和加法
 */
export const addSat = (a: FX, b: FX): FX => {
  const buffer = FixedMathWorkspace.getBuffer();
  const i32View = new Int32Array(buffer);

  try {
    i32View[0] = a;
    i32View[1] = b;

    // Precise overflow detection
    const sum = i32View[0] + i32View[1];
    i32View[2] = sum;

    // Check overflow: same signs but result differs
    if (((a ^ b) & 0x80000000) === 0) {
      if (((a ^ i32View[2]) & 0x80000000) !== 0) {
        return a >= 0 ? MAX_FX : MIN_FX;
      }
    }

    return i32View[2];
  } finally {
    FixedMathWorkspace.returnBuffer(buffer);
  }
};

/**
 * Saturating subtraction with overflow detection
 * 带溢出检测的饱和减法
 */
export const subSat = (a: FX, b: FX): FX => {
  const buffer = FixedMathWorkspace.getBuffer();
  const i32View = new Int32Array(buffer);

  try {
    i32View[0] = a;
    i32View[1] = b;

    // Precise overflow detection
    const diff = i32View[0] - i32View[1];
    i32View[2] = diff;

    // Check overflow: different signs but result differs from a
    if (((a ^ b) & 0x80000000) !== 0) {
      if (((a ^ i32View[2]) & 0x80000000) !== 0) {
        return a >= 0 ? MAX_FX : MIN_FX;
      }
    }

    return i32View[2];
  } finally {
    FixedMathWorkspace.returnBuffer(buffer);
  }
};

/**
 * Fixed point addition (wrap or saturate based on SATURATING_MODE)
 * 定点数加法（根据SATURATING_MODE选择wrap或饱和）
 */
export const add = (a: FX, b: FX): FX => SATURATING_MODE ? addSat(a, b) : ((a + b) | 0);

/**
 * Fixed point subtraction (wrap or saturate based on SATURATING_MODE)
 * 定点数减法（根据SATURATING_MODE选择wrap或饱和）
 */
export const sub = (a: FX, b: FX): FX => SATURATING_MODE ? subSat(a, b) : ((a - b) | 0);

/**
 * Fixed point negation
 * 定点数取负
 */
export const neg = (x: FX): FX => (-x) | 0;


/**
 * High-precision multiplication with overflow detection
 * 高精度乘法和溢出检测
 */
const mulCore = (a: FX, b: FX): [FX, boolean] => {
  const negative = (a ^ b) < 0;
  const ua = Math.abs(a) >>> 0;
  const ub = Math.abs(b) >>> 0;

  // Use 64-bit simulation for precise multiplication
  // 使用64位模拟进行精确乘法
  const [low32, high32] = mul64_32x32(ua, ub);


  // For 16.16 format, we need to right shift the 64-bit result by 16 bits
  // 对于16.16格式，需要将64位结果右移16位
  const buffer = FixedMathWorkspace.getBuffer();
  const u32View = new Uint32Array(buffer);

  try {
    u32View[0] = low32;
    u32View[1] = high32;

    // Extract bits 16-47 from the 64-bit result
    // 从64位结果中提取第16-47位
    const result = (low32 >>> 16) | ((high32 & 0xffff) << 16);

    // Apply sign
    // 应用符号
    const finalResult = negative ? (-(result >>> 0) | 0) : (result | 0);

    // Check for overflow: result outside valid range
    // 检查溢出：结果超出有效范围
    const overflow = finalResult > MAX_FX || finalResult < MIN_FX || high32 !== 0;

    return [finalResult, overflow];
  } finally {
    FixedMathWorkspace.returnBuffer(buffer);
  }
};

export const mul = (a: FX, b: FX): FX => {
  // Fast path for small values to avoid workspace overhead
  // 小值快速路径避免工作空间开销
  const absA = a < 0 ? -a : a;
  const absB = b < 0 ? -b : b;
  if (absA <= 0x1fff && absB <= 0x1fff) {
    return ((a * b) / ONE) | 0;
  }

  const [result, overflow] = mulCore(a, b);

  if (SATURATING_MODE && overflow) {
    // Determine saturation direction based on sign
    // 根据符号确定饱和方向
    return ((a ^ b) < 0) ? MIN_FX : MAX_FX;
  }

  return result;
};

export const mulSat = (a: FX, b: FX): FX => {
  // Fast path for small values
  // 小值快速路径
  const absA = a < 0 ? -a : a;
  const absB = b < 0 ? -b : b;
  if (absA <= 0x1fff && absB <= 0x1fff) {
    return ((a * b) / ONE) | 0;
  }

  const [result, overflow] = mulCore(a, b);

  // Always saturate for explicit saturating function
  // 显式饱和函数总是进行饱和处理
  if (overflow) {
    return ((a ^ b) < 0) ? MIN_FX : MAX_FX;
  }
  return result;
};

/**
 * Fixed point division with zero handling and saturation
 * 带零处理和饱和的定点数除法
 */
export const div = (a: FX, b: FX): FX => {
  // Handle division by zero 处理除零
  if (b === 0) return a >= 0 ? MAX_FX : MIN_FX;

  // Perform (a << FP) / b using multiplication 使用乘法执行(a << FP) / b
  const num = a * ONE;
  const divRes = (num / b) | 0;

  // Saturation check to prevent overflow 饱和检查防止溢出
  if (divRes > MAX_FX) return MAX_FX;
  if (divRes < MIN_FX) return MIN_FX;

  return divRes;
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

  // Initial guess (ensure non-zero to prevent division by zero)
  // 初始猜测值（确保非零以防除零）
  let v = x;

  // Newton's iterations (6 iterations for good precision)
  // 牛顿迭代（6次迭代获得良好精度）
  for (let i = 0; i < 6; i++) {
    if (v === 0) v = 1; // Safeguard against zero 防止变为零
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
 * Saturating multiply-add operation: a + b * c
 * 饱和乘加运算：a + b * c
 */
export const maddSat = (a: FX, b: FX, c: FX): FX => addSat(a, mulSat(b, c));

/**
 * Saturating multiply-subtract operation: a - b * c
 * 饱和乘减运算：a - b * c
 */
export const msubSat = (a: FX, b: FX, c: FX): FX => subSat(a, mulSat(b, c));

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

/**
 * Trigonometric functions for rotation handling
 * 旋转处理的三角函数
 */

/**
 * Convert 16-bit angle to cos/sin pair using lookup table approach
 * Body2D.angle is stored as 16-bit value where 0..65535 maps to 0..2π
 * 使用查找表方法将16位角度转换为cos/sin对
 * Body2D.angle存储为16位值，其中0..65535映射到0..2π
 */
export const angleToCosSin = (angle16: number): readonly [FX, FX] => {
  // Convert 16-bit angle to radians: angle16 * 2π / 65536
  // For performance, we use Math.cos/sin and convert to fixed point
  // In production, this could use a lookup table for full determinism
  // 将16位角度转换为弧度：angle16 * 2π / 65536
  // 为了性能，我们使用Math.cos/sin并转换为定点数
  // 在生产中，这可以使用查找表实现完全确定性
  const radians = (angle16 & 0xffff) * (2 * Math.PI) / 65536;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return [f(cos), f(sin)];
};

/**
 * Get cos/sin from float angle (in radians)
 * 从浮点角度（弧度）获取cos/sin
 */
export const radianToCosSin = (radian: number): readonly [FX, FX] => {
  return [f(Math.cos(radian)), f(Math.sin(radian))];
};

/**
 * Fast rotation of 2D vector by cos/sin
 * 使用cos/sin快速旋转2D向量
 */
export const rotateVector = (x: FX, y: FX, cos: FX, sin: FX): readonly [FX, FX] => {
  return [
    sub(mul(x, cos), mul(y, sin)),
    add(mul(x, sin), mul(y, cos))
  ];
};