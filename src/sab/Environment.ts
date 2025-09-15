/**
 * SharedArrayBuffer environment detection and utilities
 * SharedArrayBuffer环境检测和工具函数
 */

/**
 * Check if SharedArrayBuffer is available in current environment
 * 检查当前环境是否支持SharedArrayBuffer
 */
export function isSharedArrayBufferAvailable(): boolean {
  // Check if SharedArrayBuffer exists
  // 检查SharedArrayBuffer是否存在
  if (typeof SharedArrayBuffer === 'undefined') {
    return false;
  }

  // Check if we can actually create one (COOP/COEP headers required in browsers)
  // 检查是否能实际创建（浏览器需要COOP/COEP头）
  try {
    new SharedArrayBuffer(8);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Worker global scope type
 * Worker全局作用域类型
 */
interface WorkerGlobalScope {
  importScripts: (...urls: string[]) => void;
  self: WorkerGlobalScope;
}

/**
 * Check if we're running in a worker context
 * 检查是否在Worker上下文中运行
 */
export function isWorkerContext(): boolean {
  try {
    return typeof self !== 'undefined' && 
           'importScripts' in self && 
           typeof (self as unknown as WorkerGlobalScope).importScripts === 'function' && 
           typeof window === 'undefined';
  } catch {
    return false;
  }
}

/**
 * Check if we're running in main thread
 * 检查是否在主线程中运行
 */
export function isMainThread(): boolean {
  return typeof window !== 'undefined' || 
         (typeof global !== 'undefined' && typeof process !== 'undefined');
}

/**
 * Global flag for SAB availability (cached)
 * SAB可用性的全局标志（缓存）
 */
let _sabAvailable: boolean | null = null;

/**
 * Get cached SAB availability status
 * 获取缓存的SAB可用性状态
 */
export function getSABAvailability(): boolean {
  if (_sabAvailable === null) {
    _sabAvailable = isSharedArrayBufferAvailable();
  }
  return _sabAvailable;
}

/**
 * Force refresh SAB availability check (for testing)
 * 强制刷新SAB可用性检查（用于测试）
 */
export function refreshSABAvailability(): boolean {
  _sabAvailable = isSharedArrayBufferAvailable();
  return _sabAvailable;
}

/**
 * Log environment information for debugging
 * 记录环境信息用于调试
 */
export function logEnvironmentInfo(): void {
  console.log('[NovaECS] Environment Info:', {
    sabAvailable: getSABAvailability(),
    isWorker: isWorkerContext(),
    isMainThread: isMainThread(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
  });
}

/**
 * Requirements for SAB usage in browsers
 * 浏览器中使用SAB的要求
 */
export const SAB_REQUIREMENTS = {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  },
  note: 'These headers are required for SharedArrayBuffer in browsers. Without them, the system will fall back to regular Array storage.'
};