import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            // React hooks rules — catch violations that cause runtime crashes
            ...reactHooks.configs.recommended.rules,

            // Disable React 19 strict rules that flag existing working patterns
            // These are aspirational best-practices, not crash-causing bugs
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/refs': 'off',

            // Catch undefined variables and missing imports (would've caught useNavigate crash)
            'no-undef': 'error',

            // Catch unreachable code and other logic errors
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-empty-pattern': 'error',

            // Allow unused vars with underscore prefix (common React pattern)
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
]
