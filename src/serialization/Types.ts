import type { Component } from '../core/Component';
import type { ComponentType } from '../utils/Types';

export interface ComponentSerde<T extends Component = Component> {
  type: ComponentType<T>;
  serialize: (component: T) => any;
  deserialize: (data: any) => T;
}

export interface SerializedEntity {
  guid: string;
  components: Record<string, any>;
}

export interface SaveData {
  version: number;
  entities: SerializedEntity[];
  metadata?: Record<string, any>;
}

export interface SaveOptions {
  includeComponents?: ComponentType[];
  excludeComponents?: ComponentType[];
  metadata?: Record<string, any>;
}

export interface LoadOptions {
  clearWorld?: boolean;
  mergeEntities?: boolean;
}