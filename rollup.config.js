import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

const external = ['superjson', '@msgpack/msgpack'];

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/nova-ecs.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ],
    external
  },
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/nova-ecs.umd.js',
      format: 'umd',
      name: 'NovaECS',
      sourcemap: true,
      globals: {
        'superjson': 'superjson',
        '@msgpack/msgpack': 'msgpack'
      }
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ],
    external
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/nova-ecs.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ],
    external
  },
  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/nova-ecs.d.ts',
      format: 'es'
    },
    plugins: [dts()],
    external
  }
];