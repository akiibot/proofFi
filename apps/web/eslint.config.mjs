import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
 { ignores: ['.next/**','next-env.d.ts','src/lib/schema.d.ts','playwright-report/**','test-results/**'] },
 ...tseslint.configs.recommended,
 { files:['**/*.ts','**/*.tsx'],plugins:{'react-hooks':reactHooks},rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn'} },
);
