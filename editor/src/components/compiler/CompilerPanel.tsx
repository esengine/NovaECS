/**
 * Compiler panel for visual graph to TypeScript compilation
 * 可视化图到TypeScript编译的编译器面板
 *
 * Provides a user interface for configuring compilation options, previewing
 * generated TypeScript code, and managing the compilation process. Integrates
 * with the CodeGenerator to provide real-time feedback.
 * 提供用于配置编译选项、预览生成的TypeScript代码和管理编译过程的用户界面。
 * 与CodeGenerator集成以提供实时反馈。
 */

import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { CodeGenerator, type CodeGenerationOptions, type GeneratedCode } from '../../compiler/CodeGenerator';
import type { VisualGraph } from '../../../../src/visual/core/VisualGraph';

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  color: #cccccc;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const PanelHeader = styled.div`
  padding: 12px 16px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
`;

const CompileButton = styled.button<{ disabled?: boolean }>`
  background-color: ${props => props.disabled ? '#404040' : '#007acc'};
  color: ${props => props.disabled ? '#888888' : '#ffffff'};
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.disabled ? '#404040' : '#1e7eb8'};
  }
`;

const PanelContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ConfigSection = styled.div`
  padding: 16px;
  border-bottom: 1px solid #3e3e42;
`;

const ConfigGroup = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ConfigLabel = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 6px;
`;

const ConfigInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  background-color: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #cccccc;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;

  &:focus {
    outline: none;
    border-color: #007acc;
  }
`;

const ConfigSelect = styled.select`
  width: 100%;
  padding: 6px 8px;
  background-color: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #cccccc;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #007acc;
  }

  option {
    background-color: #3c3c3c;
    color: #cccccc;
  }
`;

const ConfigCheckbox = styled.input`
  margin-right: 8px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #cccccc;
  cursor: pointer;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const CodeSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CodeHeader = styled.div`
  padding: 8px 16px;
  background-color: #252526;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CodeTitle = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #ffffff;
`;

const CopyButton = styled.button`
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 3px;

  &:hover {
    background-color: #3e3e42;
    color: #ffffff;
  }
`;

const CodePreview = styled.pre`
  flex: 1;
  margin: 0;
  padding: 16px;
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow: auto;
  white-space: pre-wrap;
`;

const MetricsSection = styled.div`
  padding: 12px 16px;
  background-color: #252526;
  border-top: 1px solid #3e3e42;
  font-size: 11px;
  color: #888888;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
`;

const MetricLabel = styled.div`
  font-size: 10px;
  color: #888888;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: #5a1d1d;
  border: 1px solid #be1100;
  color: #f85149;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 4px;
  margin: 16px;
`;

const StatusIndicator = styled.div<{ status: 'idle' | 'compiling' | 'success' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.status) {
      case 'idle': return '#888888';
      case 'compiling': return '#ffa500';
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      default: return '#888888';
    }
  }};
  margin-right: 8px;
