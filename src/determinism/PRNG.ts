/**
 * Deterministic Pseudo-Random Number Generator
 * 确定性伪随机数生成器
 */

export class PRNG {
  private s: number;

  constructor(seed = 0x2F6E2B1) {
    this.s = seed >>> 0;
  }

  /**
   * Set the seed for random number generation
   * 设置随机数生成种子
   */
  seed(x: number): void {
    this.s = x >>> 0;
  }

  /**
   * Generate next 32-bit unsigned integer
   * 生成下一个32位无符号整数
   */
  nextU32(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }

  /**
   * Generate next float in range [0,1)
   * 生成范围[0,1)内的浮点数
   */
  nextFloat(): number {
    return (this.nextU32() >>> 8) / 0x01000000;
  }

  /**
   * Generate random integer in range [min, max]
   * 生成范围[min, max]内的随机整数
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   * 生成随机布尔值
   */
  nextBool(): boolean {
    return this.nextFloat() < 0.5;
  }

  /**
   * Choose random element from array
   * 从数组中随机选择元素
   */
  nextChoice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const index = Math.floor(this.nextFloat() * array.length);
    return array[index];
  }

  /**
   * Shuffle array and return new shuffled array
   * 打乱数组并返回新的打乱后的数组
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get current internal state
   * 获取当前内部状态
   */
  getState(): number {
    return this.s;
  }

  /**
   * Set internal state for deterministic reproduction
   * 设置内部状态以确定性重现
   */
  setState(state: number): void {
    this.s = state >>> 0;
  }
}