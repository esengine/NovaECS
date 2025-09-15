/**
 * Tag bit set manager using Uint32Array for multi-word bit operations
 * 基于Uint32Array的多词位集标签管理器
 */

const BITS_PER_WORD = 32;
const INITIAL_WORDS = 4; // 支持128个标签

/**
 * Multi-word bit set for tag filtering
 * 多词位集用于标签过滤
 */
export class TagBitSet {
  private words: Uint32Array;

  constructor(words = INITIAL_WORDS) {
    this.words = new Uint32Array(words);
  }

  /**
   * Set bit at position
   * 设置指定位置的位
   */
  setBit(bitIndex: number): void {
    const wordIndex = Math.floor(bitIndex / BITS_PER_WORD);
    const bitPos = bitIndex % BITS_PER_WORD;

    // 扩展数组如果需要
    if (wordIndex >= this.words.length) {
      this.expandTo(wordIndex + 1);
    }

    this.words[wordIndex] |= (1 << bitPos);
  }

  /**
   * Clear bit at position
   * 清除指定位置的位
   */
  clearBit(bitIndex: number): void {
    const wordIndex = Math.floor(bitIndex / BITS_PER_WORD);
    const bitPos = bitIndex % BITS_PER_WORD;

    if (wordIndex < this.words.length) {
      this.words[wordIndex] &= ~(1 << bitPos);
    }
  }

  /**
   * Test if bit is set
   * 测试位是否被设置
   */
  hasBit(bitIndex: number): boolean {
    const wordIndex = Math.floor(bitIndex / BITS_PER_WORD);
    const bitPos = bitIndex % BITS_PER_WORD;

    if (wordIndex >= this.words.length) {
      return false;
    }

    return (this.words[wordIndex] & (1 << bitPos)) !== 0;
  }

  /**
   * Check if this bitset contains all bits from required mask
   * 检查是否包含所有必需的位
   */
  containsAll(required: TagBitSet): boolean {
    const minLen = Math.min(this.words.length, required.words.length);

    for (let i = 0; i < minLen; i++) {
      if ((this.words[i] & required.words[i]) !== required.words[i]) {
        return false;
      }
    }

    // 检查required中超出this长度的部分是否为0
    for (let i = minLen; i < required.words.length; i++) {
      if (required.words[i] !== 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if this bitset has any bits from forbidden mask
   * 检查是否包含任何被禁止的位
   */
  hasAny(forbidden: TagBitSet): boolean {
    const minLen = Math.min(this.words.length, forbidden.words.length);

    for (let i = 0; i < minLen; i++) {
      if ((this.words[i] & forbidden.words[i]) !== 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a copy of this bitset
   * 创建位集的副本
   */
  clone(): TagBitSet {
    const clone = new TagBitSet(this.words.length);
    clone.words.set(this.words);
    return clone;
  }

  /**
   * Clear all bits
   * 清除所有位
   */
  clear(): void {
    this.words.fill(0);
  }

  /**
   * Get raw words array (for direct access)
   * 获取原始词数组（用于直接访问）
   */
  getWords(): Uint32Array {
    return this.words;
  }

  /**
   * Expand to at least the specified word count
   * 扩展到至少指定的词数量
   */
  private expandTo(minWords: number): void {
    if (minWords <= this.words.length) {
      return;
    }

    const newWords = new Uint32Array(Math.max(minWords, this.words.length * 2));
    newWords.set(this.words);
    this.words = newWords;
  }
}

/**
 * Tag mask manager for string->bit mapping
 * 标签掩码管理器用于字符串->位映射
 */
export class TagMaskManager {
  private tagToBit = new Map<string, number>();
  private bitToTag = new Map<number, string>();
  private nextBitIndex = 0;

  /**
   * Get or assign bit index for tag name
   * 获取或分配标签名称的位索引
   */
  getBitIndex(tagName: string): number {
    let bitIndex = this.tagToBit.get(tagName);
    if (bitIndex === undefined) {
      bitIndex = this.nextBitIndex++;
      this.tagToBit.set(tagName, bitIndex);
      this.bitToTag.set(bitIndex, tagName);
    }
    return bitIndex;
  }

  /**
   * Create mask for multiple tag names
   * 为多个标签名称创建掩码
   */
  createMask(tagNames: string[]): TagBitSet {
    const mask = new TagBitSet();
    for (const tagName of tagNames) {
      const bitIndex = this.getBitIndex(tagName);
      mask.setBit(bitIndex);
    }
    return mask;
  }

  /**
   * Get tag name by bit index
   * 通过位索引获取标签名称
   */
  getTagName(bitIndex: number): string | undefined {
    return this.bitToTag.get(bitIndex);
  }

  /**
   * Get all registered tags
   * 获取所有注册的标签
   */
  getAllTags(): string[] {
    return Array.from(this.tagToBit.keys());
  }

  /**
   * Reset all mappings (for testing)
   * 重置所有映射（用于测试）
   */
  reset(): void {
    this.tagToBit.clear();
    this.bitToTag.clear();
    this.nextBitIndex = 0;
  }
}