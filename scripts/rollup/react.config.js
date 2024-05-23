// packages/react 的打包配置
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils.ts";
import generatePackageJson from 'rollup-plugin-generate-package-json';

const { name, module } = getPackageJSON('react');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

export default [
    {
        input: `${pkgPath}/${module}`,
        output: {
            file: `${pkgDistPath}/index.js`,
            name: 'index.js',
            format: 'umd'
        },
        plugins: [...getBaseRollupPlugins(), generatePackageJson({
            inputFolder: pkgPath,
            outputFolder: pkgDistPath,
            baseContents: ({ name, description, version }) => ({
                name,
                description,
                version,
                main: 'index.js'
            })
        })]
    },
    // runtime
    {
        input: `${pkgPath}/src/jsx.ts`,
        output: [
            // jsx-runtime
            {
                file: `${pkgDistPath}/jsx-runtime.js`,
                name: 'jsx-runtime.js',
                formate: 'umd'
            },
            // dev-runtime
            {
                file: `${pkgDistPath}/dev-runtime.js`,
                name: 'dev-runtime.js',
                formate: 'umd'
            }
        ],
        plugins: getBaseRollupPlugins()
    }
];
