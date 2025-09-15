/**
 * Environment detection tests
 * 环境检测测试
 */

import { 
  isSharedArrayBufferAvailable, 
  isWorkerContext, 
  isMainThread, 
  getSABAvailability 
} from '../src/sab/Environment';

describe('Environment', () => {
  test('应该检测SharedArrayBuffer可用性', () => {
    // Function should not throw
    // 函数不应该抛出异常
    expect(() => isSharedArrayBufferAvailable()).not.toThrow();
    
    const result = isSharedArrayBufferAvailable();
    expect(typeof result).toBe('boolean');
  });
  
  test('应该检测Worker上下文', () => {
    // Function should not throw
    // 函数不应该抛出异常
    expect(() => isWorkerContext()).not.toThrow();
    
    const result = isWorkerContext();
    expect(typeof result).toBe('boolean');
    
    // In test environment, should return false
    // 在测试环境中应该返回false
    expect(result).toBe(false);
  });
  
  test('应该检测主线程', () => {
    const result = isMainThread();
    expect(typeof result).toBe('boolean');
    
    // In test environment, should return true
    // 在测试环境中应该返回true
    expect(result).toBe(true);
  });
  
  test('应该获取SAB可用性状态', () => {
    const result = getSABAvailability();
    expect(typeof result).toBe('boolean');
  });
});