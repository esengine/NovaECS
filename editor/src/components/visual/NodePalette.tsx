import { useState, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { getAllVisualClasses, type VisualMethodMetadata } from '@esengine/nova-ecs';
import { Trash2, Settings, X, Plus, Search, Package, Upload, CheckCircle, RotateCcw, Hash, X as XCircle } from '../../utils/icons';

const PaletteContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #252526;
`;

const PaletteHeader = styled.div`
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  padding: 8px 12px;
`;

const HeaderTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SearchBox = styled.input`
  width: 100%;
  padding: 6px 8px;
  margin: 8px 0;
  background-color: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #007acc;
  }

  &::placeholder {
    color: #6c6c6c;
  }
`;

const CategoryList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const CategoryGroup = styled.div`
  margin-bottom: 16px;
`;

const CategoryHeader = styled.div<{ expanded: boolean }>`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin-bottom: 4px;

  &:hover {
    background-color: #2a2a2a;
  }
`;

const CategoryIcon = styled.span`
  margin-right: 8px;
  font-size: 10px;
  width: 12px;
  text-align: center;
`;

const NodeList = styled.div<{ visible: boolean }>`
  display: ${props => props.visible ? 'block' : 'none'};
  margin-left: 16px;
`;

const NodeItem = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  color: #cccccc;
  margin-bottom: 2px;
  transition: background-color 0.15s;
  gap: 8px;

  &:hover {
    background-color: #094771;
  }

  &:active {
    background-color: #0e639c;
  }
`;

const NodeIcon = styled.span`
  font-size: 14px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
`;

const NodeTitle = styled.span`
  flex: 1;
`;

const NodeDescription = styled.div`
  font-size: 11px;
  color: #969696;
  margin-top: 2px;
  line-height: 1.3;
`;

interface NodeTypeInfo {
  id: string;
  title: string;
  category: string;
  description?: string;
  icon?: ReactElement;
  metadata: VisualMethodMetadata;
}

interface NodePaletteProps {
  onNodeSelect: (nodeType: NodeTypeInfo) => void;
}