`;

interface CompilerPanelProps {
  /** Visual graph to compile 要编译的可视化图 */
  graph: VisualGraph | null;
  /** Callback when compilation completes 编译完成时的回调 */
  onCompilationComplete?: (result: GeneratedCode) => void;
  /** Whether panel is visible 面板是否可见 */
  visible?: boolean;
}

/**
 * Compiler panel component
 * 编译器面板组件
 */
export function CompilerPanel({
  graph,
  onCompilationComplete,
  visible = true
}: CompilerPanelProps) {
  // State for compilation options 编译选项状态
  const [options, setOptions] = useState<CodeGenerationOptions>({
    systemName: 'GeneratedSystem',
    stage: 'update',
    dependencies: [],
    optimize: true,
    includeDebugInfo: false,
    formatting: {
      indentSize: 2,
      useTabs: false,
      lineEnding: 'lf'
    }
  });

  // State for compilation results 编译结果状态
  const [compilationResult, setCompilationResult] = useState<GeneratedCode | null>(null);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const [compilationStatus, setCompilationStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');

  // Code generator instance 代码生成器实例
  const [codeGenerator] = useState(() => new CodeGenerator());

  /**
   * Handle compilation process
   * 处理编译过程
   */
  const handleCompile = useCallback(async () => {
    if (!graph) {
      setCompilationError('No graph available for compilation 没有可用于编译的图');
      setCompilationStatus('error');
      return;
    }

    setCompilationStatus('compiling');
    setCompilationError(null);

    try {
      const result = await codeGenerator.generateCode(graph, options);
      setCompilationResult(result);
      setCompilationStatus('success');
      onCompilationComplete?.(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCompilationError(errorMessage);
      setCompilationStatus('error');
      setCompilationResult(null);
    }
  }, [graph, options, codeGenerator, onCompilationComplete]);

  /**
   * Handle automatic compilation on graph changes
   * 处理图变化时的自动编译
   */
  useEffect(() => {
    if (graph && options.systemName) {
      // Auto-compile with a debounce 带防抖的自动编译
      const timer = setTimeout(() => {
        handleCompile();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [graph, handleCompile]);

  /**
   * Handle copying code to clipboard
   * 处理复制代码到剪贴板
   */
  const handleCopyCode = useCallback(async () => {
    if (compilationResult?.code) {
      try {
        await navigator.clipboard.writeText(compilationResult.code);
      } catch (error) {
        console.error('Failed to copy code to clipboard:', error);
      }
    }
  }, [compilationResult]);

  /**
   * Handle option changes
   * 处理选项变化
   */
  const handleOptionChange = useCallback((key: keyof CodeGenerationOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  /**
   * Handle formatting option changes
   * 处理格式化选项变化
   */
  const handleFormattingChange = useCallback((key: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      formatting: {
        ...prev.formatting,
        [key]: value
      }
    }));
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <PanelContainer>
      <PanelHeader>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusIndicator status={compilationStatus} />
          <PanelTitle>TypeScript Compiler</PanelTitle>
        </div>
        <CompileButton
          onClick={handleCompile}
          disabled={!graph || compilationStatus === 'compiling'}
        >
          {compilationStatus === 'compiling' ? 'Compiling...' : 'Compile'}
        </CompileButton>
      </PanelHeader>

      <PanelContent>
        <ConfigSection>
          <ConfigGroup>
            <ConfigLabel>System Name 系统名称</ConfigLabel>
            <ConfigInput
              value={options.systemName}
              onChange={(e) => handleOptionChange('systemName', e.target.value)}
              placeholder="Enter system name..."
            />
          </ConfigGroup>

          <ConfigGroup>
            <ConfigLabel>Execution Stage 执行阶段</ConfigLabel>
            <ConfigSelect
              value={options.stage || 'update'}
              onChange={(e) => handleOptionChange('stage', e.target.value)}
            >
              <option value="startup">Startup</option>
              <option value="preUpdate">Pre Update</option>
              <option value="update">Update</option>
              <option value="postUpdate">Post Update</option>
              <option value="cleanup">Cleanup</option>
            </ConfigSelect>
          </ConfigGroup>

          <ConfigGroup>
            <ConfigLabel>Options 选项</ConfigLabel>
            <CheckboxLabel>
              <ConfigCheckbox
                type="checkbox"
                checked={options.optimize !== false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOptionChange('optimize', e.target.checked)}
              />
              Enable optimizations 启用优化
            </CheckboxLabel>
            <CheckboxLabel>
              <ConfigCheckbox
                type="checkbox"
                checked={options.includeDebugInfo === true}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOptionChange('includeDebugInfo', e.target.checked)}
              />
              Include debug information 包含调试信息
            </CheckboxLabel>
          </ConfigGroup>

          <ConfigGroup>
            <ConfigLabel>Formatting 格式化</ConfigLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <ConfigLabel style={{ fontSize: '11px', marginBottom: '4px' }}>Indent Size 缩进大小</ConfigLabel>
                <ConfigInput
                  type="number"
                  min="1"
                  max="8"
                  value={options.formatting?.indentSize || 2}
                  onChange={(e) => handleFormattingChange('indentSize', parseInt(e.target.value))}
                />
              </div>
              <div>
                <ConfigLabel style={{ fontSize: '11px', marginBottom: '4px' }}>Line Ending 行结尾</ConfigLabel>
                <ConfigSelect
                  value={options.formatting?.lineEnding || 'lf'}
                  onChange={(e) => handleFormattingChange('lineEnding', e.target.value)}
                >
                  <option value="lf">LF</option>
                  <option value="crlf">CRLF</option>
                </ConfigSelect>
              </div>
            </div>
            <CheckboxLabel>
              <ConfigCheckbox
                type="checkbox"
                checked={options.formatting?.useTabs === true}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormattingChange('useTabs', e.target.checked)}
              />
              Use tabs for indentation 使用制表符缩进
            </CheckboxLabel>
          </ConfigGroup>
        </ConfigSection>

        {compilationError && (
          <ErrorMessage>
            <strong>Compilation Error 编译错误:</strong><br />
            {compilationError}
          </ErrorMessage>
        )}

        {compilationResult && (
          <CodeSection>
            <CodeHeader>
              <CodeTitle>Generated TypeScript Code</CodeTitle>
              <CopyButton onClick={handleCopyCode}>
                Copy 复制
              </CopyButton>
            </CodeHeader>
            <CodePreview>{compilationResult.code}</CodePreview>
          </CodeSection>
        )}

        {compilationResult && (
          <MetricsSection>
            <MetricsGrid>
              <MetricItem>
                <MetricValue>{compilationResult.metrics.nodeCount}</MetricValue>
                <MetricLabel>Nodes 节点</MetricLabel>
              </MetricItem>
              <MetricItem>
                <MetricValue>{compilationResult.metrics.connectionCount}</MetricValue>
                <MetricLabel>Connections 连接</MetricLabel>
              </MetricItem>
              <MetricItem>
                <MetricValue>{compilationResult.metrics.optimizationsApplied.length}</MetricValue>
                <MetricLabel>Optimizations 优化</MetricLabel>
              </MetricItem>
            </MetricsGrid>
          </MetricsSection>
        )}
      </PanelContent>
    </PanelContainer>
  );
}