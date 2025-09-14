/**
 * Bitset for component signatures supporting 1024+ types
 * 支持1024+类型的组件签名位集
 */

export class Bitset {
  words: Uint32Array;

  constructor(wordsOrSize: number | Uint32Array = 1) {
    this.words = typeof wordsOrSize === 'number'
      ? new Uint32Array(wordsOrSize || 1) // wordsOrSize is number of words, not bits
      : wordsOrSize;
  }

  /**
   * Ensure capacity for given number of types
   * 确保给定类型数量的容量
   */
  ensureBits(nTypes: number): void {
    const need = Math.ceil(nTypes / 32);
    if (need <= this.words.length) return;
    const w = new Uint32Array(need);
    w.set(this.words);
    this.words = w;
  }

  /**
   * Set bit for given component type ID
   * 为给定组件类型ID设置位
   */
  set(id: number): void {
    const i = id >>> 5; // divide by 32
    const b = id & 31;  // modulo 32
    this.ensureBits((i + 1) * 32);
    this.words[i] |= (1 << b);
  }

  /**
   * Clear bit for given component type ID
   * 清除给定组件类型ID的位
   */
  clear(id: number): void {
    const i = id >>> 5;
    const b = id & 31;
    if (i < this.words.length) {
      this.words[i] &= ~(1 << b);
    }
  }

  /**
   * Check if bit is set for given component type ID
   * 检查给定组件类型ID的位是否设置
   */
  has(id: number): boolean {
    const i = id >>> 5;
    const b = id & 31;
    return i < this.words.length && !!(this.words[i] & (1 << b));
  }

  /**
   * Check if this bitset contains all bits from mask (this ⊇ mask)
   * 检查此位集是否包含掩码中的所有位
   */
  containsAll(mask: Bitset): boolean {
    const a = this.words;
    const b = mask.words;
    const n = b.length;

    for (let i = 0; i < n; i++) {
      if (((a[i] ?? 0) & b[i]) !== b[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if this bitset intersects with mask
   * 检查此位集是否与掩码相交
   */
  intersects(mask: Bitset): boolean {
    const n = Math.min(this.words.length, mask.words.length);
    for (let i = 0; i < n; i++) {
      if ((this.words[i] & mask.words[i]) !== 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate string key for archetype identification
   * 生成原型识别的字符串键
   */
  key(): string {
    return Array.from(this.words).join(',');
  }

  /**
   * Create copy of this bitset
   * 创建此位集的副本
   */
  clone(): Bitset {
    return new Bitset(new Uint32Array(this.words));
  }

  /**
   * Clear all bits
   * 清除所有位
   */
  clearAll(): void {
    this.words.fill(0);
  }

  /**
   * Get count of set bits
   * 获取设置位的数量
   */
  popCount(): number {
    let count = 0;
    for (const word of this.words) {
      count += this.popCountWord(word);
    }
    return count;
  }

  private popCountWord(word: number): number {
    // Brian Kernighan's algorithm
    let count = 0;
    while (word) {
      word &= word - 1;
      count++;
    }
    return count;
  }

  /**
   * Check if bitset is empty (no bits set)
   * 检查位集是否为空（没有位设置）
   */
  isEmpty(): boolean {
    for (const word of this.words) {
      if (word !== 0) return false;
    }
    return true;
  }

  /**
   * Get all set bit indices
   * 获取所有设置位的索引
   */
  getSetBits(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.words.length; i++) {
      let word = this.words[i];
      let bit = 0;
      while (word !== 0) {
        if (word & 1) {
          result.push(i * 32 + bit);
        }
        word >>>= 1;
        bit++;
      }
    }
    return result;
  }
}