function NodePalette({ onNodeSelect }: NodePaletteProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ECS/Entity', 'ECS/Component']));

  // Function to map framework icon identifiers to React icons
  const getNodeIcon = (iconId: string): ReactElement | null => {
    const iconMap: Record<string, ReactElement> = {
      'entity-add': <Plus size={14} />,
      'entity-remove': <Trash2 size={14} />,
      'component-add': <Package size={14} />,
      'component-remove': <Upload size={14} />,
      'component-get': <Search size={14} />,
      'component-check': <CheckCircle size={14} />,
      'query-create': <Search size={14} />,
      'query-foreach': <RotateCcw size={14} />,
      'query-count': <Hash size={14} />,
      'query-without': <XCircle size={14} />
    };

    return iconMap[iconId] || null;
  };

  // Function to localize category names
  const getLocalizedCategory = (category: string): string => {
    // If the category is already an i18n key (starts with i18n prefix), translate directly
    if (category.includes('.')) {
      const translated = t(category);
      if (translated !== category) {
        return translated;
      }
    }

    // Try direct category lookup first
    const directKey = `visual.nodes.categories.${category}`;
    const directTranslated = t(directKey);
    if (directTranslated !== directKey) {
      return directTranslated;
    }

    // If no direct match, try with replaced slashes
    const categoryKey = `visual.nodes.categories.${category.replace('/', '.')}`;
    const translated = t(categoryKey);
    if (translated !== categoryKey) {
      return translated;
    }

    // Return original category if no translation found
    return category;
  };

  // Function to map class name to target type
  const getTargetType = (className: string): string => {
    const mapping: Record<string, string> = {
      'World': 'world',
      'Query': 'query',
      'CommandBuffer': 'commandBuffer'
    };
    return mapping[className] || className.toLowerCase();
  };

  // Get all available node types from visual method metadata
  const getAvailableNodeTypes = (): NodeTypeInfo[] => {
    const nodeTypes: NodeTypeInfo[] = [];
    const visualClasses = getAllVisualClasses();

    for (const classMetadata of visualClasses) {
      const targetType = getTargetType(classMetadata.constructor.name);
      for (const methodMetadata of classMetadata.methods.values()) {
        const nodeType: NodeTypeInfo = {
          id: `${targetType}.${methodMetadata.name}`,
          title: methodMetadata.titleKey ? t(methodMetadata.titleKey) || methodMetadata.title || methodMetadata.name : methodMetadata.title || methodMetadata.name,
          category: methodMetadata.categoryKey || methodMetadata.category || 'Uncategorized',
          description: methodMetadata.descriptionKey ? t(methodMetadata.descriptionKey) || methodMetadata.description : methodMetadata.description,
          icon: methodMetadata.icon ? getNodeIcon(methodMetadata.icon) || <Settings size={14} /> : <Settings size={14} />,
          metadata: methodMetadata
        };
        nodeTypes.push(nodeType);
      }
    }

    // Add some built-in node types (system nodes like flow.start/flow.end are auto-created and not shown in palette)
    const builtInNodes: NodeTypeInfo[] = [
      {
        id: 'math.add',
        title: t('visual.builtinNodes.add') || 'Add',
        category: 'Math/Basic',
        description: t('visual.builtinNodes.addDesc') || 'Add two numbers',
        icon: <Plus size={14} />,
        metadata: {} as any
      },
      {
        id: 'math.multiply',
        title: t('visual.builtinNodes.multiply') || 'Multiply',
        category: 'Math/Basic',
        description: t('visual.builtinNodes.multiplyDesc') || 'Multiply two numbers',
        icon: <X size={14} />,
        metadata: {} as any
      }
    ];

    return [...nodeTypes, ...builtInNodes];
  };

  const nodeTypes = getAvailableNodeTypes();

  // Filter nodes based on search term
  const filteredNodes = nodeTypes.filter(node =>
    node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (node.description && node.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group nodes by category
  const nodesByCategory = filteredNodes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = [];
    }
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeTypeInfo[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleNodeClick = (nodeType: NodeTypeInfo) => {
    onNodeSelect(nodeType);
  };

  return (
    <PaletteContainer>
      <PaletteHeader>
        <HeaderTitle>{t('visual.nodePalette')}</HeaderTitle>
        <SearchBox
          type="text"
          placeholder={t('visual.searchNodes')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </PaletteHeader>

      <CategoryList>
        {Object.entries(nodesByCategory).map(([category, nodes]) => {
          const isExpanded = expandedCategories.has(category);

          return (
            <CategoryGroup key={category}>
              <CategoryHeader
                expanded={isExpanded}
                onClick={() => toggleCategory(category)}
              >
                <CategoryIcon>
                  {isExpanded ? '▼' : '▶'}
                </CategoryIcon>
                {getLocalizedCategory(category)} ({nodes.length})
              </CategoryHeader>

              <NodeList visible={isExpanded}>
                {nodes.map(node => (
                  <NodeItem
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'node',
                        nodeType: node
                      }));
                    }}
                  >
                    {node.icon && (
                      <NodeIcon>{node.icon}</NodeIcon>
                    )}
                    <div>
                      <NodeTitle>{node.title}</NodeTitle>
                      {node.description && (
                        <NodeDescription>{node.description}</NodeDescription>
                      )}
                    </div>
                  </NodeItem>
                ))}
              </NodeList>
            </CategoryGroup>
          );
        })}

        {Object.keys(nodesByCategory).length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#969696',
            marginTop: '20px',
            fontSize: '12px'
          }}>
            {t('visual.nodes.noNodes')}
          </div>
        )}
      </CategoryList>
    </PaletteContainer>
  );
}

export default NodePalette;